const fs = require('fs');
const path = require('path');
const execa = require('execa');

const backgroundProcesses = {};
let processIdCounter = 1;
const MAX_DIRECTORY_ENTRIES = 200;
const MAX_FILE_LINES = 250;
const MAX_COMMAND_OUTPUT_CHARS = 12000;
const MAX_LOG_OUTPUT_CHARS = 8000;
const MAX_SEARCH_RESULTS = 50;
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'coverage']);
const COMMAND_TIMEOUT_MS = Number(process.env.TOOL_COMMAND_TIMEOUT_MS || 120000);

function checkSandbox(workspaceDir, targetPath) {
  const resolved = path.resolve(workspaceDir, targetPath);
  if (!resolved.startsWith(path.resolve(workspaceDir))) {
    throw new Error(`Sandbox Violation: Access to ${targetPath} is forbidden.`);
  }
  return resolved;
}

async function list_directory(workspaceDir, dirPath = ".") {
  const safePath = checkSandbox(workspaceDir, dirPath);
  if (!fs.existsSync(safePath)) return `Error: Directory ${dirPath} does not exist.`;
  try {
    const files = fs
      .readdirSync(safePath, { withFileTypes: true })
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    const visible = files.slice(0, MAX_DIRECTORY_ENTRIES);
    const lines = visible.map((f) => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`);
    if (files.length > visible.length) {
      lines.push(`... truncated ${files.length - visible.length} more entries`);
    }
    return lines.join('\n') || "(Empty directory)";
  } catch (err) {
    return `Error reading directory: ${err.message}`;
  }
}

async function read_file(workspaceDir, filePath, startLine = 1, endLine = null) {
  const safePath = checkSandbox(workspaceDir, filePath);
  if (!fs.existsSync(safePath)) return `Error: File ${filePath} does not exist.`;
  try {
    const raw = fs.readFileSync(safePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const start = Math.max(Number(startLine) || 1, 1);
    const maxEnd = Math.min(start + MAX_FILE_LINES - 1, lines.length);
    const end = endLine ? Math.min(Number(endLine) || maxEnd, lines.length) : maxEnd;
    const slice = lines.slice(start - 1, end);
    const numbered = slice.map((line, index) => `${start + index}: ${line}`);
    const suffix = end < lines.length ? `\n... truncated. Read more with Start: ${end + 1}` : '';
    return numbered.join('\n') + suffix;
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return !['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.sqlite', '.db', '.mp4'].includes(ext);
}

function walkFiles(rootDir, currentDir, visitor, results) {
  if (results.length >= MAX_SEARCH_RESULTS) return;

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= MAX_SEARCH_RESULTS) break;
    if (entry.isDirectory() && (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.'))) continue;

    const absolute = path.join(currentDir, entry.name);
    const relative = path.relative(rootDir, absolute);

    if (entry.isDirectory()) {
      walkFiles(rootDir, absolute, visitor, results);
      continue;
    }

    visitor(absolute, relative, results);
  }
}

async function search_files(workspaceDir, query, dirPath = ".") {
  const safePath = checkSandbox(workspaceDir, dirPath);
  if (!fs.existsSync(safePath)) return `Error: Directory ${dirPath} does not exist.`;
  if (!query || !query.trim()) return "Error: Query is required.";

  const normalizedQuery = query.toLowerCase();
  const results = [];

  try {
    walkFiles(safePath, safePath, (absolute, relative, acc) => {
      const normalizedRelative = relative.replace(/\\/g, '/').toLowerCase();
      if (normalizedRelative.includes(normalizedQuery)) {
        acc.push(`[PATH] ${relative.replace(/\\/g, '/')}`);
        return;
      }

      if (!isTextFile(absolute)) return;

      try {
        const contents = fs.readFileSync(absolute, 'utf8');
        const idx = contents.toLowerCase().indexOf(normalizedQuery);
        if (idx === -1) return;

        const previewStart = Math.max(idx - 60, 0);
        const previewEnd = Math.min(idx + query.length + 120, contents.length);
        const preview = contents
          .slice(previewStart, previewEnd)
          .replace(/\s+/g, ' ')
          .trim();
        acc.push(`[MATCH] ${relative.replace(/\\/g, '/')} :: ${preview}`);
      } catch (_) {
        // Ignore unreadable or binary-ish files.
      }
    }, results);

    if (!results.length) return `No matches found for "${query}" in ${dirPath}.`;
    return results.join('\n');
  } catch (err) {
    return `Error searching files: ${err.message}`;
  }
}

async function write_file(workspaceDir, filePath, content) {
  const safePath = checkSandbox(workspaceDir, filePath);
  try {
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, 'utf8');
    return `Success: Wrote to ${filePath}`;
  } catch (err) {
    return `Error writing file: ${err.message}`;
  }
}

async function replace_in_file(workspaceDir, filePath, findText, replaceText, replaceAll = false) {
  const safePath = checkSandbox(workspaceDir, filePath);
  if (!fs.existsSync(safePath)) return `Error: File ${filePath} does not exist.`;
  if (!findText) return "Error: Find text is required.";

  try {
    const current = fs.readFileSync(safePath, 'utf8');
    if (!current.includes(findText)) {
      return `Error: The target snippet was not found in ${filePath}. Re-read the file and use an exact snippet.`;
    }

    if (!replaceAll && current.indexOf(findText) !== current.lastIndexOf(findText)) {
      return `Error: The target snippet matched multiple locations in ${filePath}. Use a more specific snippet or set ReplaceAll: true.`;
    }

    const updated = replaceAll ? current.split(findText).join(replaceText) : current.replace(findText, replaceText);
    if (updated === current) {
      return `Error: Replacement made no changes in ${filePath}.`;
    }

    fs.writeFileSync(safePath, updated, 'utf8');
    return `Success: Patched ${filePath}`;
  } catch (err) {
    return `Error patching file: ${err.message}`;
  }
}

async function delete_path(workspaceDir, targetPath) {
  const safePath = checkSandbox(workspaceDir, targetPath);
  if (!fs.existsSync(safePath)) return `Error: Path ${targetPath} does not exist.`;
  try {
    fs.rmSync(safePath, { recursive: true, force: true });
    return `Success: Deleted ${targetPath}`;
  } catch (err) {
    return `Error deleting path: ${err.message}`;
  }
}

async function run_command(workspaceDir, command) {
  try {
    const result = await execa.command(command, {
      cwd: workspaceDir,
      timeout: COMMAND_TIMEOUT_MS,
      all: true
    });
    const output = truncateOutput(result.all || '(No output)');
    return `Exit Code: ${result.exitCode}\nOutput:\n${output}`;
  } catch (err) {
    const output = truncateOutput(err.all || err.message);
    return `Error executing command.\nExit Code: ${err.exitCode}\nOutput:\n${output}`;
  }
}

async function start_background_process(workspaceDir, command) {
  try {
    const proc = execa.command(command, { cwd: workspaceDir, all: true });
    const pidId = `proc_${processIdCounter++}`;
    backgroundProcesses[pidId] = proc;
    
    // Store latest logs in memory so agent can query them later if needed
    proc.logs = [];
    proc.status = 'running';
    proc.all.on('data', (d) => {
      proc.logs.push(d.toString());
      if (proc.logs.length > 50) proc.logs.shift(); // keep last 50 lines
    });

    proc.then(() => {
      proc.status = 'completed';
    });

    proc.catch((err) => {
      proc.status = `failed: ${err.message}`;
      proc.logs.push(`\n[Process Exited] ${err.message}`);
    });

    // Wait a brief 2 seconds to catch immediate startup errors
    await new Promise(r => setTimeout(r, 2000));
    const recentLogs = proc.logs.join('').trim() || '(No output yet)';
    
    return `Started Background Process ID: ${pidId}\nInitial 2s Startup Logs:\n${recentLogs}`;
  } catch (err) {
    return `Failed to start process: ${err.message}`;
  }
}

async function read_process_logs(pidId) {
  const proc = backgroundProcesses[pidId];
  if (!proc) return `Error: Process ID ${pidId} not found.`;

  const logs = (proc.logs || []).join('').trim() || '(No logs yet)';
  return `Process ${pidId} status: ${proc.status || 'running'}\nRecent Logs:\n${truncateOutput(logs, MAX_LOG_OUTPUT_CHARS)}`;
}

async function kill_process(pidId) {
  const proc = backgroundProcesses[pidId];
  if (!proc) return `Error: Process ID ${pidId} not found or already dead.`;
  try {
    proc.kill();
    proc.status = 'killed';
    delete backgroundProcesses[pidId];
    return `Success: Killed ${pidId}`;
  } catch (err) {
    return `Error killing process: ${err.message}`;
  }
}

async function research_web(workspaceDir, query) {
  try {
    const googleIt = require('google-it');
    const results = await googleIt({ query: query, 'no-display': true, limit: 5 });
    const formatted = results.map((r, i) => `${i + 1}. [${r.title}](${r.link})\n   ${r.snippet}`).join('\n\n');
    return `Web Research Results for "${query}":\n\n${formatted || "No results found."}`;
  } catch (err) {
    return `Research failed: ${err.message}`;
  }
}

module.exports = {
  list_directory, read_file, search_files, write_file, replace_in_file, delete_path, run_command, start_background_process, read_process_logs, kill_process, research_web
};

function truncateOutput(output, maxChars = MAX_COMMAND_OUTPUT_CHARS) {
  if (output.length <= maxChars) return output;
  return `${output.slice(0, maxChars)}\n... output truncated ...`;
}
