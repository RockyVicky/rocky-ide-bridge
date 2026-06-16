const { StateGraph, START, END, Annotation } = require("@langchain/langgraph");

// Define the state schema using Annotation (modern LangGraph way)
const GraphState = Annotation.Root({
  objective: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  plan: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  status: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "idle"
  }),
  errors: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  result: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => ""
  })
});

// Import nodes (to be created)
const plannerNode = require('./nodes/planner');
const coderNode = require('./nodes/coder');
// const executorNode = require('./nodes/executor');

// Build the graph
const workflow = new StateGraph(GraphState)
  .addNode("planner", plannerNode)
  .addNode("coder", coderNode)
  .addEdge(START, "planner")
  .addEdge("planner", "coder")
  .addEdge("coder", END);

// Compile the graph
const app = workflow.compile();

module.exports = {
  runGraph: async (objective) => {
    console.log(`[GraphEngine] Starting graph for objective: ${objective}`);
    const initialState = { objective };
    return await app.invoke(initialState);
  }
};
