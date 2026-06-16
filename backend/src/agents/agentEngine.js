const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const modelRouter = require("../models/modelRouter");
const { notify, log } = require("../notifications/notifier");
const {
  createGoal, updateGoalStatus, createProject, updateProject,
  addLog, updateGoalProgress, getMemoryContext
} = require("../utils/database");
const tools = require("./tools"); 
const { triggerAntigravity } = require("./handoff"); 
const { callCrewBrain } = require("../crew/crewBridge");

const WORKSPACE = path.resolve(process.env.WORKSPACE_DIR || "./workspace");
const MAX_LOOPS = Number(process.env.AGENT_MAX_LOOPS || 40);
const KEEP_RECENT_MESSAGES = 8;
const ALLOW_CLOUD_ESCALATION = process.env.ALLOW_CLOUD_ESCALATION === "true";
const STOP_ON_PROJECT_FAILURE = process.env.STOP_ON_PROJECT_FAILURE !== "false";

fs.mkdirSync(WORKSPACE, { recursive: true });

const SYSTEM_PROMPT = `Role: Prompt Engineer. Task: Translate user goal to Antigravity (Cloud AI) prompt. Do NOT read files. 
Be ultra-short to save tokens.

Actions: task_complete OR handover_to_antigravity

Format EXCEPTIONS:
Thought: Handing over to Antigravity.
Action: handover_to_antigravity
Prompt:
[OBJECTIVE] (Goal sentence)
[SCOPE] (e.g. React Native Node)
[DIRECTIVES] (1-2 clear steps max)
EndPrompt

Wait for "Observation: [Results]". Use ONE action per turn. Wrap payload exactly between "Prompt:" and "EndPrompt".`;

async function planGoal(goalId, goalTitle, goalDescription, imageBase64) {
  const isDirectCheck = /intel|check|verify|status|test/i.test(goalTitle);

  if (process.env.CREWAI_ENABLED === "true" && !isDirectCheck) {
    try {
      log(goalId, null, `🧠 Consulting CrewAI Strategist for plan...`);
      const crewPlan = await callCrewBrain(goalTitle + " " + (goalDescription || ""));
      log(goalId, null, `✅ CrewAI Plan Received: ${crewPlan.summary}`);
      return crewPlan;
    } catch (error) {
      log(goalId, null, `⚠️ CrewAI Planning failed, falling back to Antigravity. Error: ${error.message}`);
    }
  }

  log(goalId, null, `Creating Antigravity pipeline for: "${goalTitle}"`);
  return { 
    estimated_time: "5 sec", 
    projects: [{ name: "Trigger Antigravity Engine", description: `Pass the objective to Antigravity: ${goalTitle}` }] 
  };
}

async function executeAction(actionBlock, projectDir, projectState) {
  try {
    const actionMatch = actionBlock.match(/Action:\s*([a-zA-Z0-9_]+)/i);
    if (!actionMatch) {
      return {
        observation: "Observation: Error - No Action specified.",
        followUpPrompt: "Supervisor: Use exactly one supported action in the required format."
      };
    }
    
    const action = actionMatch[1];
    if (action === 'task_complete') {
      return await handleTaskComplete(projectDir, projectState);
    }
    
    if (action === 'handover_to_antigravity') {
      const promptText = extractBlock(actionBlock, 'Prompt:', 'EndPrompt');
      if (!promptText) return { observation: "Observation: Error - handover_to_antigravity requires Prompt/EndPrompt block." };
      
      const success = await triggerAntigravity(promptText);
      if(success) {
         return { complete: true, handedOver: true }; 
      } else {
         return { observation: "Observation: Error - Macro execution failed on Windows clipboard." };
      }
    }

    if (action === 'list_directory') {
      const d = extractField(actionBlock, 'Path') || ".";
      return { observation: `Observation:\n${await tools.list_directory(projectDir, d)}` };
    }
    if (action === 'read_file') {
      const p = extractField(actionBlock, 'Path');
      if (!p) return { observation: "Observation: Error - No Path specified." };
      return { observation: `Observation:\n${await tools.read_file(projectDir, p)}` };
    }
    if (action === 'search_files') {
      const q = extractField(actionBlock, 'Query');
      const d = extractField(actionBlock, 'Path') || ".";
      return { observation: `Observation:\n${await tools.search_files(projectDir, q, d)}` };
    }
    if (action === 'replace_in_file') {
      const p = extractField(actionBlock, 'Path');
      const f = extractField(actionBlock, 'Find');
      const r = extractField(actionBlock, 'Replace');
      if(!p || !f) return { observation: "Observation: Error - Path and Find fields required." };
      return { observation: `Observation:\n${await tools.replace_in_file(projectDir, p, f, r)}` };
    }
    if (action === 'delete_path') {
      const p = extractField(actionBlock, 'Path');
      if (!p) return { observation: "Observation: Error - No Path specified." };
      return { observation: `Observation:\n${await tools.delete_path(projectDir, p)}` };
    }
    if (action === 'run_command') {
      const c = extractField(actionBlock, 'Command');
      if (!c) return { observation: "Observation: Error - No Command specified." };
      const raw = await tools.run_command(projectDir, c);
      recordCommand(projectState, c, raw);
      return { observation: `Observation:\n${raw}` };
    }
    if (action === 'start_background_process') {
      const c = extractField(actionBlock, 'Command');
      if (!c) return { observation: "Observation: Error - No Command specified." };
      const raw = await tools.start_background_process(projectDir, c);
      const pidMatch = raw.match(/Started Background Process ID:\s*(\S+)/);
      if (pidMatch) {
        projectState.backgroundProcesses.add(pidMatch[1]);
      }
      return { observation: `Observation:\n${raw}` };
    }
    if (action === 'read_process_logs') {
      const pid = extractField(actionBlock, 'Pid');
      if (!pid) return { observation: "Observation: Error - No Pid specified." };
      return { observation: `Observation:\n${await tools.read_process_logs(pid)}` };
    }
    if (action === 'kill_process') {
      const pid = extractField(actionBlock, 'Pid');
      if (!pid) return { observation: "Observation: Error - No Pid specified." };
      projectState.backgroundProcesses.delete(pid);
      return { observation: `Observation:\n${await tools.kill_process(pid)}` };
    }
    if (action === 'research_web') {
      const q = extractField(actionBlock, 'Query');
      if (!q) return { observation: "Observation: Error - No Query specified." };
      return { observation: `Observation:\n${await tools.research_web(projectDir, q)}` };
    }
    
    if (action === 'write_file') {
      const p = extractField(actionBlock, 'Path');
      if(!p) return { observation: "Observation: Error - No Path specified." };
      
      let content = "";
      const contentStart = actionBlock.indexOf('Content:\n');
      const contentEnd = actionBlock.indexOf('\nEndContent');
      
      if (contentStart !== -1 && contentEnd !== -1) {
        content = actionBlock.substring(contentStart + 9, contentEnd);
      } else {
        // Fallback: search for standard markdown block hallucinated by LLM
        const mdMatch = actionBlock.match(/```[a-z]*\n([\s\S]*?)\n```/);
        if (mdMatch) {
           content = mdMatch[1];
        } else {
           return { observation: "Observation: Error - Missing Content tags or Markdown code block." };
        }
      }
      const raw = await tools.write_file(projectDir, p, content);
      if (raw.startsWith('Success:')) {
        recordEditedFile(projectState, projectDir, p);
      }
      return { observation: `Observation:\n${raw}` };
    }
    
    return {
      observation: `Observation: Unknown action '${action}'`,
      followUpPrompt: "Supervisor: Use only the listed actions and keep the format exact."
    };
  } catch (err) {
    return { observation: `Observation: Error parsing action - ${err.message}` };
  }
}

async function solveProject(goalId, goalTitle, projectDef, imageBase64) {
  const projectId = uuidv4();
  const projectDir = path.join(WORKSPACE, goalId, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const projectState = createProjectState();

  await createProject(projectId, goalId, projectDef.name, projectDef.description);
  notify("project_update", { goalId, projectId, projectName: projectDef.name, status: "running", message: `Started: ${projectDef.name}` });

  const JARVIS_ROOT = path.resolve(WORKSPACE, "../../");
  let messages = [
    {
      role: "user",
      content: [
        `GOAL: ${goalTitle}`,
        `TASK: ${projectDef.name} - ${projectDef.description}`,
        `Start by generating the perfect Antigravity handover prompt immediately.`
      ].join("\n"),
      ...(imageBase64 ? { image_base64: imageBase64 } : {})
    }
  ];

  let modelUsedFinal = "unknown";
  let totalTokens = 0;
  let consecutiveErrors = 0;
  let isEscalated = false;
  const startTime = Date.now();

  const memories = await getMemoryContext(4);
  let activeSystemPrompt = SYSTEM_PROMPT;
  if (memories && memories.length > 0) {
      activeSystemPrompt += "\n\nPAST COMPLETED TASKS (Contextual Memory):\n" + memories.map(m => `- Reference: ${m.prompt}\n  Action Executed: ${m.result}`).join("\n");
  }

  let forceModel = null;
  const lowerTitle = goalTitle.toLowerCase();
  
  if (lowerTitle.includes('[agent]') || lowerTitle.includes('[gpt]')) forceModel = 'gpt-5.5';
  else if (lowerTitle.includes('[claude]')) forceModel = 'claude-sonnet-5';
  else if (lowerTitle.includes('[opus]')) forceModel = 'claude-opus-4.7';
  else if (lowerTitle.includes('[kimi]')) forceModel = 'kimi-k2.6';
  else if (lowerTitle.includes('[nvidia]') || lowerTitle.includes('[nemotron]')) forceModel = 'nemotron-3-nano-omni';
  else if (lowerTitle.includes('[qwen]')) forceModel = 'qwen2.5-coder:7b';
  else if (lowerTitle.includes('[gemini]')) forceModel = 'gemini-3.1-pro';
  else if (lowerTitle.includes('[flash]') || lowerTitle.includes('[fast]')) forceModel = 'gemini-3.1-flash';
  else {
    // Auto-Router Orchestrator
    log(goalId, projectId, `🤖 Auto-Router analyzing prompt to select optimal agentic model...`);
    try {
      const routingPrompt = `You are an Auto-Router. Analyze the user's task and select the best model ID from the list below. Return ONLY the exact string of the model ID and nothing else.
Models:
- gpt-5.5 (Agentic coding, long-horizon computer use)
- claude-sonnet-5 (Complex coding and UI layouts)
- claude-opus-4.7 (Massive reasoning and system design)
- kimi-k2.6 (Sub-agent swarms and logic)
- nemotron-3-nano-omni (Fast multimodal perception-action)
- gemini-3.1-flash (Small rapid text edits)

User Task: ${goalTitle} - ${projectDef.description}`;
      
      const routeRes = await modelRouter.call([{ role: "user", content: routingPrompt }], "", 0, "gemini-3.1-flash");
      const decidedModel = routeRes.content.trim().replace(/['"`]/g, '').toLowerCase();
      
      const validModels = ['gpt-5.5', 'claude-sonnet-5', 'claude-opus-4.7', 'kimi-k2.6', 'nemotron-3-nano-omni', 'gemini-3.1-flash'];
      if (validModels.includes(decidedModel)) {
        forceModel = decidedModel;
        log(goalId, projectId, `🎯 Auto-Router selected: ${forceModel}`);
      } else {
        throw new Error("Invalid model string returned: " + decidedModel);
      }
    } catch (err) {
      log(goalId, projectId, `⚠️ Auto-Router fallback: Using default priority.`);
    }
  }

  for (let loop = 1; loop <= MAX_LOOPS; loop++) {
    log(goalId, projectId, `${isEscalated ? "[☁ Cloud] " : ""}${forceModel ? `[${forceModel}] ` : ""}Thinking (Step ${loop}/${MAX_LOOPS})...`);
    
    try {
      const { content, modelUsed, tokens } = await modelRouter.call(
        messages,
        activeSystemPrompt,
        0,
        isEscalated ? "gemini-1.5-pro" : forceModel
      );
      modelUsedFinal = modelUsed;
      if (tokens) totalTokens += tokens;
      messages.push({ role: "assistant", content });

      // Log thought dynamically to phone
      const thoughtMatch = content.match(/Thought:\s*(.*?)(?=\nAction:|$)/s);
      if (thoughtMatch) {
         log(goalId, projectId, `AI: ${thoughtMatch[1].trim()}`);
      }

      const actionResult = await executeAction(content, JARVIS_ROOT, projectState);
      const observation = actionResult.observation;
      projectState.lastObservation = observation;
      
      if (actionResult.complete) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        if (actionResult.handedOver) {
           log(goalId, projectId, `Handed over to Antigravity successfully! Triggering Windows Macro...`);
           await updateProject("done", "Handoff to Antigravity", "Prompt Macro Injected", null, loop, modelUsedFinal, projectId);
           notify("project_done", { goalId, projectId, projectName: projectDef.name, status: "done", message: `Passed to Antigravity.` });
           return { success: true, projectId, output: "Handed over to Antigravity. Check IDE for completion." };
        }
        log(goalId, projectId, `Task Completed Successfully in ${duration}s! (Tokens: ${totalTokens})`);
        await updateProject(
          "done",
          [...projectState.changedFiles].join("\n") || "No file changes",
          buildProjectOutput(projectState),
          null,
          loop,
          modelUsedFinal,
          projectId
        );
        notify("project_done", { goalId, projectId, projectName: projectDef.name, status: "done", message: `Done: ${projectDef.name}` });
        return { success: true, projectId, output: buildProjectOutput(projectState) };
      }

      messages.push({ role: "user", content: observation });
      if (actionResult.followUpPrompt) {
        messages.push({ role: "system", content: actionResult.followUpPrompt });
      }

      if (messages.length > 15) {
         messages = compactMessages(messages);
      }

      if (observation.includes("Error") || observation.includes("Unknown action")) {
        consecutiveErrors++;
        log(goalId, projectId, `AI Warning: Error encountered (Streak: ${consecutiveErrors})`);
      } else {
        consecutiveErrors = 0;
      }

      if (loop === 6 && projectState.editVersion === 0) {
        messages.push({
          role: "system",
          content: "Supervisor: You have inspected enough. Make a focused code change or run a targeted command instead of continuing broad exploration."
        });
      }

      if (loop === 10 && projectState.editVersion > projectState.verifiedEditVersion) {
        messages.push({
          role: "system",
          content: "Supervisor: You have edited files but have not finished verification. Fix the latest issue and do not call task_complete until checks pass."
        });
      }

      if (ALLOW_CLOUD_ESCALATION && consecutiveErrors >= 2 && !isEscalated) {
        log(goalId, projectId, `Auto-Escalating to Cloud Intelligence (Gemini 1.5) to clear blockage...`);
        isEscalated = true;
        consecutiveErrors = 0; // Reset for the cloud model
        messages.push({ role: "system", content: "SUPERVISOR EXCEPTION: Escalated to Cloud AI. You are a senior AI resolving a local model's failure. Review the immediate history, locate the bug, and immediately solve this project." });
      } else if (ALLOW_CLOUD_ESCALATION && loop === 10 && !isEscalated) {
        log(goalId, projectId, `AI Warning: Stagnation detected. Auto-Escalating to Cloud Intelligence (Gemini 1.5) to force completion...`);
        isEscalated = true;
        messages.push({ role: "system", content: "SUPERVISOR EXCEPTION: Stagnation Escalate. You are a senior Cloud AI. The local model failed to progress or exit after 10 loops of raw thinking. Review its recent history, make a decisive technical action, and finish this project immediately." });
      } else if (!ALLOW_CLOUD_ESCALATION && consecutiveErrors >= 2) {
        consecutiveErrors = 0;
        messages.push({
          role: "system",
          content: "Supervisor: Your last actions failed. Re-read the latest observation carefully, inspect the exact file or command output, and make the smallest corrective step."
        });
      }

    } catch (err) {
      await cleanupBackgroundProcesses(projectState);
      log(goalId, projectId, `Fatal Loop Error: ${err.message}`);
      await updateProject("failed", [...projectState.changedFiles].join("\n"), buildProjectOutput(projectState), err.message, loop, modelUsedFinal, projectId);
      notify("project_error", { goalId, projectId, projectName: projectDef.name, status: "failed", message: `Error: ${err.message}` });
      return { success: false, projectId, error: err.message };
    }
  }

  await cleanupBackgroundProcesses(projectState);
  log(goalId, projectId, `Timeout: Reached max ${MAX_LOOPS} loops.`);
  await updateProject("failed", [...projectState.changedFiles].join("\n"), buildProjectOutput(projectState), "Max loops reached.", MAX_LOOPS, modelUsedFinal, projectId);
  notify("project_error", { goalId, projectId, projectName: projectDef.name, status: "failed", message: `Timeout reached.` });
  return { success: false, projectId };
}

async function processGoal(goalId, title, description, imageBase64) {
  try {
    await updateGoalStatus("running", goalId);
    notify("goal_update", { goalId, status: "running", message: `🧠 LangGraph Engine Initialized for: "${title}"` });

    const { rockyGraph } = require("./rockyGraph");
    
    // Set root to the actual project root (parent of backend)
    const projectDir = path.resolve(__dirname, "../../../"); 

    const initialState = {
      goal: title + (description ? ` - ${description}` : ""),
      projectDir: projectDir,
      goalId: goalId,
      projectId: uuidv4(),
      messages: [{ role: "user", content: `Objective: ${title}` }],
      iteration: 0,
      maxIterations: 10
    };

    const result = await rockyGraph.invoke(initialState, { recursionLimit: 50 });

    const finalStatus = result.status === "completed" ? "completed" : "failed";
    await updateGoalStatus(finalStatus, goalId);
    notify("goal_complete", { goalId, status: finalStatus, message: `Finished: "${title}" via Quantum Graph.` });

  } catch (err) {
    console.error('[processGoal Error]', err);
    await updateGoalStatus("failed", goalId);
    notify("goal_update", { goalId, status: "failed", message: `Goal failed: ${err.message}` });
  }
}

module.exports = { processGoal, executeAction };

function buildRepoSummary(repoRoot) {
  try {
    const entries = fs
      .readdirSync(repoRoot, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .slice(0, 20)
      .map((entry) => `${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${entry.name}`);

    const packageJsonPaths = ['package.json', 'backend/package.json', 'mobile-app/package.json']
      .map((relativePath) => path.join(repoRoot, relativePath))
      .filter((filePath) => fs.existsSync(filePath));

    const packageHints = packageJsonPaths.map((filePath) => {
      try {
        const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const scripts = Object.keys(pkg.scripts || {});
        return `${path.relative(repoRoot, filePath).replace(/\\/g, '/')} scripts: ${scripts.join(', ') || 'none'}`;
      } catch (_) {
        return null;
      }
    }).filter(Boolean);

    return [...entries, ...packageHints].join('\n');
  } catch (err) {
    return `Unable to build repo summary: ${err.message}`;
  }
}

function compactMessages(messages) {
  const preserved = messages.slice(-KEEP_RECENT_MESSAGES);
  const older = messages.slice(1, Math.max(messages.length - KEEP_RECENT_MESSAGES, 1));
  const summaryLines = [];

  for (const message of older) {
    if (message.role === 'assistant') {
      const thought = message.content.match(/Thought:\s*(.*?)(?=\nAction:|$)/s)?.[1]?.trim();
      const action = message.content.match(/Action:\s*([a-zA-Z0-9_]+)/)?.[1];
      if (thought || action) {
        summaryLines.push(`Assistant: ${thought || 'Worked on the task'}${action ? ` | action=${action}` : ''}`);
      }
    }

    if (message.role === 'user' && message.content.startsWith('Observation:')) {
      const observation = message.content
        .replace(/^Observation:\s*/i, '')
        .split('\n')
        .slice(0, 3)
        .join(' | ')
        .trim();

      if (observation) {
        summaryLines.push(`Observation: ${observation}`);
      }
    }
  }

  const summaryMessage = summaryLines.length
    ? [{ role: 'system', content: `Working memory summary:\n${summaryLines.slice(-12).join('\n')}` }]
    : [];

  return [messages[0], ...summaryMessage, ...preserved];
}

const { extractField, extractBlock } = require("../utils/parser");

function createProjectState() {
  return {
    changedFiles: new Set(),
    commandsRun: [],
    backgroundProcesses: new Set(),
    editVersion: 0,
    verifiedEditVersion: 0,
    verificationSummary: "Verification has not run yet.",
    lastObservation: ""
  };
}

function recordEditedFile(projectState, repoRoot, filePath) {
  const relativePath = path.relative(repoRoot, path.resolve(repoRoot, filePath)).replace(/\\/g, '/');
  projectState.changedFiles.add(relativePath);
  projectState.editVersion += 1;
}

function recordCommand(projectState, command, rawResult) {
  const success = isSuccessfulCommandResult(rawResult);
  const verification = isVerificationCommand(command);

  projectState.commandsRun.push({ command, success, verification });

  if (verification) {
    projectState.verificationSummary = summarizeCommandResult(command, rawResult);
    if (success) {
      projectState.verifiedEditVersion = projectState.editVersion;
    }
  }
}

function isSuccessfulCommandResult(rawResult) {
  return /^Exit Code:\s*0\b/m.test(rawResult);
}

function isVerificationCommand(command) {
  const normalized = command.toLowerCase();
  const negativePatterns = ['npm install', 'npm ci', 'npm start', 'npm run dev', 'expo start', 'nodemon', 'serve'];
  if (negativePatterns.some((token) => normalized.includes(token))) {
    return false;
  }

  return /(test|lint|typecheck|build|check|verify|pytest|vitest|jest|node --check|tsc)/i.test(normalized);
}

function summarizeCommandResult(command, rawResult) {
  return `Command: ${command}\n${truncateText(rawResult, 1600)}`;
}

function truncateText(value, maxChars = 1600) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n... truncated ...`;
}

async function handleTaskComplete(repoRoot, projectState) {
  if (projectState.editVersion > projectState.verifiedEditVersion) {
    const verification = await autoVerifyProject(repoRoot, projectState);
    if (!verification.success) {
      return {
        observation: `Observation:\nAutomatic verification failed.\n${verification.summary}`,
        followUpPrompt: "Supervisor: Fix the verification failure shown in the latest observation, then run checks again before task_complete."
      };
    }
  }

  await cleanupBackgroundProcesses(projectState);
  return { complete: true };
}

async function autoVerifyProject(repoRoot, projectState) {
  const packageCommands = collectVerificationCommands(repoRoot, projectState);
  const fallbackCommands = packageCommands.length ? [] : collectFileLevelChecks(projectState);
  const commands = [...packageCommands, ...fallbackCommands];

  if (!commands.length) {
    projectState.verifiedEditVersion = projectState.editVersion;
    projectState.verificationSummary = "No automated verification command was available for the edited files.";
    return { success: true, summary: projectState.verificationSummary };
  }

  const results = [];

  for (const candidate of commands) {
    const raw = await tools.run_command(candidate.cwd, candidate.command);
    recordCommand(projectState, candidate.command, raw);
    const label = `${path.relative(repoRoot, candidate.cwd).replace(/\\/g, '/') || '.'}: ${candidate.command}`;
    results.push(`${label}\n${truncateText(raw, 1200)}`);

    if (!isSuccessfulCommandResult(raw)) {
      projectState.verificationSummary = `Verification failed.\n${results.join('\n\n')}`;
      return { success: false, summary: projectState.verificationSummary };
    }
  }

  projectState.verificationSummary = `Verification passed.\n${results.join('\n\n')}`;
  projectState.verifiedEditVersion = projectState.editVersion;
  return { success: true, summary: projectState.verificationSummary };
}

function collectVerificationCommands(repoRoot, projectState) {
  const packageDirs = new Set();

  for (const filePath of projectState.changedFiles) {
    const packageDir = findNearestPackageDir(repoRoot, path.join(repoRoot, filePath));
    if (packageDir) {
      packageDirs.add(packageDir);
    }
  }

  if (!packageDirs.size && fs.existsSync(path.join(repoRoot, 'package.json'))) {
    packageDirs.add(repoRoot);
  }

  const selected = [];

  for (const packageDir of packageDirs) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
      const scripts = pkg.scripts || {};
      const orderedNames = [];

      for (const name of ['test', 'lint', 'typecheck', 'check', 'build']) {
        if (scripts[name]) {
          orderedNames.push(name);
        }
      }

      if (!orderedNames.length) continue;

      for (const name of orderedNames.slice(0, 3)) {
        selected.push({ cwd: packageDir, command: `npm run ${name}` });
      }
    } catch (_) {
      // Ignore malformed package manifests.
    }
  }

  return selected.slice(0, 4);
}

function collectFileLevelChecks(projectState) {
  const commands = [];

  for (const filePath of projectState.changedFiles) {
    if (/\.(cjs|mjs|js)$/i.test(filePath) && !/\.jsx$/i.test(filePath)) {
      commands.push({ cwd: path.resolve(WORKSPACE, '../../'), command: `node --check "${filePath}"` });
    }
  }

  return commands.slice(0, 5);
}

function findNearestPackageDir(repoRoot, absoluteFilePath) {
  let currentDir = fs.existsSync(absoluteFilePath) && fs.statSync(absoluteFilePath).isDirectory()
    ? absoluteFilePath
    : path.dirname(absoluteFilePath);

  while (currentDir.startsWith(repoRoot)) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return null;
}

async function cleanupBackgroundProcesses(projectState) {
  for (const pid of [...projectState.backgroundProcesses]) {
    await tools.kill_process(pid);
    projectState.backgroundProcesses.delete(pid);
  }
}

function buildProjectOutput(projectState) {
  const changedFiles = [...projectState.changedFiles];
  const commands = projectState.commandsRun
    .slice(-8)
    .map((entry) => `${entry.success ? 'OK' : 'FAIL'} ${entry.command}`)
    .join('\n') || 'No commands recorded.';

  return [
    `Changed files: ${changedFiles.length ? changedFiles.join(', ') : 'None'}`,
    projectState.verificationSummary,
    `Recent commands:\n${commands}`
  ].join('\n\n');
}
