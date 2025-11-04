#!/usr/bin/env python3
"""
Interactive Chat with AI Agent

Simple command-line interface to chat with your configured AI agents.
"""

import requests
import json
import sys

# Configuration
MCP_SERVER_URL = "http://localhost:8080"
AGENT_ID = None  # Will be set during runtime or from command line


def get_available_agents():
    """Fetch list of available agents"""
    try:
        response = requests.get(
            f"{MCP_SERVER_URL}/agents",
            params={"user_id": "default_user"},
            timeout=10
        )
        response.raise_for_status()
        return response.json().get("agents", [])
    except Exception as e:
        print(f"❌ Error fetching agents: {str(e)}")
        return []


def select_agent():
    """Allow user to select an agent"""
    agents = get_available_agents()

    if not agents:
        print("❌ No agents found. Please create an agent first.")
        print("\nYou can create an agent via:")
        print("1. Web UI: http://localhost:8501 → Agent Management")
        print("2. API: See QUICKSTART_GUIDE.md")
        sys.exit(1)

    # Filter active agents
    active_agents = [a for a in agents if a.get("is_active", False)]

    if not active_agents:
        print("❌ No active agents found.")
        sys.exit(1)

    print("\n📋 Available Agents:")
    print("=" * 60)

    for idx, agent in enumerate(active_agents, 1):
        print(f"{idx}. {agent['name']}")
        print(f"   Type: {agent['agent_type']}")
        print(f"   Description: {agent['description']}")
        print(f"   Capabilities: {', '.join(agent['capabilities'])}")
        print()

    while True:
        try:
            choice = input("Select an agent (number): ").strip()
            idx = int(choice) - 1

            if 0 <= idx < len(active_agents):
                return active_agents[idx]["id"]
            else:
                print("Invalid choice. Please try again.")
        except ValueError:
            print("Please enter a valid number.")
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            sys.exit(0)


def chat(message, conversation_id=None):
    """Send a message to the agent"""
    url = f"{MCP_SERVER_URL}/chat"
    data = {
        "agent_id": AGENT_ID,
        "message": message
    }

    if conversation_id:
        data["conversation_id"] = conversation_id

    try:
        response = requests.post(url, json=data, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        raise Exception("Request timed out. The agent might be processing a complex query.")
    except requests.exceptions.ConnectionError:
        raise Exception(f"Cannot connect to MCP server at {MCP_SERVER_URL}. Is it running?")
    except requests.exceptions.HTTPError as e:
        raise Exception(f"Server error: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        raise Exception(f"Unexpected error: {str(e)}")


def test_connection():
    """Test connection to MCP server"""
    try:
        response = requests.get(f"{MCP_SERVER_URL}/health", timeout=5)
        response.raise_for_status()
        health = response.json()

        if health.get("status") == "healthy":
            print("✅ Connected to MCP server")

            # Check databases
            dbs = health.get("databases", {})
            all_ok = all(status == "ok" for status in dbs.values())

            if all_ok:
                print("✅ All databases connected")
            else:
                print("⚠️  Some databases not connected:")
                for db, status in dbs.items():
                    if status != "ok":
                        print(f"   - {db}: {status}")

            return True
        else:
            print(f"⚠️  Server status: {health.get('status')}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to MCP server at {MCP_SERVER_URL}")
        print("\n💡 Make sure the server is running:")
        print("   nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


def main():
    """Main chat loop"""
    global AGENT_ID

    print("\n" + "=" * 60)
    print("🤖 AI Agent Chat Interface")
    print("=" * 60)

    # Test connection
    print("\n🔍 Testing connection...")
    if not test_connection():
        sys.exit(1)

    # Get agent ID from command line or select interactively
    if len(sys.argv) > 1:
        AGENT_ID = sys.argv[1]
        print(f"\n✅ Using agent: {AGENT_ID}")
    else:
        print("\n🤖 Please select an agent:")
        AGENT_ID = select_agent()

    print("\n" + "=" * 60)
    print("💬 Chat Started!")
    print("=" * 60)
    print("\nCommands:")
    print("  - Type your message and press Enter to chat")
    print("  - Type 'exit', 'quit', or 'bye' to end")
    print("  - Press Ctrl+C to exit")
    print("\n" + "=" * 60 + "\n")

    conversation_id = None
    message_count = 0

    try:
        while True:
            # Get user input
            user_message = input("You: ").strip()

            # Check for exit commands
            if user_message.lower() in ['exit', 'quit', 'bye']:
                print("\n👋 Goodbye! Chat session ended.")
                print(f"📊 Total messages: {message_count}")
                break

            # Skip empty messages
            if not user_message:
                continue

            # Send message to agent
            print("\n🤔 Agent is thinking...", end="", flush=True)

            try:
                response = chat(user_message, conversation_id)

                # Save conversation ID for continuity
                conversation_id = response["conversation_id"]
                message_count += 1

                # Clear "thinking" message and display response
                print("\r" + " " * 30 + "\r", end="")  # Clear line
                print(f"🤖 Agent: {response['message']}\n")

            except Exception as e:
                print("\r" + " " * 30 + "\r", end="")  # Clear line
                print(f"❌ Error: {str(e)}\n")

    except KeyboardInterrupt:
        print("\n\n👋 Goodbye! Chat session interrupted.")
        print(f"📊 Total messages: {message_count}")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
