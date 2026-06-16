import os
from crewai import Agent, Task, Crew, Process, LLM
from dotenv import load_dotenv

load_dotenv()

def get_llm(model_name="gemini-flash-latest"):
    # CrewAI 1.x/LiteLLM depends on the specific names returned by the API
    if "flash" in model_name.lower():
        model_name = "gemini-flash-latest"
    
    # Ensure model name has the gemini/ prefix for LiteLLM
    if not model_name.startswith("gemini/"):
        model_name = f"gemini/{model_name}"
        
    # Explicitly set the environment variable for LiteLLM
    os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")
        
    return LLM(
        model=model_name,
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.1
    )

# Configuration from .env
MAX_RPM = int(os.getenv("CREW_MAX_RPM", 10))
MAX_ITER = int(os.getenv("CREW_AGENT_MAX_ITER", 3))

# Define Agents
def create_agents():
    # 1. The Strategist (High Intelligence - Fallback to Flash)
    strategist = Agent(
        role='Chief Strategy Officer',
        goal='Break down complex user objectives into actionable, logical technical steps.',
        backstory="""You are the master brain of JARVIS. You excel at taking vague or complex 
        requests and turning them into a precise architectural plan. Your focus is on 
        efficiency and technical feasibility.""",
        llm=get_llm(os.getenv("CREWAI_STRATEGIST_MODEL", "gemini-1.5-flash")),
        max_iter=MAX_ITER,
        max_rpm=MAX_RPM,
        verbose=True,
        allow_delegation=True
    )

    # 2. The Researcher (Fast Processing - Flash)
    researcher = Agent(
        role='Deep Research Specialist',
        goal='Investigate existing systems, documentation, and context to provide facts for the strategist.',
        backstory="""You are a lightning-fast investigator. You locate relevant files, 
        APIs, and technical constraints. You provide the raw data that the Chief Strategy 
        Officer needs to make decisions.""",
        llm=get_llm(os.getenv("CREWAI_RESEARCHER_MODEL", "gemini-1.5-flash")),
        max_iter=MAX_ITER,
        max_rpm=MAX_RPM,
        verbose=True,
        allow_delegation=False
    )

    # 3. The Technical Result Formatter (Utility - Flash)
    formatter = Agent(
        role='Technical Integration Liaison',
        goal='Consolidate the crew\'s findings into a specific JSON schema for the Node.js execution engine.',
        backstory="""You specialize in inter-process communication. Your job is to take 
        the complex strategy developed by your teammates and translate it into a 
        structured format that a machine can execute without ambiguity.""",
        llm=get_llm("gemini-1.5-flash"),
        max_iter=MAX_ITER,
        max_rpm=MAX_RPM,
        verbose=True,
        allow_delegation=False
    )

    return strategist, researcher, formatter

def run_crew(user_goal):
    strategist, researcher, formatter = create_agents()

    # Define Tasks
    research_task = Task(
        description=f"Analyze the context and constraints for the goal: '{user_goal}'. Identify key files or API components that might be involved.",
        expected_output="A list of technical constraints and relevant system components.",
        agent=researcher
    )

    strategy_task = Task(
        description=f"Based on the research, create a step-by-step implementation plan for the goal: '{user_goal}'. Ensure the steps are small and executable.",
        expected_output="A detailed technical roadmap with specific file changes or commands.",
        agent=strategist,
        context=[research_task]
    )

    formatting_task = Task(
        description="Format the final roadmap into a JSON object with keys: 'summary', 'estimated_time', and 'steps' (a list of objects each with 'action' and 'description').",
        expected_output="A valid JSON string containing the structured plan.",
        agent=formatter,
        context=[strategy_task]
    )

    # Instantiate the Crew
    jarvis_crew = Crew(
        agents=[strategist, researcher, formatter],
        tasks=[research_task, strategy_task, formatting_task],
        process=Process.sequential,
        verbose=True,
        cache=os.getenv("CREW_ENABLE_CACHE", "true").lower() == "true"
    )

    return jarvis_crew.kickoff()
