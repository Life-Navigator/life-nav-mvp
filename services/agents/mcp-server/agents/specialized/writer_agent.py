"""Writer Agent - Content Generation Specialist"""

from typing import Dict, Any, List, Optional
import structlog

from ..base.agent import BaseAgent, AgentConfig, AgentCapability
from ..base.message import TaskRequest, TaskResponse

logger = structlog.get_logger(__name__)


class WriterAgent(BaseAgent):
    """
    Specialized agent for content generation and writing.

    Capabilities:
    - Generate written content from data
    - Create summaries and reports
    - Format and structure content
    - Generate responses and explanations
    - Create documentation

    Usage:
        agent = WriterAgent(config, message_bus, plugin_manager)
        await agent.start()
    """

    def __init__(self, message_bus, plugin_manager):
        config = AgentConfig(
            name="Writer Agent",
            description="Generates written content and documentation",
            capabilities=[
                AgentCapability.WRITING,
            ],
            max_concurrent_tasks=5,
        )

        super().__init__(
            config=config,
            message_bus=message_bus,
            plugin_manager=plugin_manager
        )

    async def initialize(self) -> None:
        """Initialize the writer agent"""
        await super().initialize()

        logger.info(
            "writer_agent_initialized",
            agent_id=self.agent_id
        )

    async def handle_task(self, task: TaskRequest) -> TaskResponse:
        """
        Handle writing tasks.

        Supported task types:
        - write: Generate content
        - summarize: Create summary
        - report: Generate report
        - explain: Create explanation
        - format: Format content
        """
        logger.info(
            "writing_task_received",
            task_id=task.task_id,
            task_type=task.task_type
        )

        try:
            if task.task_type == "write":
                result = await self._handle_write(task)
            elif task.task_type == "summarize":
                result = await self._handle_summarize(task)
            elif task.task_type == "report":
                result = await self._handle_report(task)
            elif task.task_type == "explain":
                result = await self._handle_explain(task)
            elif task.task_type == "format":
                result = await self._handle_format(task)
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
                "writing_task_failed",
                task_id=task.task_id,
                error=str(e),
                exc_info=True
            )

            return TaskResponse(
                task_id=task.task_id,
                status="failed",
                error=str(e)
            )

    async def _handle_write(self, task: TaskRequest) -> Dict[str, Any]:
        """Generate written content"""
        topic = task.parameters.get("topic")
        content_type = task.parameters.get("content_type", "general")
        data = task.parameters.get("data")
        style = task.parameters.get("style", "professional")
        length = task.parameters.get("length", "medium")  # short, medium, long

        if not topic and not data:
            raise ValueError("Topic or data is required for writing")

        logger.info("generating_content", topic=topic, content_type=content_type)

        # Generate content based on type
        if content_type == "introduction":
            content = self._write_introduction(topic, data)
        elif content_type == "conclusion":
            content = self._write_conclusion(topic, data)
        elif content_type == "paragraph":
            content = self._write_paragraph(topic, data, style)
        elif content_type == "list":
            content = self._write_list(topic, data)
        else:
            content = self._write_general(topic, data, style, length)

        return {
            "topic": topic,
            "content_type": content_type,
            "content": content,
            "word_count": len(content.split()),
            "style": style,
        }

    async def _handle_summarize(self, task: TaskRequest) -> Dict[str, Any]:
        """Create a summary"""
        data = task.parameters.get("data")
        max_length = task.parameters.get("max_length", 200)
        format_type = task.parameters.get("format", "paragraph")  # paragraph, bullets

        if not data:
            raise ValueError("Data is required for summarization")

        logger.info("creating_summary", format=format_type)

        if format_type == "bullets":
            summary = self._create_bullet_summary(data, max_length)
        else:
            summary = self._create_paragraph_summary(data, max_length)

        return {
            "summary": summary,
            "format": format_type,
            "length": len(summary),
        }

    async def _handle_report(self, task: TaskRequest) -> Dict[str, Any]:
        """Generate a report"""
        title = task.parameters.get("title", "Analysis Report")
        data = task.parameters.get("data")
        sections = task.parameters.get("sections", ["summary", "findings", "recommendations"])

        if not data:
            raise ValueError("Data is required for report generation")

        logger.info("generating_report", title=title)

        report = self._generate_report(title, data, sections)

        return {
            "title": title,
            "report": report,
            "sections": sections,
            "word_count": len(report.split()),
        }

    async def _handle_explain(self, task: TaskRequest) -> Dict[str, Any]:
        """Create an explanation"""
        topic = task.parameters.get("topic")
        data = task.parameters.get("data")
        audience = task.parameters.get("audience", "general")  # general, technical, beginner
        detail_level = task.parameters.get("detail_level", "medium")

        if not topic and not data:
            raise ValueError("Topic or data is required for explanation")

        logger.info("creating_explanation", topic=topic, audience=audience)

        explanation = self._create_explanation(topic, data, audience, detail_level)

        return {
            "topic": topic,
            "explanation": explanation,
            "audience": audience,
            "detail_level": detail_level,
        }

    async def _handle_format(self, task: TaskRequest) -> Dict[str, Any]:
        """Format content"""
        content = task.parameters.get("content")
        format_type = task.parameters.get("format", "markdown")
        options = task.parameters.get("options", {})

        if not content:
            raise ValueError("Content is required for formatting")

        logger.info("formatting_content", format=format_type)

        if format_type == "markdown":
            formatted = self._format_markdown(content, options)
        elif format_type == "html":
            formatted = self._format_html(content, options)
        elif format_type == "plain":
            formatted = self._format_plain(content)
        else:
            formatted = str(content)

        return {
            "content": formatted,
            "format": format_type,
        }

    # Content generation helpers

    def _write_introduction(self, topic: str, data: Any) -> str:
        """Write an introduction"""
        if data:
            return f"This document presents an analysis of {topic}. " \
                   f"The following information is based on comprehensive research and data analysis."
        else:
            return f"Introduction to {topic}. " \
                   f"This topic encompasses several important aspects worth exploring."

    def _write_conclusion(self, topic: str, data: Any) -> str:
        """Write a conclusion"""
        return f"In conclusion, the analysis of {topic} reveals important insights. " \
               f"The findings suggest areas for further investigation and potential applications."

    def _write_paragraph(self, topic: str, data: Any, style: str) -> str:
        """Write a paragraph"""
        if isinstance(data, dict):
            points = [f"{k}: {v}" for k, v in list(data.items())[:3]]
            content = ". ".join(points)
            return f"Regarding {topic}, the analysis shows: {content}."
        elif isinstance(data, list):
            return f"{topic} involves multiple elements including: {', '.join(str(x) for x in data[:5])}."
        else:
            return f"The topic of {topic} is an important area of study with various applications."

    def _write_list(self, topic: str, data: Any) -> str:
        """Write a formatted list"""
        items = []

        if isinstance(data, list):
            items = [f"- {item}" for item in data[:10]]
        elif isinstance(data, dict):
            items = [f"- {k}: {v}" for k, v in list(data.items())[:10]]
        else:
            items = [f"- {topic}"]

        return "\n".join(items)

    def _write_general(self, topic: str, data: Any, style: str, length: str) -> str:
        """Write general content"""
        intro = self._write_introduction(topic, data)
        body = self._write_paragraph(topic, data, style)
        conclusion = self._write_conclusion(topic, data)

        if length == "short":
            return body
        elif length == "long":
            return f"{intro}\n\n{body}\n\n{body}\n\n{conclusion}"
        else:  # medium
            return f"{intro}\n\n{body}\n\n{conclusion}"

    def _create_bullet_summary(self, data: Any, max_length: int) -> str:
        """Create a bullet-point summary"""
        bullets = []

        if isinstance(data, dict):
            for key, value in list(data.items())[:5]:
                if isinstance(value, (list, dict)):
                    bullets.append(f"- {key}: {type(value).__name__} with {len(value)} items")
                else:
                    bullets.append(f"- {key}: {str(value)[:50]}")

        elif isinstance(data, list):
            bullets.append(f"- Total items: {len(data)}")
            if data:
                bullets.append(f"- Item type: {type(data[0]).__name__}")

        summary = "\n".join(bullets)

        if len(summary) > max_length:
            summary = summary[:max_length] + "..."

        return summary

    def _create_paragraph_summary(self, data: Any, max_length: int) -> str:
        """Create a paragraph summary"""
        if isinstance(data, dict):
            summary = f"The data contains {len(data)} key elements. "

            if "results" in data:
                results = data["results"]
                if isinstance(results, list):
                    summary += f"It includes {len(results)} results. "

            if "insights" in data:
                summary += "Key insights have been identified. "

        elif isinstance(data, list):
            summary = f"The dataset contains {len(data)} items. "

            if data and isinstance(data[0], dict):
                keys = set()
                for item in data[:5]:
                    keys.update(item.keys())
                summary += f"Each item has attributes including: {', '.join(list(keys)[:3])}. "

        else:
            summary = str(data)[:max_length]

        if len(summary) > max_length:
            summary = summary[:max_length].rsplit(' ', 1)[0] + "..."

        return summary

    def _generate_report(self, title: str, data: Any, sections: List[str]) -> str:
        """Generate a formatted report"""
        report_parts = [f"# {title}\n"]

        for section in sections:
            report_parts.append(f"\n## {section.title()}\n")

            if section == "summary":
                report_parts.append(self._create_paragraph_summary(data, 300))
            elif section == "findings":
                report_parts.append(self._generate_findings(data))
            elif section == "recommendations":
                report_parts.append(self._generate_recommendations_section(data))
            elif section == "data":
                report_parts.append(self._format_data_section(data))
            else:
                report_parts.append(f"Content for {section} section.\n")

        return "\n".join(report_parts)

    def _generate_findings(self, data: Any) -> str:
        """Generate findings section"""
        findings = []

        if isinstance(data, dict):
            if "insights" in data:
                insights = data["insights"]
                if isinstance(insights, list):
                    findings.extend([f"- {insight}" for insight in insights[:5]])

            if "analysis" in data:
                findings.append(f"- Analysis indicates: {data['analysis']}")

        if not findings:
            findings = ["- Comprehensive analysis completed", "- Data patterns identified"]

        return "\n".join(findings)

    def _generate_recommendations_section(self, data: Any) -> str:
        """Generate recommendations section"""
        recommendations = []

        if isinstance(data, dict) and "recommendations" in data:
            recs = data["recommendations"]
            if isinstance(recs, list):
                recommendations.extend([f"- {rec}" for rec in recs[:5]])

        if not recommendations:
            recommendations = [
                "- Continue monitoring trends",
                "- Gather additional data for deeper analysis",
                "- Implement findings in decision-making processes"
            ]

        return "\n".join(recommendations)

    def _format_data_section(self, data: Any) -> str:
        """Format data section"""
        if isinstance(data, dict):
            return self._create_bullet_summary(data, 500)
        elif isinstance(data, list):
            return f"Dataset contains {len(data)} entries"
        else:
            return str(data)[:500]

    def _create_explanation(
        self,
        topic: str,
        data: Any,
        audience: str,
        detail_level: str
    ) -> str:
        """Create an explanation"""
        if audience == "beginner":
            intro = f"{topic} can be understood as follows: "
        elif audience == "technical":
            intro = f"Technical overview of {topic}: "
        else:
            intro = f"Explanation of {topic}: "

        if detail_level == "high" and data:
            detail = f"\n\nDetailed information:\n{self._create_bullet_summary(data, 400)}"
        else:
            detail = ""

        body = self._write_paragraph(topic, data, "explanatory")

        return intro + body + detail

    def _format_markdown(self, content: Any, options: Dict) -> str:
        """Format as markdown"""
        if isinstance(content, dict):
            # Convert dict to markdown table or list
            lines = ["| Key | Value |", "|-----|-------|"]
            for k, v in list(content.items())[:20]:
                lines.append(f"| {k} | {v} |")
            return "\n".join(lines)
        elif isinstance(content, list):
            return "\n".join([f"- {item}" for item in content])
        else:
            return str(content)

    def _format_html(self, content: Any, options: Dict) -> str:
        """Format as HTML"""
        if isinstance(content, dict):
            items = "".join([f"<li><strong>{k}:</strong> {v}</li>" for k, v in list(content.items())[:20]])
            return f"<ul>{items}</ul>"
        elif isinstance(content, list):
            items = "".join([f"<li>{item}</li>" for item in content])
            return f"<ul>{items}</ul>"
        else:
            return f"<p>{content}</p>"

    def _format_plain(self, content: Any) -> str:
        """Format as plain text"""
        return str(content)
