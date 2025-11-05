"""Resume Specialist Agent.

This L2 specialist agent handles all resume-related tasks including optimization,
ATS scoring, keyword analysis, and format recommendations.

Capabilities:
    - resume_analysis: Comprehensive analysis of resume content and structure
    - ats_scoring: Score resume for ATS compatibility
    - keyword_optimization: Analyze and suggest keywords for job matching
    - format_review: Review format, structure, and readability
    - achievement_enhancement: Suggest ways to quantify achievements
    - skills_alignment: Align skills section with job requirements

Dependencies:
    - LLM for generating personalized insights and recommendations
    - AdminTracker for metrics collection
    - BaseAgent for core agent functionality

Example usage:
    >>> agent = ResumeSpecialist()
    >>> task = AgentTask(
    ...     task_id="resume_001",
    ...     task_type="ats_scoring",
    ...     user_id="user_123",
    ...     payload={
    ...         "resume_text": "John Doe\\nSoftware Engineer\\n...",
    ...         "job_description": "Looking for experienced Python developer..."
    ...     }
    ... )
    >>> result = await agent.handle_task(task)
    >>> print(result["ats_score"])
    78.5
"""

import re
from typing import Any, Dict, List, Optional

from agents.core.base_agent import BaseAgent
from models.agent_models import AgentCapability, AgentTask, AgentType
from utils.admin_tracker import track_metrics
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class ResumeSpecialist(BaseAgent):
    """L2 Specialist Agent for resume optimization and analysis.

    This agent provides comprehensive resume analysis including ATS compatibility
    scoring, keyword optimization, format review, and actionable recommendations
    to improve resume effectiveness.

    Attributes:
        llm_client: Client for LLM-based insight generation.
        capabilities: List of agent capabilities with confidence scores.
    """

    # Common ATS-unfriendly elements
    ATS_RED_FLAGS = [
        "tables",
        "text boxes",
        "headers/footers",
        "graphics",
        "special characters",
        "columns",
        "images",
    ]

    # Recommended resume sections
    RECOMMENDED_SECTIONS = [
        "contact information",
        "professional summary",
        "work experience",
        "education",
        "skills",
    ]

    # Optional but valuable sections
    OPTIONAL_SECTIONS = [
        "certifications",
        "projects",
        "publications",
        "volunteer work",
        "awards",
    ]

    def __init__(
        self,
        agent_id: str = "resume_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize the ResumeSpecialist agent.

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
                name="resume_analysis",
                description="Comprehensive analysis of resume content and structure",
                confidence=0.94,
            ),
            AgentCapability(
                name="ats_scoring",
                description="Score resume for ATS (Applicant Tracking System) compatibility",
                confidence=0.92,
            ),
            AgentCapability(
                name="keyword_optimization",
                description="Analyze and suggest keywords for job matching",
                confidence=0.93,
            ),
            AgentCapability(
                name="format_review",
                description="Review format, structure, and readability",
                confidence=0.91,
            ),
            AgentCapability(
                name="achievement_enhancement",
                description="Suggest ways to quantify and improve achievements",
                confidence=0.90,
            ),
            AgentCapability(
                name="skills_alignment",
                description="Align skills section with job requirements",
                confidence=0.92,
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
        """Route and handle resume-related tasks.

        Args:
            task: The task to handle with type and payload.

        Returns:
            Dict containing task results.

        Raises:
            ValueError: If task_type is not supported.
        """
        task_type = task.task_type
        user_id = task.user_id

        if task_type == "resume_analysis":
            return await self._analyze_resume(user_id, task.payload)
        elif task_type == "ats_scoring":
            return await self._score_ats_compatibility(user_id, task.payload)
        elif task_type == "keyword_optimization":
            return await self._optimize_keywords(user_id, task.payload)
        elif task_type == "format_review":
            return await self._review_format(user_id, task.payload)
        elif task_type == "achievement_enhancement":
            return await self._enhance_achievements(user_id, task.payload)
        elif task_type == "skills_alignment":
            return await self._align_skills(user_id, task.payload)
        else:
            raise ValueError(f"Unsupported task type: {task_type}")

    # -------------------------------------------------------------------------
    # Resume Analysis
    # -------------------------------------------------------------------------

    async def _analyze_resume(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Perform comprehensive resume analysis.

        Expected payload:
            {
                "resume_text": str,
                "target_role": str (optional),
                "years_experience": int (optional)
            }

        Returns:
            Dict with comprehensive analysis including strengths and weaknesses.
        """
        resume_text = payload.get("resume_text", "")
        target_role = payload.get("target_role", "")
        years_experience = payload.get("years_experience", 0)

        if not resume_text:
            return {
                "success": False,
                "error": "Resume text is required",
            }

        # Analyze various aspects
        word_count = len(resume_text.split())
        char_count = len(resume_text)

        # Check for key sections
        sections_found = self._identify_sections(resume_text)
        missing_sections = [
            section for section in self.RECOMMENDED_SECTIONS
            if section not in sections_found
        ]

        # Analyze contact information
        has_email = bool(re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', resume_text))
        has_phone = bool(re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', resume_text))
        has_linkedin = "linkedin.com" in resume_text.lower()

        # Analyze bullet points and quantification
        bullet_points = len(re.findall(r'^\s*[•\-\*]', resume_text, re.MULTILINE))
        numbers_used = len(re.findall(r'\b\d+%?\b', resume_text))
        quantified_achievements = numbers_used  # Approximation

        # Check for action verbs (strong indicators of achievements)
        action_verbs = [
            "achieved", "improved", "increased", "decreased", "developed",
            "implemented", "led", "managed", "created", "designed",
            "optimized", "reduced", "accelerated", "launched", "built"
        ]
        action_verb_count = sum(
            resume_text.lower().count(verb) for verb in action_verbs
        )

        # Length assessment
        if word_count < 300:
            length_assessment = "too_short"
            length_feedback = "Resume is too brief. Aim for 400-800 words for most roles."
        elif word_count > 1000:
            length_assessment = "too_long"
            length_feedback = "Resume is too lengthy. Focus on most relevant experiences and achievements."
        else:
            length_assessment = "appropriate"
            length_feedback = "Resume length is appropriate for most roles."

        # Calculate overall score (0-100)
        score = 0

        # Section completeness (30 points)
        section_score = (len(sections_found) / len(self.RECOMMENDED_SECTIONS)) * 30
        score += section_score

        # Contact info (10 points)
        contact_score = (sum([has_email, has_phone, has_linkedin]) / 3) * 10
        score += contact_score

        # Quantification (25 points)
        # Good resumes have ~15-25 quantified achievements
        quant_score = min(25, (quantified_achievements / 20) * 25)
        score += quant_score

        # Action verbs (20 points)
        # Good resumes have ~10-20 action verbs
        action_score = min(20, (action_verb_count / 15) * 20)
        score += action_score

        # Length appropriateness (15 points)
        if length_assessment == "appropriate":
            score += 15
        elif length_assessment == "too_short":
            score += 7
        else:
            score += 10

        # Generate detailed insights
        insights = await self._generate_analysis_insights(
            user_id, score, sections_found, missing_sections, quantified_achievements
        )

        return {
            "success": True,
            "overall_score": round(score, 1),
            "word_count": word_count,
            "character_count": char_count,
            "length_assessment": length_assessment,
            "length_feedback": length_feedback,
            "sections_found": sections_found,
            "missing_sections": missing_sections,
            "contact_info": {
                "has_email": has_email,
                "has_phone": has_phone,
                "has_linkedin": has_linkedin,
            },
            "content_metrics": {
                "bullet_points": bullet_points,
                "quantified_achievements": quantified_achievements,
                "action_verbs": action_verb_count,
            },
            "insights": insights,
        }

    def _identify_sections(self, resume_text: str) -> List[str]:
        """Identify sections present in resume.

        Args:
            resume_text: Full resume text.

        Returns:
            List of identified section names.
        """
        sections_found = []
        resume_lower = resume_text.lower()

        # Check for each recommended and optional section
        all_sections = self.RECOMMENDED_SECTIONS + self.OPTIONAL_SECTIONS

        section_patterns = {
            "contact information": [r"contact", r"email", r"phone"],
            "professional summary": [r"summary", r"profile", r"objective"],
            "work experience": [r"experience", r"employment", r"work history"],
            "education": [r"education", r"academic", r"degree"],
            "skills": [r"skills", r"technical skills", r"competencies"],
            "certifications": [r"certification", r"licenses"],
            "projects": [r"projects", r"portfolio"],
            "publications": [r"publications", r"papers"],
            "volunteer work": [r"volunteer", r"community"],
            "awards": [r"awards", r"honors", r"achievements"],
        }

        for section_name, patterns in section_patterns.items():
            for pattern in patterns:
                if re.search(pattern, resume_lower):
                    sections_found.append(section_name)
                    break

        return sections_found

    async def _generate_analysis_insights(
        self,
        user_id: str,
        score: float,
        sections: List[str],
        missing: List[str],
        quantified: int,
    ) -> str:
        """Generate resume analysis insights using LLM.

        Args:
            user_id: User identifier.
            score: Overall resume score.
            sections: Sections found in resume.
            missing: Missing recommended sections.
            quantified: Number of quantified achievements.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a professional resume reviewer. Provide brief, actionable feedback (2-3 sentences):

Overall Score: {score:.1f}/100
Sections Present: {len(sections)}
Missing Sections: {', '.join(missing) if missing else 'None'}
Quantified Achievements: {quantified}

What are the top 2-3 improvements to make?"""

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
            if score >= 80:
                return f"Strong resume with a score of {score:.1f}/100. To perfect it, ensure all achievements use specific metrics and numbers. Consider adding a brief professional summary at the top."
            elif missing:
                return f"Your resume scores {score:.1f}/100. Add missing sections: {', '.join(missing[:2])}. Include more quantified achievements (currently {quantified}) to demonstrate impact."
            else:
                return f"Resume scores {score:.1f}/100. Focus on quantifying your achievements with specific metrics (revenue, percentages, time saved). Use strong action verbs to start each bullet point."

    # -------------------------------------------------------------------------
    # ATS Scoring
    # -------------------------------------------------------------------------

    async def _score_ats_compatibility(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Score resume for ATS (Applicant Tracking System) compatibility.

        Expected payload:
            {
                "resume_text": str,
                "job_description": str (optional),
                "file_format": str (optional: "pdf", "docx", "txt")
            }

        Returns:
            Dict with ATS compatibility score and recommendations.
        """
        resume_text = payload.get("resume_text", "")
        job_description = payload.get("job_description", "")
        file_format = payload.get("file_format", "pdf").lower()

        if not resume_text:
            return {
                "success": False,
                "error": "Resume text is required",
            }

        ats_score = 100  # Start at perfect, deduct points for issues
        issues = []
        recommendations = []

        # 1. File format check (10 points)
        if file_format in ["pdf", "docx", "doc"]:
            # Good formats
            pass
        elif file_format == "txt":
            ats_score -= 3
            issues.append("Plain text format is ATS-friendly but may lack formatting impact")
        else:
            ats_score -= 10
            issues.append(f"Format '{file_format}' may not be ATS-compatible")
            recommendations.append("Convert to .docx or .pdf format")

        # 2. Check for complex formatting (15 points)
        # Detect tables (simple heuristic)
        if re.search(r'\|.*\|.*\|', resume_text):
            ats_score -= 10
            issues.append("Tables detected - may confuse ATS")
            recommendations.append("Replace tables with simple text formatting")

        # Check for excessive special characters
        special_chars = re.findall(r'[★©®™▪►]', resume_text)
        if len(special_chars) > 5:
            ats_score -= 5
            issues.append(f"Excessive special characters detected ({len(special_chars)})")
            recommendations.append("Replace special characters with standard bullets (•, -)")

        # 3. Section headers (15 points)
        sections = self._identify_sections(resume_text)
        if len(sections) < 4:
            ats_score -= 10
            issues.append("Missing standard section headers")
            recommendations.append("Add clear section headers (Experience, Education, Skills)")

        # 4. Contact information (10 points)
        has_email = bool(re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', resume_text))
        has_phone = bool(re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', resume_text))

        if not has_email:
            ats_score -= 5
            issues.append("Email not detected")
            recommendations.append("Include email address in contact section")

        if not has_phone:
            ats_score -= 5
            issues.append("Phone number not detected")
            recommendations.append("Include phone number in contact section")

        # 5. Keywords matching (30 points) - if job description provided
        if job_description:
            keyword_score, matched_keywords, missing_keywords = self._analyze_keywords(
                resume_text, job_description
            )

            # Scale to 30 points
            keyword_points = (keyword_score / 100) * 30
            ats_score -= (30 - keyword_points)

            if keyword_score < 70:
                issues.append(f"Low keyword match with job description ({keyword_score:.1f}%)")
                recommendations.append(f"Add these key terms: {', '.join(missing_keywords[:5])}")
        else:
            # No job description - can't evaluate keywords, neutral score
            pass

        # 6. Readability and structure (20 points)
        # Check for reasonable length
        word_count = len(resume_text.split())
        if word_count < 300:
            ats_score -= 10
            issues.append("Resume is too short to parse effectively")
            recommendations.append("Expand experience descriptions with achievements")
        elif word_count > 1200:
            ats_score -= 5
            issues.append("Resume may be too long for ATS to parse efficiently")
            recommendations.append("Condense to 1-2 pages of most relevant experience")

        # Check for consistent formatting (bullet points)
        bullet_points = len(re.findall(r'^\s*[•\-\*]', resume_text, re.MULTILINE))
        if bullet_points < 10:
            ats_score -= 5
            issues.append("Few bullet points detected - may impact parseability")
            recommendations.append("Use bullet points for experience and achievements")

        # Ensure score doesn't go below 0
        ats_score = max(0, ats_score)

        # Determine ATS compatibility level
        if ats_score >= 85:
            compatibility = "excellent"
        elif ats_score >= 70:
            compatibility = "good"
        elif ats_score >= 55:
            compatibility = "fair"
        else:
            compatibility = "poor"

        # Generate insights
        insights = await self._generate_ats_insights(
            user_id, ats_score, compatibility, len(issues)
        )

        result = {
            "success": True,
            "ats_score": round(ats_score, 1),
            "compatibility": compatibility,
            "issues_found": len(issues),
            "issues": issues,
            "recommendations": recommendations,
            "insights": insights,
        }

        # Add keyword analysis if job description was provided
        if job_description:
            result["keyword_match"] = {
                "score": round(keyword_score, 1),
                "matched": matched_keywords[:10],
                "missing": missing_keywords[:10],
            }

        return result

    def _analyze_keywords(
        self, resume_text: str, job_description: str
    ) -> tuple[float, List[str], List[str]]:
        """Analyze keyword overlap between resume and job description.

        Args:
            resume_text: Resume content.
            job_description: Job posting content.

        Returns:
            Tuple of (match_score, matched_keywords, missing_keywords)
        """
        # Extract important words (nouns, technical terms)
        # Simple approach: words 4+ characters that aren't common words
        common_words = {
            "with", "that", "this", "from", "have", "will", "been",
            "were", "their", "what", "which", "when", "where", "while",
            "about", "would", "could", "should", "other", "there", "these",
            "those", "through", "your", "more", "than", "such", "them"
        }

        def extract_keywords(text: str) -> set:
            words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
            return {w for w in words if w not in common_words}

        resume_keywords = extract_keywords(resume_text)
        job_keywords = extract_keywords(job_description)

        # Find matches and misses
        matched = resume_keywords & job_keywords
        missing = job_keywords - resume_keywords

        # Calculate match percentage
        match_score = (len(matched) / len(job_keywords) * 100) if job_keywords else 0

        return match_score, list(matched), list(missing)

    async def _generate_ats_insights(
        self,
        user_id: str,
        score: float,
        compatibility: str,
        issues_count: int,
    ) -> str:
        """Generate ATS scoring insights using LLM.

        Args:
            user_id: User identifier.
            score: ATS compatibility score.
            compatibility: Compatibility level.
            issues_count: Number of issues found.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are an ATS (Applicant Tracking System) expert. Provide brief advice (2-3 sentences):

ATS Score: {score:.1f}/100
Compatibility: {compatibility}
Issues Found: {issues_count}

How can they improve ATS compatibility?"""

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
                return f"Excellent ATS score of {score:.1f}/100. Your resume should pass most ATS systems. Keep formatting simple and update keywords for each application."
            elif issues_count > 5:
                return f"Your ATS score is {score:.1f}/100 with {issues_count} issues. Address formatting problems first (tables, special characters), then focus on keyword optimization."
            else:
                return f"Your ATS score of {score:.1f}/100 indicates room for improvement. Focus on using job-specific keywords and maintaining simple, clean formatting without tables or graphics."

    # -------------------------------------------------------------------------
    # Keyword Optimization
    # -------------------------------------------------------------------------

    async def _optimize_keywords(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize resume keywords for specific job.

        Expected payload:
            {
                "resume_text": str,
                "job_description": str,
                "target_keywords": [str] (optional - specific keywords to include)
            }

        Returns:
            Dict with keyword optimization suggestions.
        """
        resume_text = payload.get("resume_text", "")
        job_description = payload.get("job_description", "")
        target_keywords = payload.get("target_keywords", [])

        if not resume_text or not job_description:
            return {
                "success": False,
                "error": "Both resume_text and job_description are required",
            }

        # Analyze current keywords
        match_score, matched_keywords, missing_keywords = self._analyze_keywords(
            resume_text, job_description
        )

        # Extract technical skills and tools from job description
        # Common patterns: "Python", "experience with X", "knowledge of Y"
        tech_patterns = [
            r'\b(?:Python|Java|JavaScript|C\+\+|SQL|AWS|Azure|GCP|Docker|Kubernetes)\b',
            r'(?:experience with|knowledge of|proficiency in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        ]

        suggested_technical_terms = set()
        for pattern in tech_patterns:
            matches = re.findall(pattern, job_description, re.IGNORECASE)
            suggested_technical_terms.update(m.lower() if isinstance(m, str) else m[0].lower() for m in matches)

        # Check which technical terms are missing from resume
        resume_lower = resume_text.lower()
        missing_tech_terms = [
            term for term in suggested_technical_terms
            if term not in resume_lower
        ]

        # Check for target keywords if provided
        if target_keywords:
            target_analysis = []
            for keyword in target_keywords:
                count = resume_lower.count(keyword.lower())
                status = "present" if count > 0 else "missing"
                target_analysis.append({
                    "keyword": keyword,
                    "count": count,
                    "status": status,
                })
        else:
            target_analysis = []

        # Generate placement suggestions for missing keywords
        placement_suggestions = []
        for keyword in missing_keywords[:10]:
            # Suggest where to add it
            if keyword in ["lead", "manage", "develop", "implement", "design"]:
                placement_suggestions.append({
                    "keyword": keyword,
                    "suggestion": f"Add '{keyword}' to experience bullet points describing your work"
                })
            elif keyword in ["agile", "scrum", "devops", "ci/cd"]:
                placement_suggestions.append({
                    "keyword": keyword,
                    "suggestion": f"Add '{keyword}' to skills section or methodology description"
                })
            else:
                placement_suggestions.append({
                    "keyword": keyword,
                    "suggestion": f"Incorporate '{keyword}' naturally into relevant experience descriptions"
                })

        # Calculate keyword density (keywords per 100 words)
        word_count = len(resume_text.split())
        keyword_density = (len(matched_keywords) / word_count * 100) if word_count > 0 else 0

        # Ideal density is 2-4% for ATS
        if keyword_density < 2:
            density_assessment = "too_low"
            density_feedback = "Add more relevant keywords from job description"
        elif keyword_density > 6:
            density_assessment = "too_high"
            density_feedback = "Keyword density is high - ensure natural language flow"
        else:
            density_assessment = "optimal"
            density_feedback = "Keyword density is in optimal range"

        # Generate insights
        insights = await self._generate_keyword_insights(
            user_id, match_score, len(matched_keywords), len(missing_keywords)
        )

        return {
            "success": True,
            "match_score": round(match_score, 1),
            "matched_keywords": matched_keywords[:20],
            "matched_count": len(matched_keywords),
            "missing_keywords": missing_keywords[:20],
            "missing_count": len(missing_keywords),
            "missing_technical_terms": missing_tech_terms[:10],
            "keyword_density": round(keyword_density, 2),
            "density_assessment": density_assessment,
            "density_feedback": density_feedback,
            "target_keywords": target_analysis,
            "placement_suggestions": placement_suggestions[:10],
            "insights": insights,
        }

    async def _generate_keyword_insights(
        self,
        user_id: str,
        match_score: float,
        matched_count: int,
        missing_count: int,
    ) -> str:
        """Generate keyword optimization insights using LLM.

        Args:
            user_id: User identifier.
            match_score: Keyword match percentage.
            matched_count: Number of matched keywords.
            missing_count: Number of missing keywords.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a resume keyword expert. Provide actionable advice (2-3 sentences):

Keyword Match: {match_score:.1f}%
Matched Keywords: {matched_count}
Missing Keywords: {missing_count}

How should they optimize their resume keywords?"""

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
            if match_score >= 70:
                return f"Strong keyword match of {match_score:.1f}% with {matched_count} relevant terms. Review the {missing_count} missing keywords and incorporate the most important ones naturally into your experience descriptions."
            elif missing_count > 20:
                return f"Your {match_score:.1f}% keyword match indicates significant gaps. Add the {missing_count} missing keywords throughout your resume, especially in your skills section and experience bullet points. Mirror the job description's language."
            else:
                return f"Keyword match is {match_score:.1f}%. Add {missing_count} missing key terms to better align with the job requirements. Focus on technical skills and action verbs that match the job description."

    # -------------------------------------------------------------------------
    # Format Review
    # -------------------------------------------------------------------------

    async def _review_format(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Review resume format and structure.

        Expected payload:
            {
                "resume_text": str,
                "include_readability": bool (optional, default True)
            }

        Returns:
            Dict with format review and recommendations.
        """
        resume_text = payload.get("resume_text", "")
        include_readability = payload.get("include_readability", True)

        if not resume_text:
            return {
                "success": False,
                "error": "Resume text is required",
            }

        format_score = 100
        issues = []
        recommendations = []

        # 1. Length check
        word_count = len(resume_text.split())
        if word_count < 300:
            format_score -= 15
            issues.append("Resume is too short (under 300 words)")
            recommendations.append("Expand with more detailed achievement descriptions")
        elif word_count > 1200:
            format_score -= 10
            issues.append("Resume exceeds ideal length (over 1200 words)")
            recommendations.append("Condense to most relevant and recent experiences")

        # 2. Section organization
        sections = self._identify_sections(resume_text)
        if "professional summary" not in sections and "contact information" not in sections:
            format_score -= 10
            issues.append("Missing professional summary or header")
            recommendations.append("Add a brief professional summary at the top")

        if "work experience" not in sections:
            format_score -= 20
            issues.append("Work experience section not clearly identified")
            recommendations.append("Add clear 'Work Experience' or 'Professional Experience' header")

        # 3. Bullet point usage
        bullet_count = len(re.findall(r'^\s*[•\-\*]', resume_text, re.MULTILINE))
        if bullet_count < 10:
            format_score -= 10
            issues.append(f"Limited use of bullet points ({bullet_count})")
            recommendations.append("Use bullet points for each key achievement and responsibility")

        # 4. Consistency checks
        # Check for consistent date formatting
        date_patterns = [
            r'\b\d{4}\b',  # Year only
            r'\b\d{1,2}/\d{4}\b',  # MM/YYYY
            r'\b[A-Z][a-z]+\s+\d{4}\b',  # Month YYYY
        ]

        date_format_types = []
        for pattern in date_patterns:
            if re.search(pattern, resume_text):
                date_format_types.append(pattern)

        if len(date_format_types) > 1:
            format_score -= 5
            issues.append("Inconsistent date formatting")
            recommendations.append("Use consistent date format throughout (e.g., 'Jan 2020 - Dec 2022')")

        # 5. Whitespace and readability
        lines = resume_text.split('\n')
        empty_line_count = sum(1 for line in lines if line.strip() == "")

        if empty_line_count < len(lines) * 0.1:
            format_score -= 5
            issues.append("Insufficient white space between sections")
            recommendations.append("Add blank lines between sections for readability")

        # 6. Check for ALL CAPS overuse
        all_caps_count = len(re.findall(r'\b[A-Z]{4,}\b', resume_text))
        if all_caps_count > 10:
            format_score -= 5
            issues.append(f"Excessive ALL CAPS usage ({all_caps_count} instances)")
            recommendations.append("Use title case for section headers instead of ALL CAPS")

        # 7. Readability metrics (if requested)
        readability = None
        if include_readability:
            readability = self._calculate_readability(resume_text)

            if readability["flesch_ease"] < 40:
                format_score -= 5
                issues.append("Text is difficult to read (low readability score)")
                recommendations.append("Simplify language and use shorter sentences")

        format_score = max(0, format_score)

        # Determine format quality
        if format_score >= 85:
            quality = "excellent"
        elif format_score >= 70:
            quality = "good"
        elif format_score >= 55:
            quality = "fair"
        else:
            quality = "needs_improvement"

        # Generate insights
        insights = await self._generate_format_insights(
            user_id, format_score, quality, len(issues)
        )

        result = {
            "success": True,
            "format_score": round(format_score, 1),
            "quality": quality,
            "word_count": word_count,
            "sections_identified": len(sections),
            "bullet_points": bullet_count,
            "issues": issues,
            "recommendations": recommendations,
            "insights": insights,
        }

        if readability:
            result["readability"] = readability

        return result

    def _calculate_readability(self, text: str) -> Dict[str, float]:
        """Calculate readability metrics for text.

        Args:
            text: Text to analyze.

        Returns:
            Dict with readability scores.
        """
        # Simple Flesch Reading Ease approximation
        sentences = len(re.split(r'[.!?]+', text))
        words = len(text.split())
        syllables = sum(self._count_syllables(word) for word in text.split())

        if sentences == 0 or words == 0:
            return {"flesch_ease": 0, "avg_words_per_sentence": 0}

        avg_words_per_sentence = words / sentences
        avg_syllables_per_word = syllables / words

        # Flesch Reading Ease formula
        flesch_ease = 206.835 - (1.015 * avg_words_per_sentence) - (84.6 * avg_syllables_per_word)
        flesch_ease = max(0, min(100, flesch_ease))  # Clamp to 0-100

        return {
            "flesch_ease": round(flesch_ease, 1),
            "avg_words_per_sentence": round(avg_words_per_sentence, 1),
        }

    def _count_syllables(self, word: str) -> int:
        """Count syllables in a word (simple approximation).

        Args:
            word: Word to count syllables in.

        Returns:
            Estimated syllable count.
        """
        word = word.lower()
        vowels = "aeiouy"
        syllable_count = 0
        previous_was_vowel = False

        for char in word:
            is_vowel = char in vowels
            if is_vowel and not previous_was_vowel:
                syllable_count += 1
            previous_was_vowel = is_vowel

        # Adjust for silent e
        if word.endswith('e'):
            syllable_count -= 1

        # Ensure at least 1 syllable
        return max(1, syllable_count)

    async def _generate_format_insights(
        self,
        user_id: str,
        score: float,
        quality: str,
        issues_count: int,
    ) -> str:
        """Generate format review insights using LLM.

        Args:
            user_id: User identifier.
            score: Format score.
            quality: Format quality assessment.
            issues_count: Number of issues found.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a resume formatting expert. Provide brief advice (2-3 sentences):

Format Score: {score:.1f}/100
Quality: {quality}
Issues: {issues_count}

What formatting improvements should they prioritize?"""

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
                return f"Excellent formatting with a score of {score:.1f}/100. Your resume has clean structure and good readability. Minor tweaks can make it perfect."
            elif issues_count > 5:
                return f"Your resume format scores {score:.1f}/100 with {issues_count} issues. Focus on consistent formatting (dates, bullets) and clear section headers. Ensure adequate white space for readability."
            else:
                return f"Format score is {score:.1f}/100. Improve by using consistent bullet points for achievements, adding clear section headers, and ensuring dates are formatted uniformly throughout."

    # -------------------------------------------------------------------------
    # Achievement Enhancement
    # -------------------------------------------------------------------------

    async def _enhance_achievements(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Suggest ways to quantify and enhance achievement descriptions.

        Expected payload:
            {
                "achievements": [
                    {"original": str, "context": str (optional)}
                ]
            }

        Returns:
            Dict with enhancement suggestions for each achievement.
        """
        achievements = payload.get("achievements", [])

        if not achievements:
            return {
                "success": False,
                "error": "At least one achievement is required",
            }

        enhanced_achievements = []

        for achievement in achievements:
            original = achievement.get("original", "")
            context = achievement.get("context", "")

            if not original:
                continue

            # Analyze the achievement
            analysis = self._analyze_achievement(original)

            # Generate enhancement suggestions
            suggestions = await self._generate_achievement_suggestions(
                user_id, original, analysis, context
            )

            enhanced_achievements.append({
                "original": original,
                "has_action_verb": analysis["has_action_verb"],
                "has_quantification": analysis["has_quantification"],
                "has_result": analysis["has_result"],
                "strength_score": analysis["strength_score"],
                "suggestions": suggestions,
            })

        # Calculate overall achievement quality
        avg_score = sum(a["strength_score"] for a in enhanced_achievements) / len(enhanced_achievements)

        if avg_score >= 80:
            overall_quality = "excellent"
        elif avg_score >= 60:
            overall_quality = "good"
        elif avg_score >= 40:
            overall_quality = "fair"
        else:
            overall_quality = "needs_improvement"

        return {
            "success": True,
            "achievements_analyzed": len(enhanced_achievements),
            "average_strength_score": round(avg_score, 1),
            "overall_quality": overall_quality,
            "enhanced_achievements": enhanced_achievements,
        }

    def _analyze_achievement(self, achievement: str) -> Dict[str, Any]:
        """Analyze an achievement statement for strength.

        Args:
            achievement: Achievement text to analyze.

        Returns:
            Dict with analysis results.
        """
        achievement_lower = achievement.lower()

        # Check for strong action verbs
        action_verbs = [
            "achieved", "improved", "increased", "decreased", "developed",
            "implemented", "led", "managed", "created", "designed",
            "optimized", "reduced", "accelerated", "launched", "built",
            "delivered", "established", "enhanced", "generated", "streamlined"
        ]

        has_action_verb = any(verb in achievement_lower for verb in action_verbs)

        # Check for quantification (numbers, percentages)
        has_numbers = bool(re.search(r'\d+', achievement))
        has_percentage = bool(re.search(r'\d+%', achievement))
        has_dollar = bool(re.search(r'\$[\d,]+', achievement))

        has_quantification = has_numbers or has_percentage or has_dollar

        # Check for result indicators
        result_words = [
            "result", "outcome", "impact", "effect", "leading to",
            "resulting in", "which", "thereby", "thus", "consequently"
        ]

        has_result = any(word in achievement_lower for word in result_words)

        # Calculate strength score
        score = 0
        if has_action_verb:
            score += 40
        if has_quantification:
            score += 40
        if has_result:
            score += 20

        return {
            "has_action_verb": has_action_verb,
            "has_quantification": has_quantification,
            "has_result": has_result,
            "strength_score": score,
        }

    async def _generate_achievement_suggestions(
        self,
        user_id: str,
        original: str,
        analysis: Dict[str, Any],
        context: str,
    ) -> List[str]:
        """Generate suggestions to enhance achievement statement.

        Args:
            user_id: User identifier.
            original: Original achievement text.
            analysis: Analysis results.
            context: Additional context.

        Returns:
            List of enhancement suggestions.
        """
        suggestions = []

        if not analysis["has_action_verb"]:
            suggestions.append("Start with a strong action verb (e.g., 'Developed', 'Led', 'Implemented')")

        if not analysis["has_quantification"]:
            suggestions.append("Add specific metrics: How many? How much? What percentage? What timeframe?")

        if not analysis["has_result"]:
            suggestions.append("Include the business impact or result of your work")

        # If already strong, suggest polish
        if analysis["strength_score"] >= 80:
            suggestions.append("Achievement is strong - ensure it's tailored to target role requirements")

        # Generate LLM-based enhancement if score is low
        if analysis["strength_score"] < 60:
            prompt = f"""Enhance this resume achievement bullet point. Make it more impactful by adding quantification and results. Keep it concise (1-2 lines).

Original: {original}
Context: {context if context else 'General professional experience'}

Enhanced version:"""

            try:
                enhanced = await self.llm_client.generate(
                    prompt=prompt,
                    user_id=user_id,
                    max_tokens=100,
                    temperature=0.7,
                )
                suggestions.append(f"Enhanced version: {enhanced.strip()}")
            except Exception:
                pass

        return suggestions

    # -------------------------------------------------------------------------
    # Skills Alignment
    # -------------------------------------------------------------------------

    async def _align_skills(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Align resume skills with job requirements.

        Expected payload:
            {
                "resume_skills": [str],
                "job_requirements": {
                    "required_skills": [str],
                    "preferred_skills": [str]
                }
            }

        Returns:
            Dict with skills alignment analysis.
        """
        resume_skills = set(s.lower() for s in payload.get("resume_skills", []))
        job_requirements = payload.get("job_requirements", {})
        required_skills = set(s.lower() for s in job_requirements.get("required_skills", []))
        preferred_skills = set(s.lower() for s in job_requirements.get("preferred_skills", []))

        if not resume_skills:
            return {
                "success": False,
                "error": "Resume skills are required",
            }

        if not required_skills and not preferred_skills:
            return {
                "success": False,
                "error": "At least required_skills or preferred_skills must be provided",
            }

        # Calculate matches
        required_matched = resume_skills & required_skills
        required_missing = required_skills - resume_skills

        preferred_matched = resume_skills & preferred_skills
        preferred_missing = preferred_skills - resume_skills

        # Skills on resume but not in job posting (may be irrelevant)
        extra_skills = resume_skills - (required_skills | preferred_skills)

        # Calculate alignment score
        required_score = (
            (len(required_matched) / len(required_skills) * 100)
            if required_skills else 100
        )

        preferred_score = (
            (len(preferred_matched) / len(preferred_skills) * 100)
            if preferred_skills else 0
        )

        # Weighted score: 70% required, 30% preferred
        overall_score = (required_score * 0.7) + (preferred_score * 0.3)

        # Determine alignment quality
        if overall_score >= 85:
            alignment = "excellent"
        elif overall_score >= 70:
            alignment = "good"
        elif overall_score >= 55:
            alignment = "fair"
        else:
            alignment = "poor"

        # Generate recommendations
        recommendations = []

        if required_missing:
            recommendations.append({
                "priority": "high",
                "action": f"Add these critical required skills: {', '.join(list(required_missing)[:5])}",
            })

        if preferred_missing and len(required_missing) < 3:
            recommendations.append({
                "priority": "medium",
                "action": f"Consider adding these preferred skills: {', '.join(list(preferred_missing)[:5])}",
            })

        if len(extra_skills) > 10:
            recommendations.append({
                "priority": "low",
                "action": f"Remove less relevant skills to focus on job requirements. You have {len(extra_skills)} skills not mentioned in the posting.",
            })

        # Generate insights
        insights = await self._generate_skills_alignment_insights(
            user_id, overall_score, len(required_missing), len(preferred_matched)
        )

        return {
            "success": True,
            "alignment_score": round(overall_score, 1),
            "alignment": alignment,
            "required_skills": {
                "matched": list(required_matched),
                "missing": list(required_missing),
                "match_rate": round(required_score, 1),
            },
            "preferred_skills": {
                "matched": list(preferred_matched),
                "missing": list(preferred_missing),
                "match_rate": round(preferred_score, 1),
            },
            "extra_skills_count": len(extra_skills),
            "recommendations": recommendations,
            "insights": insights,
        }

    async def _generate_skills_alignment_insights(
        self,
        user_id: str,
        score: float,
        required_missing: int,
        preferred_matched: int,
    ) -> str:
        """Generate skills alignment insights using LLM.

        Args:
            user_id: User identifier.
            score: Overall alignment score.
            required_missing: Number of required skills missing.
            preferred_matched: Number of preferred skills matched.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a resume skills expert. Provide brief advice (2-3 sentences):

Skills Alignment: {score:.1f}%
Missing Required Skills: {required_missing}
Matched Preferred Skills: {preferred_matched}

How should they optimize their skills section?"""

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
                return f"Excellent skills alignment at {score:.1f}%. Your skills closely match the job requirements. Ensure these skills are also demonstrated in your experience section with specific examples."
            elif required_missing > 0:
                return f"You're missing {required_missing} required skills. If you have these skills but didn't list them, add them immediately. If you lack them, consider quick online courses or highlight transferable skills."
            else:
                return f"Skills alignment is {score:.1f}%. All required skills are present. Strengthen your application by adding more preferred skills and providing concrete examples of using key skills in your experience."

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle read-only resume queries.

        Supported query types:
        - analyze_resume: Analyze resume content
        - get_templates: Get resume templates
        - get_improvement_tips: Get resume improvement tips

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        query_type = query.get("query_type")
        params = query.get("parameters", {})

        if query_type == "analyze_resume":
            return await self._analyze_resume(params.get("user_id"), params)
        elif query_type == "get_templates":
            return await self._suggest_templates(params.get("user_id"), params)
        elif query_type == "get_improvement_tips":
            return await self._optimize_keywords(params.get("user_id"), params)
        else:
            return {
                "success": False,
                "error": f"Unsupported query type: {query_type}",
                "supported_types": [
                    "analyze_resume",
                    "get_templates",
                    "get_improvement_tips"
                ]
            }
