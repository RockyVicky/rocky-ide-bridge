const { StateGraph, START, END } = require("@langchain/langgraph");
const modelRouter = require("../models/modelRouter");
const { log } = require("../notifications/notifier");
const path = require("path");

const agentState = {
  messages: { value: (x, y) => x.concat(y), default: () => [] },
  goal: { value: (x, y) => y ?? x },
  projectDir: { value: (x, y) => y ?? x },
  goalId: { value: (x, y) => y ?? x },
  projectId: { value: (x, y) => y ?? x },
  status: { value: (x, y) => y ?? x },
  iteration: { value: (x, y) => x + (y || 0), default: () => 0 },
  // Persistent State for the engine bridge
  projectState: { 
    value: (x, y) => y ?? x, 
    default: () => ({ 
      changedFiles: new Set(), 
      backgroundProcesses: new Set(),
      commandsRun: [],
      editVersion: 0
    }) 
  }
};

async function agentNode(state) {
  if (state.iteration >= 10) {
    log(state.goalId, state.projectId, "⚠️ Max iterations reached.");
    return { status: "completed" };
  }

  log(state.goalId, state.projectId, `🧠 [Turn ${state.iteration + 1}] Analyzing objective...`);
  
  const systemPrompt = `You are Rocky, the Quantum-Architect.
Objective: ${state.goal}
Dir: ${state.projectDir}

TOOLS: read_file, write_file, list_directory, search_files, run_command, research_web, handover_to_antigravity, task_complete.
CRITICAL: Use relative paths. If you need my help (Antigravity), use handover_to_antigravity immediately.

Format:
Thought: (Step-by-step reasoning)
Action: (tool_name)
(Required Fields)
EndContent (if writing)`;

  try {
    const response = await modelRouter.call(state.messages, systemPrompt, 0);
    const content = response.content;
    
    log(state.goalId, state.projectId, `🎯 AI Action: ${content.match(/Action:\s*(\w+)/)?.[1] || "Thinking..."}`);

    const { executeAction } = require("./agentEngine");
    const result = await executeAction(content, state.projectDir, state.projectState);

    // If handover was successful, mark as completed
    if (result.complete && result.handedOver) {
      log(state.goalId, state.projectId, "🛸 Handover to Antigravity successful.");
      return {
         messages: [{ role: "assistant", content }, { role: "user", content: "Observation: Handoff initiated." }],
         status: "completed"
      };
    }

    return {
      messages: [{ role: "assistant", content }, { role: "user", content: result.observation || "Done." }],
      iteration: 1,
      status: (result.complete || content.includes("task_complete")) ? "completed" : "running",
      projectState: state.projectState // Persist the modified state
    };
  } catch (err) {
    log(state.goalId, state.projectId, `❌ Node Error: ${err.message}`);
    return { status: "completed" };
  }
}

const workflow = new StateGraph({ channels: agentState })
  .addNode("agent", agentNode)
  .addEdge(START, "agent")
  .addConditionalEdges(
    "agent",
    (state) => state.status,
    {
      running: "agent",
      completed: END
    }
  );

const rockyGraph = workflow.compile();

module.exports = { rockyGraph };
