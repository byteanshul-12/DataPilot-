# Entrypoint script to test or execute LangGraph AI workflows directly.
import dotenv
from ai.src.graph.workflow import build_collection_graph

dotenv.load_dotenv()

def main():
    graph = build_collection_graph()
    print("LangGraph workflow graph initialized.")

if __name__ == "__main__":
    main()
