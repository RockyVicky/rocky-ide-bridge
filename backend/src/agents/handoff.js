const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function psSingleQuote(value) {
  return String(value).replace(/'/g, "''");
}

function cleanup(files) {
  for (const file of files) {
    try { fs.unlinkSync(file); } catch (e) {}
  }
}

function triggerAntigravity(promptText) {
  return new Promise((resolve) => {
    const tmpFiles = [];

    try {
      const formattedPrompt = `[MANAGER HANDOFF]\n${promptText}`;
      const handoffDir = process.env.HANDOFF_DIR || path.resolve(__dirname, '../../');

      // File bridge: persistent source of truth for manual/polling fallback.
      const handoffFile = path.join(handoffDir, 'handoff.txt');
      const queueFile = path.join(handoffDir, 'handoff_queue.ndjson');
      const latestFile = path.join(handoffDir, `handoff_latest_${Date.now()}.txt`);
      fs.writeFileSync(latestFile, formattedPrompt, 'utf8');
      fs.appendFileSync(
        handoffFile,
        `${os.EOL}${os.EOL}--- ${new Date().toISOString()} ---${os.EOL}${formattedPrompt}`,
        'utf8'
      );
      fs.appendFileSync(
        queueFile,
        JSON.stringify({ ts: new Date().toISOString(), prompt: formattedPrompt, file: latestFile }) + os.EOL,
        'utf8'
      );
      console.log(`[Handoff] Digital bridge appended at: ${handoffFile}`);
      console.log(`[Handoff] Latest prompt file created at: ${latestFile}`);

      // Visual bridge: focus Antigravity and paste the prompt.
      const stamp = Date.now();
      const tmpFile = path.join(os.tmpdir(), `ag_prompt_${stamp}.txt`);
      const resultFile = path.join(os.tmpdir(), `ag_macro_result_${stamp}.json`);
      const psFile = path.join(os.tmpdir(), `ag_macro_${stamp}.ps1`);
      tmpFiles.push(tmpFile, resultFile, psFile);
      fs.writeFileSync(tmpFile, formattedPrompt, 'utf8');

      const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@

$resultFile = '${psSingleQuote(resultFile)}'
$text = [System.IO.File]::ReadAllText('${psSingleQuote(tmpFile)}')
Set-Clipboard -Value $text

# Prefer Antigravity directly. Newer builds may not expose MainWindowTitle or
# MainWindowHandle, so also try WScript AppActivate by process id.
$procs = Get-Process | Where-Object {
    $_.ProcessName -match 'Antigravity' -or $_.MainWindowTitle -match 'Antigravity'
} | Sort-Object @{ Expression = { if ($_.MainWindowHandle -ne [IntPtr]::Zero) { 0 } else { 1 } } }, StartTime -Descending

$shell = New-Object -ComObject WScript.Shell
$activated = $false
$target = $null

foreach ($p in $procs) {
    if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
        [Win32]::ShowWindow($p.MainWindowHandle, 5)
        $activated = [Win32]::SetForegroundWindow($p.MainWindowHandle)
    }

    if (-not $activated) {
        try {
            $activated = $shell.AppActivate([int]$p.Id)
        } catch {
            $activated = $false
        }
    }

    if ($activated) {
        $target = $p
        break
    }
}

if ($activated) {
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    [console]::Beep(800, 250)
}

$result = [ordered]@{
    activated = [bool]$activated
    targetProcess = if ($target) { $target.ProcessName } else { $null }
    targetPid = if ($target) { $target.Id } else { $null }
    antigravityProcessCount = @($procs).Count
}
$result | ConvertTo-Json -Compress | Set-Content -Path $resultFile -Encoding UTF8
`;

      fs.writeFileSync(psFile, psScript, 'utf8');

      let macroStarted = false;
      try {
        const child = exec(`powershell.exe -STA -ExecutionPolicy Bypass -File "${psFile}"`, (error, stdout, stderr) => {
        let macroResult = null;
        try {
          if (fs.existsSync(resultFile)) {
            macroResult = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
          }
        } catch (readErr) {
          console.error('[Handoff] Could not read macro result:', readErr.message);
        }

        if (error) console.error('[Handoff] Macro error:', error.message);
        if (stderr) console.error('[Handoff] Macro stderr:', stderr.trim());
        console.log('[Handoff] Macro result:', macroResult || { activated: false, reason: 'missing result file' });

        cleanup(tmpFiles);
          resolve(Boolean(macroResult && macroResult.activated));
        });
        macroStarted = Boolean(child);
      } catch (spawnErr) {
        console.error('[Handoff] Macro could not start:', spawnErr.message);
        cleanup(tmpFiles);
        resolve(true);
      }

      if (!macroStarted) {
        console.error('[Handoff] Macro process did not start. Prompt is available in the file bridge.');
      }
    } catch (err) {
      console.error('[Handoff] Creation error:', err);
      cleanup(tmpFiles);
      resolve(false);
    }
  });
}

module.exports = { triggerAntigravity };
