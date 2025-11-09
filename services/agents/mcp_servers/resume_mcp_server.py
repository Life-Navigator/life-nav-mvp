"""
Resume MCP Server
Provides tools for ResumeSpecialist agent to access data across all modules
"""

import asyncio
import httpx
from typing import Dict, List, Any
from mcp.server import Server
from mcp.types import Tool, TextContent
import os


class ResumeMCPServer:
    """MCP Server for Resume Builder - provides tools to access all user data"""

    def __init__(self):
        self.server = Server("resume-builder")
        self.api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
        self.setup_tools()

    def setup_tools(self):
        """Register all MCP tools"""

        # Career Module Tools
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            return [
                Tool(
                    name="get_career_profile",
                    description="Get user's career profile including headline, summary, desired positions, and salary expectations",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string", "description": "User ID"},
                            "token": {"type": "string", "description": "Auth token"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),
                Tool(
                    name="get_job_experiences",
                    description="Get all job experiences for a user with achievements, technologies, and descriptions",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "token": {"type": "string"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),
                Tool(
                    name="get_skills",
                    description="Get user's skills with proficiency levels and categories",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "token": {"type": "string"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),

                # Education Module Tools
                Tool(
                    name="get_education_credentials",
                    description="Get user's education history including degrees, institutions, and GPAs",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "token": {"type": "string"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),
                Tool(
                    name="get_certifications",
                    description="Get user's professional certifications and licenses",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "token": {"type": "string"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),

                # Integration Module Tools
                Tool(
                    name="get_linkedin_data",
                    description="Get user's LinkedIn profile data if connected (optional enhancement)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "token": {"type": "string"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),

                # User Module Tools
                Tool(
                    name="get_user_profile",
                    description="Get basic user profile information (name, email, phone, location)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "token": {"type": "string"}
                        },
                        "required": ["user_id", "token"]
                    }
                ),

                # Job Analysis Tool
                Tool(
                    name="analyze_job_description",
                    description="Extract keywords, requirements, and skills from a job description",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "job_description": {"type": "string", "description": "Full job description text"},
                            "job_title": {"type": "string", "description": "Job title"}
                        },
                        "required": ["job_description"]
                    }
                ),

                # Resume Templates Tool
                Tool(
                    name="get_resume_templates",
                    description="Get available resume templates",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "category": {"type": "string", "description": "Template category filter (optional)"}
                        }
                    }
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Execute MCP tool calls"""

            if name == "get_career_profile":
                return await self._get_career_profile(arguments)
            elif name == "get_job_experiences":
                return await self._get_job_experiences(arguments)
            elif name == "get_skills":
                return await self._get_skills(arguments)
            elif name == "get_education_credentials":
                return await self._get_education_credentials(arguments)
            elif name == "get_certifications":
                return await self._get_certifications(arguments)
            elif name == "get_linkedin_data":
                return await self._get_linkedin_data(arguments)
            elif name == "get_user_profile":
                return await self._get_user_profile(arguments)
            elif name == "analyze_job_description":
                return await self._analyze_job_description(arguments)
            elif name == "get_resume_templates":
                return await self._get_resume_templates(arguments)
            else:
                raise ValueError(f"Unknown tool: {name}")

    # Tool Implementations

    async def _get_career_profile(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch career profile from API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/career/profile",
                headers={"Authorization": f"Bearer {args['token']}"}
            )
            data = response.json()
            return [TextContent(type="text", text=str(data))]

    async def _get_job_experiences(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch job experiences from API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/career/experiences",
                headers={"Authorization": f"Bearer {args['token']}"}
            )
            data = response.json()
            return [TextContent(type="text", text=str(data))]

    async def _get_skills(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch skills from API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/career/skills",
                headers={"Authorization": f"Bearer {args['token']}"}
            )
            data = response.json()
            return [TextContent(type="text", text=str(data))]

    async def _get_education_credentials(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch education credentials from API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/education/credentials",
                headers={"Authorization": f"Bearer {args['token']}"}
            )
            data = response.json()
            return [TextContent(type="text", text=str(data))]

    async def _get_certifications(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch certifications - could come from education or career module"""
        # For now, return empty - implement when certification model exists
        return [TextContent(type="text", text="[]")]

    async def _get_linkedin_data(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch LinkedIn data if integration exists"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/integrations/user",
                    headers={"Authorization": f"Bearer {args['token']}"},
                    params={"platform_id": "linkedin"}
                )
                data = response.json()
                return [TextContent(type="text", text=str(data))]
            except Exception as e:
                # Specific exception caught for better error handling
                return [TextContent(type="text", text="LinkedIn not connected")]

    async def _get_user_profile(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch basic user profile"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/users/me",
                headers={"Authorization": f"Bearer {args['token']}"}
            )
            data = response.json()
            return [TextContent(type="text", text=str(data))]

    async def _analyze_job_description(self, args: Dict[str, Any]) -> List[TextContent]:
        """Analyze job description to extract keywords and requirements"""
        job_desc = args["job_description"]
        job_title = args.get("job_title", "")

        # Simple keyword extraction (can be enhanced with NLP)
        import re

        # Common skill keywords
        skills_pattern = r'\b(Python|Java|JavaScript|React|Node\.js|SQL|AWS|Docker|Kubernetes|Git|CI/CD|Agile|Scrum|Leadership|Communication|Problem Solving|Team Management|Project Management)\b'
        found_skills = list(set(re.findall(skills_pattern, job_desc, re.IGNORECASE)))

        # Experience requirements
        exp_pattern = r'(\d+)\+?\s*years?\s*(?:of)?\s*experience'
        exp_matches = re.findall(exp_pattern, job_desc, re.IGNORECASE)
        min_experience = int(exp_matches[0]) if exp_matches else 0

        # Education requirements
        edu_keywords = ['bachelor', 'master', 'phd', 'degree', 'bs', 'ms', 'mba']
        education_required = any(keyword in job_desc.lower() for keyword in edu_keywords)

        analysis = {
            "keywords": found_skills,
            "min_experience_years": min_experience,
            "education_required": education_required,
            "job_title": job_title,
            "description_length": len(job_desc)
        }

        return [TextContent(type="text", text=str(analysis))]

    async def _get_resume_templates(self, args: Dict[str, Any]) -> List[TextContent]:
        """Fetch available resume templates"""
        async with httpx.AsyncClient() as client:
            params = {}
            if "category" in args:
                params["category"] = args["category"]

            response = await client.get(
                f"{self.api_base_url}/career/resume-templates",
                params=params
            )
            data = response.json()
            return [TextContent(type="text", text=str(data))]

    async def run(self):
        """Run the MCP server"""
        from mcp.server.stdio import stdio_server

        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )


# Entry point for MCP server
async def main():
    server = ResumeMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())
