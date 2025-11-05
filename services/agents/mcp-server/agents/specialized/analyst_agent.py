"""Analyst Agent - Data Analysis Specialist"""

from typing import Dict, Any, List
import structlog

from ..base.agent import BaseAgent, AgentConfig, AgentCapability
from ..base.message import TaskRequest, TaskResponse

logger = structlog.get_logger(__name__)


class AnalystAgent(BaseAgent):
    """
    Specialized agent for data analysis and insight generation.

    Capabilities:
    - Analyze research data
    - Identify patterns and trends
    - Generate insights and recommendations
    - Compare and contrast information
    - Statistical analysis

    Usage:
        agent = AnalystAgent(config, message_bus, plugin_manager)
        await agent.start()
    """

    def __init__(self, message_bus, plugin_manager):
        config = AgentConfig(
            name="Analyst Agent",
            description="Analyzes data and generates insights",
            capabilities=[
                AgentCapability.ANALYSIS,
                AgentCapability.SEARCH,
            ],
            max_concurrent_tasks=5,
        )

        super().__init__(
            config=config,
            message_bus=message_bus,
            plugin_manager=plugin_manager
        )

    async def initialize(self) -> None:
        """Initialize the analyst agent"""
        await super().initialize()

        logger.info(
            "analyst_agent_initialized",
            agent_id=self.agent_id
        )

    async def handle_task(self, task: TaskRequest) -> TaskResponse:
        """
        Handle analysis tasks.

        Supported task types:
        - analyze: Analyze data or research results
        - compare: Compare multiple items
        - summarize: Generate summary from data
        - extract_insights: Extract key insights
        - identify_patterns: Identify patterns in data
        """
        logger.info(
            "analysis_task_received",
            task_id=task.task_id,
            task_type=task.task_type
        )

        try:
            if task.task_type == "analyze":
                result = await self._handle_analyze(task)
            elif task.task_type == "compare":
                result = await self._handle_compare(task)
            elif task.task_type == "summarize":
                result = await self._handle_summarize(task)
            elif task.task_type == "extract_insights":
                result = await self._handle_extract_insights(task)
            elif task.task_type == "identify_patterns":
                result = await self._handle_identify_patterns(task)
            else:
                return TaskResponse(
                    task_id=task.task_id,
                    status="failed",
                    error=f"Unknown task type: {task.task_type}"
                )

            return TaskResponse(
                task_id=task.task_id,
                status="success",
                result=result
            )

        except Exception as e:
            logger.error(
                "analysis_task_failed",
                task_id=task.task_id,
                error=str(e),
                exc_info=True
            )

            return TaskResponse(
                task_id=task.task_id,
                status="failed",
                error=str(e)
            )

    async def _handle_analyze(self, task: TaskRequest) -> Dict[str, Any]:
        """Analyze provided data"""
        data = task.parameters.get("data")
        analysis_type = task.parameters.get("analysis_type", "general")

        if not data:
            raise ValueError("Data is required for analysis")

        logger.info("analyzing_data", analysis_type=analysis_type)

        # Perform different types of analysis
        analysis_result = {
            "analysis_type": analysis_type,
            "data_summary": self._summarize_data(data),
            "insights": [],
            "recommendations": [],
        }

        # Extract key information
        if isinstance(data, dict):
            analysis_result["key_metrics"] = self._extract_metrics(data)
            analysis_result["insights"] = self._generate_insights(data)

        elif isinstance(data, list):
            analysis_result["count"] = len(data)
            analysis_result["insights"] = self._analyze_list(data)

        # Generate recommendations
        analysis_result["recommendations"] = self._generate_recommendations(data)

        return analysis_result

    async def _handle_compare(self, task: TaskRequest) -> Dict[str, Any]:
        """Compare multiple items or datasets"""
        items = task.parameters.get("items", [])
        comparison_criteria = task.parameters.get("criteria", [])

        if len(items) < 2:
            raise ValueError("At least 2 items required for comparison")

        logger.info("comparing_items", count=len(items))

        comparison_result = {
            "items_count": len(items),
            "criteria": comparison_criteria,
            "comparisons": [],
            "similarities": [],
            "differences": [],
            "conclusion": "",
        }

        # Perform pairwise comparisons
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                comparison = self._compare_items(
                    items[i],
                    items[j],
                    comparison_criteria
                )
                comparison_result["comparisons"].append(comparison)

        # Identify overall patterns
        comparison_result["similarities"] = self._find_similarities(items)
        comparison_result["differences"] = self._find_differences(items)
        comparison_result["conclusion"] = self._generate_comparison_conclusion(
            comparison_result["similarities"],
            comparison_result["differences"]
        )

        return comparison_result

    async def _handle_summarize(self, task: TaskRequest) -> Dict[str, Any]:
        """Generate summary from data"""
        data = task.parameters.get("data")
        max_length = task.parameters.get("max_length", 500)

        if not data:
            raise ValueError("Data is required for summarization")

        logger.info("summarizing_data")

        summary = {
            "summary": self._create_summary(data, max_length),
            "key_points": self._extract_key_points(data),
            "statistics": self._generate_statistics(data),
        }

        return summary

    async def _handle_extract_insights(self, task: TaskRequest) -> Dict[str, Any]:
        """Extract insights from data"""
        data = task.parameters.get("data")
        user_id = task.context.get("user_id")

        if not data:
            raise ValueError("Data is required for insight extraction")

        logger.info("extracting_insights")

        insights = {
            "insights": self._generate_insights(data),
            "trends": self._identify_trends(data),
            "anomalies": self._detect_anomalies(data),
            "opportunities": self._identify_opportunities(data),
        }

        # Store insights in memory for future reference
        if user_id:
            await self.store_memory(
                content=f"Generated insights from analysis",
                memory_type="long_term",
                user_id=user_id,
                metadata={
                    "type": "insights",
                    "insights_count": len(insights["insights"]),
                }
            )

        return insights

    async def _handle_identify_patterns(self, task: TaskRequest) -> Dict[str, Any]:
        """Identify patterns in data"""
        data = task.parameters.get("data")

        if not data:
            raise ValueError("Data is required for pattern identification")

        logger.info("identifying_patterns")

        patterns = {
            "patterns": self._find_patterns(data),
            "frequency_analysis": self._analyze_frequency(data),
            "correlations": self._find_correlations(data),
        }

        return patterns

    # Helper methods for analysis

    def _summarize_data(self, data: Any) -> str:
        """Create a brief summary of data"""
        if isinstance(data, dict):
            return f"Dictionary with {len(data)} keys"
        elif isinstance(data, list):
            return f"List with {len(data)} items"
        elif isinstance(data, str):
            return f"Text with {len(data)} characters"
        else:
            return f"Data of type {type(data).__name__}"

    def _extract_metrics(self, data: Dict) -> Dict[str, Any]:
        """Extract key metrics from data"""
        metrics = {}

        # Count different types of values
        for key, value in data.items():
            if isinstance(value, (int, float)):
                metrics[key] = value
            elif isinstance(value, list):
                metrics[f"{key}_count"] = len(value)
            elif isinstance(value, dict):
                metrics[f"{key}_size"] = len(value)

        return metrics

    def _generate_insights(self, data: Any) -> List[str]:
        """Generate insights from data"""
        insights = []

        if isinstance(data, dict):
            # Analyze dictionary structure
            if "results" in data or "search_results" in data:
                insights.append("Data contains search or query results")

            if "error" in data:
                insights.append("Data contains error information")

            # Check for temporal data
            time_keys = ["timestamp", "created_at", "updated_at", "date"]
            if any(key in data for key in time_keys):
                insights.append("Data includes temporal information")

        elif isinstance(data, list):
            if len(data) > 10:
                insights.append(f"Large dataset with {len(data)} items")
            elif len(data) == 0:
                insights.append("Empty dataset")

        return insights

    def _analyze_list(self, data: List) -> List[str]:
        """Analyze a list of items"""
        insights = []

        if not data:
            return ["Empty list"]

        # Check item types
        types = set(type(item).__name__ for item in data)
        insights.append(f"Contains {len(types)} different data types: {', '.join(types)}")

        # Check for common structures
        if all(isinstance(item, dict) for item in data):
            # All items are dictionaries
            all_keys = set()
            for item in data:
                all_keys.update(item.keys())
            insights.append(f"Dictionary items with {len(all_keys)} unique keys")

        return insights

    def _generate_recommendations(self, data: Any) -> List[str]:
        """Generate recommendations based on data"""
        recommendations = []

        if isinstance(data, dict):
            if "results" in data and not data["results"]:
                recommendations.append("Consider broadening search criteria")

            if "error" in data:
                recommendations.append("Review and resolve errors before proceeding")

        return recommendations

    def _compare_items(
        self,
        item1: Any,
        item2: Any,
        criteria: List[str]
    ) -> Dict[str, Any]:
        """Compare two items"""
        comparison = {
            "item1_summary": str(item1)[:100],
            "item2_summary": str(item2)[:100],
            "similarities": [],
            "differences": [],
        }

        # Compare based on type
        if type(item1) != type(item2):
            comparison["differences"].append(
                f"Different types: {type(item1).__name__} vs {type(item2).__name__}"
            )
        else:
            comparison["similarities"].append("Same data type")

        # Compare dictionaries
        if isinstance(item1, dict) and isinstance(item2, dict):
            shared_keys = set(item1.keys()) & set(item2.keys())
            if shared_keys:
                comparison["similarities"].append(
                    f"{len(shared_keys)} shared keys"
                )

        return comparison

    def _find_similarities(self, items: List[Any]) -> List[str]:
        """Find similarities across multiple items"""
        if not items:
            return []

        similarities = []

        # Check if all items are same type
        types = set(type(item).__name__ for item in items)
        if len(types) == 1:
            similarities.append(f"All items are {types.pop()}")

        return similarities

    def _find_differences(self, items: List[Any]) -> List[str]:
        """Find differences across multiple items"""
        if len(items) < 2:
            return []

        differences = []

        # Check type differences
        types = set(type(item).__name__ for item in items)
        if len(types) > 1:
            differences.append(f"Multiple data types: {', '.join(types)}")

        return differences

    def _generate_comparison_conclusion(
        self,
        similarities: List[str],
        differences: List[str]
    ) -> str:
        """Generate conclusion from comparison"""
        if not similarities and not differences:
            return "Insufficient data for comparison"

        if len(similarities) > len(differences):
            return "Items are largely similar"
        elif len(differences) > len(similarities):
            return "Items show significant differences"
        else:
            return "Items have both similarities and differences"

    def _create_summary(self, data: Any, max_length: int) -> str:
        """Create a text summary"""
        summary = str(data)
        if len(summary) > max_length:
            summary = summary[:max_length] + "..."
        return summary

    def _extract_key_points(self, data: Any) -> List[str]:
        """Extract key points from data"""
        key_points = []

        if isinstance(data, dict):
            # Top-level keys as key points
            key_points = [f"{k}: {type(v).__name__}" for k, v in list(data.items())[:5]]

        elif isinstance(data, list):
            key_points.append(f"{len(data)} total items")

        return key_points

    def _generate_statistics(self, data: Any) -> Dict[str, Any]:
        """Generate basic statistics"""
        stats = {}

        if isinstance(data, list):
            stats["count"] = len(data)
            if data and isinstance(data[0], (int, float)):
                stats["min"] = min(data)
                stats["max"] = max(data)
                stats["avg"] = sum(data) / len(data)

        return stats

    def _identify_trends(self, data: Any) -> List[str]:
        """Identify trends in data"""
        # Placeholder for trend analysis
        return ["Trend analysis requires time-series data"]

    def _detect_anomalies(self, data: Any) -> List[str]:
        """Detect anomalies in data"""
        # Placeholder for anomaly detection
        return []

    def _identify_opportunities(self, data: Any) -> List[str]:
        """Identify opportunities from data"""
        # Placeholder for opportunity identification
        return []

    def _find_patterns(self, data: Any) -> List[str]:
        """Find patterns in data"""
        patterns = []

        if isinstance(data, list) and len(data) > 3:
            patterns.append(f"Sequential data with {len(data)} items")

        return patterns

    def _analyze_frequency(self, data: Any) -> Dict[str, int]:
        """Analyze frequency of items"""
        frequency = {}

        if isinstance(data, list):
            for item in data:
                key = str(item)
                frequency[key] = frequency.get(key, 0) + 1

        return frequency

    def _find_correlations(self, data: Any) -> List[str]:
        """Find correlations in data"""
        # Placeholder for correlation analysis
        return []
