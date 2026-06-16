import sys
import json
import io

# Force UTF-8 for Windows console stability with emojis
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from main_crew import run_crew

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No goal provided"}))
        sys.exit(1)

    user_goal = sys.argv[1]
    
    try:
        # Run the crew and get the result
        result = run_crew(user_goal)
        
        # Result from CrewAI is often a string, we try to locate JSON within it if it's not pure JSON
        print(result)
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
