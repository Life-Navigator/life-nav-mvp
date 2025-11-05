#!/usr/bin/env python3
"""
Start Life Navigator Agent System with Admin Dashboard Tracking

This script:
1. Initializes the AdminTracker
2. Creates the agent hierarchy
3. Runs a demo query
4. Shows metrics being sent to the dashboard

Run:
    python scripts/start_with_dashboard.py

Prerequisites:
- Admin dashboard backend running on http://localhost:8000
- Admin dashboard frontend running on http://localhost:3000
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.core.admin_tracker import init_tracker, get_tracker
from agents.orchestration.orchestrator import Orchestrator, create_agent_hierarchy, shutdown_agent_hierarchy
from models.agent_models import AgentTask, TaskMetadata, TaskPriority
from utils.logging import get_logger

logger = get_logger("startup")


def print_banner():
    """Print startup banner"""
    print("\n" + "=" * 70)
    print("  🚀 Life Navigator Agent System with Admin Dashboard")
    print("=" * 70 + "\n")


async def check_dashboard_connection():
    """Check if admin dashboard backend is reachable"""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:8000/api/admin/v2/health")
            if response.status_code == 200:
                logger.info("✅ Admin dashboard backend is reachable")
                return True
            else:
                logger.warning(f"⚠️  Admin dashboard returned status {response.status_code}")
                return False
    except Exception as e:
        logger.warning(f"⚠️  Cannot reach admin dashboard: {e}")
        logger.info("💡 Start the backend with: uvicorn api_admin_endpoints_v2:app --port 8000")
        return False


async def demo_spending_analysis():
    """Run a demo spending analysis query through the full hierarchy"""

    # Sample data
    SAMPLE_TRANSACTIONS = [
        {"amount": 1500, "category": "housing", "date": "2025-10-01", "description": "Rent"},
        {"amount": 200, "category": "utilities", "date": "2025-10-05", "description": "Electric bill"},
        {"amount": 350, "category": "food", "date": "2025-10-10", "description": "Groceries"},
        {"amount": 150, "category": "entertainment", "date": "2025-10-12", "description": "Concert tickets"},
        {"amount": 80, "category": "transportation", "date": "2025-10-15", "description": "Gas"},
    ]

    SAMPLE_INCOME = [
        {"amount": 5000, "source": "salary", "date": "2025-10-01", "description": "Monthly salary"},
    ]

    logger.info("\n" + "=" * 70)
    logger.info("📊 DEMO: Running Spending Analysis Query")
    logger.info("=" * 70 + "\n")

    # Create agent hierarchy
    logger.info("Creating agent hierarchy...")
    agents = await create_agent_hierarchy()
    orchestrator = agents["orchestrator"]

    # Create task
    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="demo-user-001",
            priority=TaskPriority.NORMAL,
        ),
        task_type="user_query",
        payload={
            "query": "How much did I spend this month?",
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
        },
    )

    logger.info(f"📝 User Query: {task.payload['query']}")
    logger.info(f"📋 Task ID: {task.metadata.task_id}")

    # Execute task
    logger.info("\n⏳ Executing task through agent hierarchy...")
    logger.info("   Orchestrator → FinanceManager → BudgetSpecialist")

    result = await orchestrator.execute_task(task)

    # Display results
    logger.info("\n" + "=" * 70)
    logger.info("✅ RESULTS")
    logger.info("=" * 70)
    logger.info(f"Status: {result['status']}")
    logger.info(f"Duration: {result['duration_ms']:.2f}ms")

    if result["status"] == "success":
        data = result.get("data", {})
        logger.info(f"\n💰 Total Spending: ${data.get('total_spending', 0):.2f}")
        logger.info(f"💵 Total Income: ${data.get('total_income', 0):.2f}")
        logger.info(f"📊 Savings Rate: {data.get('savings_rate', 0)*100:.1f}%")

        if "category_breakdown" in data:
            logger.info(f"\n📂 Category Breakdown:")
            for category, amount in data["category_breakdown"].items():
                logger.info(f"   - {category.title()}: ${amount:.2f}")

    logger.info("\n" + "=" * 70)
    logger.info("📊 DASHBOARD TRACKING")
    logger.info("=" * 70)
    logger.info("✅ Metrics automatically sent to admin dashboard!")
    logger.info("📈 View at: http://localhost:3000")
    logger.info("\nWhat's tracked:")
    logger.info("   • Request ID and task details")
    logger.info("   • User query and intent")
    logger.info("   • Agent routing path (Orchestrator → Finance → Budget)")
    logger.info("   • Reasoning steps from each agent")
    logger.info("   • Performance metrics (latency, tokens, cost)")
    logger.info("   • Success/failure status")

    # Show tracker info
    tracker = get_tracker()
    if tracker and tracker.enabled:
        logger.info(f"\n🔗 Tracker: {tracker.admin_api_url}")
        logger.info(f"🟢 Status: Enabled (async mode: {tracker.async_mode})")
    else:
        logger.info(f"\n🔴 Tracker: Disabled or not initialized")

    # Cleanup
    logger.info("\n🧹 Shutting down agents...")
    await shutdown_agent_hierarchy(agents)


async def main():
    """Main entry point"""

    print_banner()

    # Step 1: Initialize admin tracker
    logger.info("Step 1: Initializing Admin Dashboard Tracker")
    logger.info("-" * 70)

    tracker = init_tracker(
        admin_api_url="http://localhost:8000/api/admin/v2",
        enabled=True
    )

    logger.info(f"✅ Admin tracker initialized")
    logger.info(f"   URL: {tracker.admin_api_url}")
    logger.info(f"   Enabled: {tracker.enabled}")
    logger.info(f"   Async Mode: {tracker.async_mode} (fire-and-forget)")

    # Step 2: Check dashboard connection
    logger.info("\nStep 2: Checking Admin Dashboard Connection")
    logger.info("-" * 70)

    dashboard_available = await check_dashboard_connection()

    if not dashboard_available:
        logger.info("\n⚠️  Dashboard backend not available (continuing anyway)")
        logger.info("   Metrics will be logged but won't reach the dashboard")
        logger.info("\n💡 To enable full tracking:")
        logger.info("   1. Terminal 1: uvicorn api_admin_endpoints_v2:app --port 8000")
        logger.info("   2. Terminal 2: cd admin-dashboard-v2 && npm start")
        logger.info("   3. Terminal 3: python scripts/start_with_dashboard.py")

    # Step 3: Run demo
    logger.info("\nStep 3: Running Agent Demo")
    logger.info("-" * 70)

    await demo_spending_analysis()

    # Cleanup
    logger.info("\n" + "=" * 70)
    logger.info("🎉 DEMO COMPLETE!")
    logger.info("=" * 70)
    logger.info("\n📊 Next Steps:")
    logger.info("   1. Open dashboard: http://localhost:3000")
    logger.info("   2. Navigate to 'Debugging' tab")
    logger.info("   3. Find your request by task ID")
    logger.info("   4. Click to see full reasoning trace")
    logger.info("\n📖 Documentation:")
    logger.info("   • Integration Guide: docs/ADMIN_DASHBOARD_INTEGRATION.md")
    logger.info("   • Deployment Guide: docs/ADMIN_DASHBOARD_V2_GUIDE.md")
    logger.info("   • Quick Start: docs/EXECUTIVE_SUMMARY_V2.md")

    # Close tracker
    if tracker:
        await tracker.close()

    logger.info("\n✅ Shutdown complete!\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n\n⚠️  Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n❌ Error: {e}", error=e)
        sys.exit(1)
