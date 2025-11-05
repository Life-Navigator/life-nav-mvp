"""Job Search Specialist Agent.

This L2 specialist agent handles all job search-related tasks including job matching,
application tracking, market analysis, and interview preparation.

Capabilities:
    - job_matching: Match user profile with job requirements
    - application_tracking: Track and manage job applications
    - market_analysis: Analyze job market trends and opportunities
    - job_recommendations: Recommend jobs based on skills and preferences
    - application_insights: Provide insights on application success rates
    - interview_preparation: Suggest preparation steps for upcoming interviews

Dependencies:
    - LLM for generating personalized insights and recommendations
    - AdminTracker for metrics collection
    - BaseAgent for core agent functionality

Example usage:
    >>> agent = JobSearchSpecialist()
    >>> task = AgentTask(
    ...     task_id="job_001",
    ...     task_type="job_matching",
    ...     user_id="user_123",
    ...     payload={
    ...         "skills": ["Python", "Machine Learning", "AWS"],
    ...         "experience_years": 5,
    ...         "job_posting": {
    ...             "title": "Senior ML Engineer",
    ...             "required_skills": ["Python", "TensorFlow", "AWS", "Docker"],
    ...             "experience_required": "3-7 years"
    ...         }
    ...     }
    ... )
    >>> result = await agent.handle_task(task)
    >>> print(result["match_score"])
    85.5
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from agents.core.base_agent import BaseAgent
from models.agent_models import AgentCapability, AgentTask, AgentType
from utils.admin_tracker import track_metrics
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class JobSearchSpecialist(BaseAgent):
    """L2 Specialist Agent for job search and application management.

    This agent provides comprehensive job search support including matching,
    tracking, market analysis, and interview preparation. It helps users find
    suitable opportunities and manage their job search process effectively.

    Attributes:
        llm_client: Client for LLM-based insight generation.
        capabilities: List of agent capabilities with confidence scores.
    """

    def __init__(
        self,
        agent_id: str = "job_search_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize the JobSearchSpecialist agent.

        Args:
            agent_id: Unique identifier for this agent instance.
            message_bus: Optional message bus for agent communication.
            graphrag_client: Optional GraphRAG client.
            vllm_client: Optional vLLM client for generating insights.
            mcp_client: Optional MCP client for fetching live data.
            config: Optional configuration dict.
        """
        capabilities = [
            AgentCapability(
                name="job_matching",
                description="Match user profile with job requirements",
                confidence=0.93,
            ),
            AgentCapability(
                name="application_tracking",
                description="Track and manage job applications",
                confidence=0.95,
            ),
            AgentCapability(
                name="market_analysis",
                description="Analyze job market trends and opportunities",
                confidence=0.88,
            ),
            AgentCapability(
                name="job_recommendations",
                description="Recommend jobs based on skills and preferences",
                confidence=0.91,
            ),
            AgentCapability(
                name="application_insights",
                description="Provide insights on application success rates",
                confidence=0.89,
            ),
            AgentCapability(
                name="interview_preparation",
                description="Suggest preparation steps for upcoming interviews",
                confidence=0.90,
            ),
        ]

        super().__init__(
            agent_id=agent_id,
            agent_type=AgentType.SPECIALIST,
            capabilities=capabilities,
            message_bus=message_bus,
            graphrag_client=graphrag_client,
            vllm_client=vllm_client,
            mcp_client=mcp_client,
            config=config or {},
        )

        self.logger = get_logger(f"agent.{agent_id}")

    @track_metrics
    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """Route and handle job search-related tasks.

        Args:
            task: The task to handle with type and payload.

        Returns:
            Dict containing task results.

        Raises:
            ValueError: If task_type is not supported.
        """
        task_type = task.task_type
        user_id = task.user_id

        if task_type == "job_matching":
            return await self._match_job(user_id, task.payload)
        elif task_type == "application_tracking":
            return await self._track_applications(user_id, task.payload)
        elif task_type == "market_analysis":
            return await self._analyze_market(user_id, task.payload)
        elif task_type == "job_recommendations":
            return await self._recommend_jobs(user_id, task.payload)
        elif task_type == "application_insights":
            return await self._generate_application_insights(user_id, task.payload)
        elif task_type == "interview_preparation":
            return await self._prepare_for_interview(user_id, task.payload)
        else:
            raise ValueError(f"Unsupported task type: {task_type}")

    # -------------------------------------------------------------------------
    # Job Matching
    # -------------------------------------------------------------------------

    async def _match_job(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Match user profile against job requirements.

        Expected payload:
            {
                "user_profile": {
                    "skills": ["Python", "ML", ...],
                    "experience_years": int,
                    "education": str,
                    "certifications": [str],
                    "location": str,
                    "salary_expectation": float (optional)
                },
                "job_posting": {
                    "title": str,
                    "required_skills": [str],
                    "preferred_skills": [str],
                    "experience_required": str (e.g., "3-5 years"),
                    "education_required": str,
                    "location": str,
                    "remote": bool,
                    "salary_range": {"min": float, "max": float}
                }
            }

        Returns:
            Dict with match score and detailed analysis.
        """
        user_profile = payload.get("user_profile", {})
        job_posting = payload.get("job_posting", {})

        if not user_profile or not job_posting:
            return {
                "success": False,
                "error": "Both user_profile and job_posting are required",
            }

        # Extract user data
        user_skills = set(s.lower() for s in user_profile.get("skills", []))
        user_experience = int(user_profile.get("experience_years", 0))
        user_education = user_profile.get("education", "").lower()
        user_certs = set(c.lower() for c in user_profile.get("certifications", []))
        user_location = user_profile.get("location", "").lower()
        user_salary_expectation = user_profile.get("salary_expectation")

        # Extract job data
        required_skills = set(s.lower() for s in job_posting.get("required_skills", []))
        preferred_skills = set(s.lower() for s in job_posting.get("preferred_skills", []))
        experience_required = job_posting.get("experience_required", "0-1 years")
        education_required = job_posting.get("education_required", "").lower()
        job_location = job_posting.get("location", "").lower()
        is_remote = job_posting.get("remote", False)
        salary_range = job_posting.get("salary_range", {})

        # Calculate match components
        match_components = {}

        # 1. Skills match (40% weight)
        required_match = len(user_skills & required_skills) / len(required_skills) if required_skills else 1.0
        preferred_match = len(user_skills & preferred_skills) / len(preferred_skills) if preferred_skills else 0.5
        skills_score = (required_match * 0.8 + preferred_match * 0.2) * 100
        match_components["skills"] = {
            "score": round(skills_score, 2),
            "required_matched": list(user_skills & required_skills),
            "required_missing": list(required_skills - user_skills),
            "preferred_matched": list(user_skills & preferred_skills),
            "weight": 40,
        }

        # 2. Experience match (25% weight)
        exp_min, exp_max = self._parse_experience_range(experience_required)
        if user_experience < exp_min:
            experience_score = max(0, (user_experience / exp_min) * 100)
            experience_status = "below_requirement"
        elif user_experience > exp_max:
            # Slight penalty for overqualification
            experience_score = max(85, 100 - (user_experience - exp_max) * 5)
            experience_status = "overqualified"
        else:
            experience_score = 100
            experience_status = "perfect_match"

        match_components["experience"] = {
            "score": round(experience_score, 2),
            "user_years": user_experience,
            "required_range": f"{exp_min}-{exp_max} years",
            "status": experience_status,
            "weight": 25,
        }

        # 3. Education match (15% weight)
        education_levels = {
            "high school": 1,
            "associate": 2,
            "bachelor": 3,
            "master": 4,
            "phd": 5,
            "doctorate": 5,
        }

        user_level = 0
        for edu_key, level in education_levels.items():
            if edu_key in user_education:
                user_level = max(user_level, level)

        required_level = 0
        for edu_key, level in education_levels.items():
            if edu_key in education_required:
                required_level = max(required_level, level)

        if user_level >= required_level:
            education_score = 100
            education_status = "meets_requirement"
        elif user_level == required_level - 1:
            education_score = 75
            education_status = "close_match"
        else:
            education_score = max(0, 50 - (required_level - user_level) * 15)
            education_status = "below_requirement"

        match_components["education"] = {
            "score": round(education_score, 2),
            "user_education": user_profile.get("education", "Not specified"),
            "required_education": job_posting.get("education_required", "Not specified"),
            "status": education_status,
            "weight": 15,
        }

        # 4. Location match (10% weight)
        if is_remote:
            location_score = 100
            location_status = "remote_available"
        elif user_location and job_location:
            if user_location in job_location or job_location in user_location:
                location_score = 100
                location_status = "location_match"
            else:
                location_score = 30  # Possible relocation
                location_status = "relocation_required"
        else:
            location_score = 50  # Unknown
            location_status = "not_specified"

        match_components["location"] = {
            "score": round(location_score, 2),
            "user_location": user_location or "Not specified",
            "job_location": job_location or "Not specified",
            "remote_available": is_remote,
            "status": location_status,
            "weight": 10,
        }

        # 5. Salary match (10% weight)
        if user_salary_expectation and salary_range:
            salary_min = salary_range.get("min", 0)
            salary_max = salary_range.get("max", 0)

            if salary_min <= user_salary_expectation <= salary_max:
                salary_score = 100
                salary_status = "within_range"
            elif user_salary_expectation < salary_min:
                # User expects less - still good match
                salary_score = 90
                salary_status = "below_range"
            else:
                # User expects more than max
                overage_pct = (user_salary_expectation - salary_max) / salary_max
                salary_score = max(0, 100 - (overage_pct * 100))
                salary_status = "above_range"
        else:
            salary_score = 50
            salary_status = "not_specified"

        match_components["salary"] = {
            "score": round(salary_score, 2),
            "user_expectation": user_salary_expectation,
            "job_range": salary_range,
            "status": salary_status,
            "weight": 10,
        }

        # Calculate overall match score (weighted average)
        total_score = (
            match_components["skills"]["score"] * 0.40
            + match_components["experience"]["score"] * 0.25
            + match_components["education"]["score"] * 0.15
            + match_components["location"]["score"] * 0.10
            + match_components["salary"]["score"] * 0.10
        )

        # Determine match quality
        if total_score >= 85:
            match_quality = "excellent"
        elif total_score >= 70:
            match_quality = "good"
        elif total_score >= 55:
            match_quality = "fair"
        else:
            match_quality = "poor"

        # Generate LLM insights
        insights = await self._generate_match_insights(
            user_id, job_posting, match_components, total_score
        )

        return {
            "success": True,
            "match_score": round(total_score, 2),
            "match_quality": match_quality,
            "job_title": job_posting.get("title", "Unknown"),
            "match_components": match_components,
            "recommendation": total_score >= 70,
            "insights": insights,
        }

    def _parse_experience_range(self, experience_str: str) -> tuple[int, int]:
        """Parse experience requirement string into min/max years.

        Args:
            experience_str: String like "3-5 years" or "5+ years"

        Returns:
            Tuple of (min_years, max_years)
        """
        import re

        # Try to find numbers
        numbers = re.findall(r"\d+", experience_str)

        if not numbers:
            return (0, 2)  # Entry level default

        if len(numbers) == 1:
            num = int(numbers[0])
            if "+" in experience_str:
                return (num, num + 10)  # e.g., "5+" -> 5-15
            else:
                return (num, num + 2)  # e.g., "3 years" -> 3-5
        else:
            return (int(numbers[0]), int(numbers[1]))

    async def _generate_match_insights(
        self,
        user_id: str,
        job: Dict[str, Any],
        components: Dict[str, Any],
        score: float,
    ) -> str:
        """Generate job match insights using LLM.

        Args:
            user_id: User identifier.
            job: Job posting details.
            components: Match component breakdown.
            score: Overall match score.

        Returns:
            Human-readable insights about the match.
        """
        job_title = job.get("title", "Unknown Position")
        missing_skills = components["skills"]["required_missing"]
        exp_status = components["experience"]["status"]

        prompt = f"""You are a career advisor analyzing a job match. Provide brief, actionable advice (2-3 sentences):

Job: {job_title}
Match Score: {score:.1f}/100
Missing Required Skills: {', '.join(missing_skills) if missing_skills else 'None'}
Experience Status: {exp_status}

Should the candidate apply? What should they emphasize or improve?"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if score >= 85:
                return f"Excellent match for {job_title}! Your profile aligns strongly with the requirements. Apply soon and emphasize your matching skills in your application."
            elif score >= 70:
                if missing_skills:
                    return f"Good match for {job_title}. Consider addressing missing skills ({', '.join(missing_skills[:2])}) in your cover letter or through quick online courses before applying."
                else:
                    return f"Good match for {job_title}. Your profile meets most requirements. Apply and highlight your relevant experience and skills."
            else:
                return f"This role may be a stretch for your current profile. Consider building skills in {', '.join(missing_skills[:3])} before applying, or focus on better-matched opportunities."

    # -------------------------------------------------------------------------
    # Application Tracking
    # -------------------------------------------------------------------------

    async def _track_applications(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Track and analyze job applications.

        Expected payload:
            {
                "applications": [
                    {
                        "job_title": str,
                        "company": str,
                        "applied_date": str (YYYY-MM-DD),
                        "status": str ("applied", "screening", "interview", "offer", "rejected"),
                        "last_updated": str (YYYY-MM-DD),
                        "notes": str (optional)
                    }
                ]
            }

        Returns:
            Dict with application statistics and actionable insights.
        """
        applications = payload.get("applications", [])

        if not applications:
            return {
                "success": False,
                "error": "No applications provided",
            }

        # Categorize applications by status
        status_counts = {
            "applied": 0,
            "screening": 0,
            "interview": 0,
            "offer": 0,
            "rejected": 0,
        }

        today = datetime.now()
        total_applications = len(applications)
        pending_response = 0
        needs_follow_up = []

        for app in applications:
            status = app.get("status", "applied").lower()
            status_counts[status] = status_counts.get(status, 0) + 1

            # Check if needs follow-up (no update in 2 weeks)
            last_updated_str = app.get("last_updated", app.get("applied_date"))
            try:
                last_updated = datetime.strptime(last_updated_str, "%Y-%m-%d")
                days_since_update = (today - last_updated).days

                if status in ["applied", "screening"] and days_since_update > 14:
                    needs_follow_up.append({
                        "job_title": app.get("job_title"),
                        "company": app.get("company"),
                        "days_since_update": days_since_update,
                        "status": status,
                    })
            except (ValueError, TypeError):
                pass

            if status in ["applied", "screening", "interview"]:
                pending_response += 1

        # Calculate success rates
        total_responses = status_counts["screening"] + status_counts["interview"] + status_counts["offer"]
        response_rate = (total_responses / total_applications * 100) if total_applications > 0 else 0

        total_outcomes = status_counts["offer"] + status_counts["rejected"]
        success_rate = (status_counts["offer"] / total_outcomes * 100) if total_outcomes > 0 else 0

        interview_rate = (status_counts["interview"] / total_applications * 100) if total_applications > 0 else 0

        # Determine overall health
        if response_rate >= 30 and success_rate >= 20:
            health = "excellent"
        elif response_rate >= 20 or success_rate >= 10:
            health = "good"
        elif response_rate >= 10:
            health = "fair"
        else:
            health = "needs_improvement"

        # Generate insights
        insights = await self._generate_tracking_insights(
            user_id, total_applications, response_rate, success_rate, len(needs_follow_up)
        )

        return {
            "success": True,
            "total_applications": total_applications,
            "status_breakdown": status_counts,
            "pending_response": pending_response,
            "response_rate": round(response_rate, 2),
            "interview_rate": round(interview_rate, 2),
            "success_rate": round(success_rate, 2),
            "application_health": health,
            "needs_follow_up": needs_follow_up[:5],  # Top 5 oldest
            "insights": insights,
        }

    async def _generate_tracking_insights(
        self,
        user_id: str,
        total: int,
        response_rate: float,
        success_rate: float,
        follow_up_count: int,
    ) -> str:
        """Generate application tracking insights using LLM.

        Args:
            user_id: User identifier.
            total: Total applications.
            response_rate: Response rate percentage.
            success_rate: Success rate percentage.
            follow_up_count: Number of applications needing follow-up.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a career advisor analyzing job application performance. Provide brief, actionable advice (2-3 sentences):

Total Applications: {total}
Response Rate: {response_rate:.1f}% (Industry avg: 20-30%)
Success Rate: {success_rate:.1f}% (Industry avg: 10-20%)
Pending Follow-ups: {follow_up_count}

What specific actions should they take to improve results?"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if response_rate < 20:
                return f"Your {response_rate:.1f}% response rate is below average. Review your resume and cover letters—they may not be effectively highlighting your qualifications. Consider tailoring each application more carefully."
            elif follow_up_count > 3:
                return f"You have {follow_up_count} applications pending follow-up. Send polite follow-up emails to show continued interest and stay top of mind with recruiters."
            elif success_rate >= 20:
                return f"Excellent {success_rate:.1f}% success rate! Your interview performance is strong. Keep applying to high-quality matches and maintain this momentum."
            else:
                return f"With {total} applications and a {response_rate:.1f}% response rate, you're making good progress. Continue applying consistently while refining your approach based on feedback."

    # -------------------------------------------------------------------------
    # Market Analysis
    # -------------------------------------------------------------------------

    async def _analyze_market(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze job market trends for specific roles or industries.

        Expected payload:
            {
                "job_title": str (optional),
                "industry": str (optional),
                "location": str (optional),
                "market_data": [  # Sample job postings
                    {
                        "title": str,
                        "company": str,
                        "salary_range": {"min": float, "max": float},
                        "required_skills": [str],
                        "experience_required": str,
                        "remote": bool,
                        "posted_date": str
                    }
                ]
            }

        Returns:
            Dict with market insights including salary ranges, demand, skills.
        """
        job_title = payload.get("job_title", "").lower()
        industry = payload.get("industry", "").lower()
        location = payload.get("location", "").lower()
        market_data = payload.get("market_data", [])

        if not market_data:
            return {
                "success": False,
                "error": "No market data provided",
            }

        # Analyze salary ranges
        salaries = []
        for job in market_data:
            salary_range = job.get("salary_range", {})
            if salary_range:
                salary_min = salary_range.get("min", 0)
                salary_max = salary_range.get("max", 0)
                if salary_min > 0 and salary_max > 0:
                    avg_salary = (salary_min + salary_max) / 2
                    salaries.append({
                        "min": salary_min,
                        "max": salary_max,
                        "avg": avg_salary,
                    })

        if salaries:
            avg_min = sum(s["min"] for s in salaries) / len(salaries)
            avg_max = sum(s["max"] for s in salaries) / len(salaries)
            median_avg = sorted([s["avg"] for s in salaries])[len(salaries) // 2]

            salary_analysis = {
                "average_min": round(avg_min, 2),
                "average_max": round(avg_max, 2),
                "median": round(median_avg, 2),
                "sample_size": len(salaries),
            }
        else:
            salary_analysis = {
                "average_min": None,
                "average_max": None,
                "median": None,
                "sample_size": 0,
            }

        # Analyze skill demand
        skill_counts = {}
        for job in market_data:
            required_skills = job.get("required_skills", [])
            for skill in required_skills:
                skill_lower = skill.lower()
                skill_counts[skill_lower] = skill_counts.get(skill_lower, 0) + 1

        # Get top 10 most demanded skills
        top_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        top_skills_list = [
            {"skill": skill, "demand_count": count, "percentage": round((count / len(market_data)) * 100, 1)}
            for skill, count in top_skills
        ]

        # Analyze remote work availability
        remote_count = sum(1 for job in market_data if job.get("remote", False))
        remote_percentage = (remote_count / len(market_data) * 100) if market_data else 0

        # Analyze experience requirements
        experience_distribution = {
            "entry_level": 0,  # 0-2 years
            "mid_level": 0,    # 3-5 years
            "senior": 0,       # 6-10 years
            "lead": 0,         # 11+ years
        }

        for job in market_data:
            exp_str = job.get("experience_required", "")
            exp_min, exp_max = self._parse_experience_range(exp_str)
            avg_exp = (exp_min + exp_max) / 2

            if avg_exp <= 2:
                experience_distribution["entry_level"] += 1
            elif avg_exp <= 5:
                experience_distribution["mid_level"] += 1
            elif avg_exp <= 10:
                experience_distribution["senior"] += 1
            else:
                experience_distribution["lead"] += 1

        # Generate insights
        insights = await self._generate_market_insights(
            user_id, job_title or industry, len(market_data), salary_analysis, top_skills_list[:5]
        )

        return {
            "success": True,
            "job_title": job_title or "Not specified",
            "industry": industry or "Not specified",
            "location": location or "Not specified",
            "total_positions_analyzed": len(market_data),
            "salary_analysis": salary_analysis,
            "top_demanded_skills": top_skills_list,
            "remote_availability": {
                "remote_count": remote_count,
                "percentage": round(remote_percentage, 2),
            },
            "experience_distribution": experience_distribution,
            "insights": insights,
        }

    async def _generate_market_insights(
        self,
        user_id: str,
        role: str,
        sample_size: int,
        salary_data: Dict[str, Any],
        top_skills: List[Dict[str, Any]],
    ) -> str:
        """Generate market analysis insights using LLM.

        Args:
            user_id: User identifier.
            role: Job title or industry.
            sample_size: Number of positions analyzed.
            salary_data: Salary analysis results.
            top_skills: Top demanded skills.

        Returns:
            Human-readable market insights.
        """
        skills_str = ", ".join([s["skill"] for s in top_skills])
        median_salary = salary_data.get("median", "N/A")

        prompt = f"""You are a career market analyst. Provide brief insights about the job market (2-3 sentences):

Role: {role}
Positions Analyzed: {sample_size}
Median Salary: ${median_salary:,.0f if isinstance(median_salary, (int, float)) else median_salary}
Top Skills in Demand: {skills_str}

What should job seekers know about this market?"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if isinstance(median_salary, (int, float)):
                return f"The {role} market shows a median salary of ${median_salary:,.0f} based on {sample_size} positions. Top demanded skills include {skills_str}. Focus on developing these skills to maximize your competitiveness."
            else:
                return f"Analysis of {sample_size} {role} positions shows strong demand for {skills_str}. Build expertise in these areas to improve your candidacy and salary negotiations."

    # -------------------------------------------------------------------------
    # Job Recommendations
    # -------------------------------------------------------------------------

    async def _recommend_jobs(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Recommend jobs based on user profile and preferences.

        Expected payload:
            {
                "user_profile": {
                    "skills": [str],
                    "experience_years": int,
                    "education": str,
                    "desired_roles": [str],
                    "location": str,
                    "salary_min": float
                },
                "available_jobs": [
                    {
                        "job_id": str,
                        "title": str,
                        "company": str,
                        "required_skills": [str],
                        "experience_required": str,
                        "location": str,
                        "remote": bool,
                        "salary_range": {"min": float, "max": float}
                    }
                ]
            }

        Returns:
            Dict with ranked job recommendations.
        """
        user_profile = payload.get("user_profile", {})
        available_jobs = payload.get("available_jobs", [])

        if not user_profile or not available_jobs:
            return {
                "success": False,
                "error": "Both user_profile and available_jobs are required",
            }

        # Score each job using the match algorithm
        recommendations = []

        for job in available_jobs:
            # Prepare payload for matching
            match_payload = {
                "user_profile": user_profile,
                "job_posting": job,
            }

            # Use the matching logic
            match_result = await self._match_job(user_id, match_payload)

            if match_result.get("success"):
                recommendations.append({
                    "job_id": job.get("job_id", "unknown"),
                    "title": job.get("title"),
                    "company": job.get("company"),
                    "match_score": match_result["match_score"],
                    "match_quality": match_result["match_quality"],
                    "location": job.get("location"),
                    "remote": job.get("remote", False),
                    "salary_range": job.get("salary_range"),
                    "key_strengths": match_result["match_components"]["skills"]["required_matched"][:3],
                    "development_areas": match_result["match_components"]["skills"]["required_missing"][:3],
                })

        # Sort by match score (descending)
        recommendations.sort(key=lambda x: x["match_score"], reverse=True)

        # Take top 10 recommendations
        top_recommendations = recommendations[:10]

        # Generate insights
        insights = await self._generate_recommendation_insights(
            user_id, len(available_jobs), len(top_recommendations), top_recommendations
        )

        return {
            "success": True,
            "total_jobs_evaluated": len(available_jobs),
            "recommendations_count": len(top_recommendations),
            "recommendations": top_recommendations,
            "insights": insights,
        }

    async def _generate_recommendation_insights(
        self,
        user_id: str,
        total_evaluated: int,
        recommended_count: int,
        recommendations: List[Dict[str, Any]],
    ) -> str:
        """Generate job recommendation insights using LLM.

        Args:
            user_id: User identifier.
            total_evaluated: Total jobs evaluated.
            recommended_count: Number of recommendations.
            recommendations: Top recommended jobs.

        Returns:
            Human-readable insights.
        """
        if recommendations:
            top_job = recommendations[0]
            top_title = top_job["title"]
            top_score = top_job["match_score"]

            prompt = f"""You are a career advisor providing job recommendations. Provide brief advice (2-3 sentences):

Jobs Evaluated: {total_evaluated}
Top Recommendations: {recommended_count}
Best Match: {top_title} (Score: {top_score:.1f}/100)

How should the candidate prioritize their applications?"""

            try:
                insights = await self.llm_client.generate(
                    prompt=prompt,
                    user_id=user_id,
                    max_tokens=200,
                    temperature=0.7,
                )
                return insights.strip()
            except Exception:
                return f"After evaluating {total_evaluated} positions, we found {recommended_count} strong matches. Your best match is {top_title} with a {top_score:.1f}/100 compatibility score. Apply to your top matches first while they're still open."
        else:
            return f"We evaluated {total_evaluated} positions but didn't find strong matches for your profile. Consider expanding your search criteria, building new skills, or targeting entry-level roles to gain experience."

    # -------------------------------------------------------------------------
    # Application Insights
    # -------------------------------------------------------------------------

    async def _generate_application_insights(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate insights about application success patterns.

        Expected payload:
            {
                "applications": [
                    {
                        "job_title": str,
                        "company": str,
                        "applied_date": str,
                        "status": str,
                        "match_score": float (optional),
                        "customized_resume": bool,
                        "cover_letter": bool,
                        "referral": bool
                    }
                ]
            }

        Returns:
            Dict with success pattern analysis.
        """
        applications = payload.get("applications", [])

        if not applications:
            return {
                "success": False,
                "error": "No applications provided",
            }

        # Analyze success factors
        success_factors = {
            "customized_resume": {"success": 0, "total": 0},
            "cover_letter": {"success": 0, "total": 0},
            "referral": {"success": 0, "total": 0},
            "high_match_score": {"success": 0, "total": 0},
        }

        successful_apps = 0
        total_apps = len(applications)

        for app in applications:
            status = app.get("status", "").lower()
            is_success = status in ["interview", "offer"]

            if is_success:
                successful_apps += 1

            # Track customized resume
            if app.get("customized_resume", False):
                success_factors["customized_resume"]["total"] += 1
                if is_success:
                    success_factors["customized_resume"]["success"] += 1

            # Track cover letter
            if app.get("cover_letter", False):
                success_factors["cover_letter"]["total"] += 1
                if is_success:
                    success_factors["cover_letter"]["success"] += 1

            # Track referral
            if app.get("referral", False):
                success_factors["referral"]["total"] += 1
                if is_success:
                    success_factors["referral"]["success"] += 1

            # Track high match score (>= 75)
            match_score = app.get("match_score", 0)
            if match_score >= 75:
                success_factors["high_match_score"]["total"] += 1
                if is_success:
                    success_factors["high_match_score"]["success"] += 1

        # Calculate success rates for each factor
        factor_analysis = {}
        for factor, data in success_factors.items():
            if data["total"] > 0:
                success_rate = (data["success"] / data["total"]) * 100
                factor_analysis[factor] = {
                    "applications": data["total"],
                    "successes": data["success"],
                    "success_rate": round(success_rate, 2),
                }
            else:
                factor_analysis[factor] = {
                    "applications": 0,
                    "successes": 0,
                    "success_rate": 0,
                }

        # Overall success rate
        overall_success_rate = (successful_apps / total_apps * 100) if total_apps > 0 else 0

        # Generate insights
        insights = await self._generate_success_pattern_insights(
            user_id, overall_success_rate, factor_analysis
        )

        return {
            "success": True,
            "total_applications": total_apps,
            "successful_applications": successful_apps,
            "overall_success_rate": round(overall_success_rate, 2),
            "success_factors": factor_analysis,
            "insights": insights,
        }

    async def _generate_success_pattern_insights(
        self,
        user_id: str,
        overall_rate: float,
        factors: Dict[str, Dict[str, Any]],
    ) -> str:
        """Generate success pattern insights using LLM.

        Args:
            user_id: User identifier.
            overall_rate: Overall success rate.
            factors: Success factor analysis.

        Returns:
            Human-readable insights.
        """
        # Find most impactful factor
        best_factor = max(factors.items(), key=lambda x: x[1]["success_rate"])
        factor_name = best_factor[0].replace("_", " ").title()
        factor_rate = best_factor[1]["success_rate"]

        prompt = f"""You are a career advisor analyzing application success patterns. Provide actionable advice (2-3 sentences):

Overall Success Rate: {overall_rate:.1f}%
Most Impactful Factor: {factor_name} ({factor_rate:.1f}% success rate)

What specific actions should they take with future applications?"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            return f"Your data shows that {factor_name} has a {factor_rate:.1f}% success rate. Apply this approach to all future applications. With an overall {overall_rate:.1f}% success rate, consistency in using proven strategies will improve your results."

    # -------------------------------------------------------------------------
    # Interview Preparation
    # -------------------------------------------------------------------------

    async def _prepare_for_interview(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate interview preparation suggestions.

        Expected payload:
            {
                "job_title": str,
                "company": str,
                "interview_type": str ("phone", "technical", "behavioral", "panel"),
                "job_description": str (optional),
                "required_skills": [str] (optional)
            }

        Returns:
            Dict with preparation checklist and suggested questions.
        """
        job_title = payload.get("job_title", "")
        company = payload.get("company", "")
        interview_type = payload.get("interview_type", "behavioral").lower()
        job_description = payload.get("job_description", "")
        required_skills = payload.get("required_skills", [])

        if not job_title:
            return {
                "success": False,
                "error": "Job title is required",
            }

        # Generate type-specific preparation items
        preparation_checklist = []

        # Common items for all interviews
        preparation_checklist.extend([
            {"category": "Research", "item": f"Research {company}'s recent news, products, and culture"},
            {"category": "Research", "item": "Review the job description and align your experience"},
            {"category": "Preparation", "item": "Prepare 3-5 STAR method examples of your achievements"},
            {"category": "Preparation", "item": "Prepare thoughtful questions to ask the interviewer"},
            {"category": "Logistics", "item": "Test technology/video platform if remote interview"},
        ])

        # Type-specific items
        if interview_type == "phone":
            preparation_checklist.extend([
                {"category": "Preparation", "item": "Prepare your elevator pitch (30-60 seconds)"},
                {"category": "Logistics", "item": "Have resume and notes in front of you"},
                {"category": "Logistics", "item": "Find a quiet location with good phone reception"},
            ])
        elif interview_type == "technical":
            preparation_checklist.extend([
                {"category": "Preparation", "item": "Review key technical concepts and algorithms"},
                {"category": "Preparation", "item": "Practice coding challenges on relevant platforms"},
                {"category": "Preparation", "item": "Prepare to explain your technical decisions and trade-offs"},
                {"category": "Logistics", "item": "Set up development environment if live coding"},
            ])
        elif interview_type == "behavioral":
            preparation_checklist.extend([
                {"category": "Preparation", "item": "Prepare examples of leadership, teamwork, and conflict resolution"},
                {"category": "Preparation", "item": "Think of times you failed and what you learned"},
                {"category": "Preparation", "item": "Review company values and align your examples"},
            ])
        elif interview_type == "panel":
            preparation_checklist.extend([
                {"category": "Preparation", "item": "Research each panel member's background on LinkedIn"},
                {"category": "Preparation", "item": "Prepare answers that address different stakeholder concerns"},
                {"category": "Logistics", "item": "Bring extra copies of your resume for each panelist"},
            ])

        # Generate potential interview questions based on skills
        suggested_questions = []

        # Common behavioral questions
        suggested_questions.extend([
            {"type": "Behavioral", "question": f"Tell me about yourself and why you're interested in {job_title}?"},
            {"type": "Behavioral", "question": "Describe a challenging project and how you overcame obstacles."},
            {"type": "Behavioral", "question": "Tell me about a time you disagreed with a team member."},
        ])

        # Skill-specific questions
        for skill in required_skills[:5]:
            suggested_questions.append({
                "type": "Technical",
                "question": f"How have you used {skill} in your previous projects?",
            })

        # Company/role specific
        suggested_questions.extend([
            {"type": "Fit", "question": f"Why do you want to work at {company}?"},
            {"type": "Fit", "question": "Where do you see yourself in 3-5 years?"},
        ])

        # Generate personalized insights
        insights = await self._generate_interview_insights(
            user_id, job_title, company, interview_type
        )

        return {
            "success": True,
            "job_title": job_title,
            "company": company,
            "interview_type": interview_type,
            "preparation_checklist": preparation_checklist,
            "suggested_questions": suggested_questions,
            "insights": insights,
        }

    async def _generate_interview_insights(
        self,
        user_id: str,
        job_title: str,
        company: str,
        interview_type: str,
    ) -> str:
        """Generate interview preparation insights using LLM.

        Args:
            user_id: User identifier.
            job_title: Job title.
            company: Company name.
            interview_type: Type of interview.

        Returns:
            Human-readable preparation insights.
        """
        prompt = f"""You are a career coach preparing someone for an interview. Provide specific, actionable advice (2-3 sentences):

Position: {job_title} at {company}
Interview Type: {interview_type}

What should they focus on to make the best impression?"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            return f"For your {interview_type} interview at {company}, thoroughly research their products and recent initiatives. Prepare specific examples that demonstrate your expertise in {job_title} responsibilities using the STAR method. Show genuine enthusiasm for their mission and ask thoughtful questions about team dynamics and growth opportunities."

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle read-only job search queries.

        Supported query types:
        - search_jobs: Search for job opportunities
        - get_resume_tips: Get resume improvement tips
        - get_interview_prep: Get interview preparation advice

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        query_type = query.get("query_type")
        params = query.get("parameters", {})

        if query_type == "search_jobs":
            return await self._search_jobs(params.get("user_id"), params)
        elif query_type == "get_resume_tips":
            return await self._get_resume_tips(params.get("user_id"), params)
        elif query_type == "get_interview_prep":
            return await self._prepare_interview(params.get("user_id"), params)
        else:
            return {
                "success": False,
                "error": f"Unsupported query type: {query_type}",
                "supported_types": [
                    "search_jobs",
                    "get_resume_tips",
                    "get_interview_prep"
                ]
            }
