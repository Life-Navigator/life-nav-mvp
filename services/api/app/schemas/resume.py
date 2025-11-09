"""
Resume schemas for AI-powered resume builder
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# Resume Content Structure Schemas

class ContactInfo(BaseModel):
    """Contact information section"""
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None  # "City, State" or "City, Country"
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    website_url: Optional[str] = None


class ExperienceItem(BaseModel):
    """Single job experience entry"""
    company: str
    title: str
    location: Optional[str] = None
    start_date: str  # "Jan 2020" or "2020-01"
    end_date: Optional[str] = None  # None means current
    is_current: bool = False
    description: Optional[str] = None
    achievements: List[str] = []  # Bullet points
    technologies: List[str] = []


class EducationItem(BaseModel):
    """Single education entry"""
    institution: str
    degree: str  # "Bachelor of Science in Computer Science"
    field_of_study: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None
    honors: List[str] = []
    relevant_coursework: List[str] = []


class ProjectItem(BaseModel):
    """Single project entry"""
    name: str
    description: str
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    technologies: List[str] = []
    achievements: List[str] = []
    url: Optional[str] = None
    github_url: Optional[str] = None


class CertificationItem(BaseModel):
    """Single certification entry"""
    name: str
    issuer: str
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    url: Optional[str] = None


class SkillCategory(BaseModel):
    """Skills grouped by category"""
    category: str  # "Programming Languages", "Frameworks", "Tools", etc.
    skills: List[str]


class ResumeContent(BaseModel):
    """Complete resume content structure"""

    # Required sections
    contact: ContactInfo

    # Optional sections (can be None if not included)
    professional_summary: Optional[str] = None
    experience: List[ExperienceItem] = []
    education: List[EducationItem] = []
    skills: List[SkillCategory] = []
    projects: List[ProjectItem] = []
    certifications: List[CertificationItem] = []

    # Additional optional sections
    languages: List[Dict[str, str]] = []  # [{"language": "Spanish", "proficiency": "Fluent"}]
    publications: List[str] = []
    awards: List[str] = []
    volunteer_work: List[Dict[str, Any]] = []

    # Section order for rendering
    section_order: List[str] = [
        "contact", "professional_summary", "experience",
        "education", "skills", "projects", "certifications"
    ]


# API Request/Response Schemas

class ResumeTemplateResponse(BaseModel):
    """Resume template response"""
    id: str
    name: str
    description: Optional[str]
    category: str
    is_ats_friendly: bool
    is_active: bool
    layout_config: Dict[str, Any]
    preview_url: Optional[str]
    thumbnail_url: Optional[str]
    usage_count: int
    display_order: int

    class Config:
        from_attributes = True


class ResumeCreate(BaseModel):
    """Create new resume"""
    title: str
    template_id: str
    content: ResumeContent
    target_job_title: Optional[str] = None
    target_company: Optional[str] = None
    target_job_description: Optional[str] = None


class ResumeUpdate(BaseModel):
    """Update existing resume"""
    title: Optional[str] = None
    template_id: Optional[str] = None
    content: Optional[ResumeContent] = None
    is_primary: Optional[bool] = None
    status: Optional[str] = None
    target_job_title: Optional[str] = None
    target_company: Optional[str] = None
    target_job_description: Optional[str] = None


class ResumeResponse(BaseModel):
    """Resume response"""
    id: str
    user_id: str
    tenant_id: str
    title: str
    template_id: str
    is_primary: bool
    status: str
    content: ResumeContent
    created_from: str
    last_optimized_at: Optional[datetime]
    ats_score: Optional[float]
    keyword_density: Optional[float]
    readability_score: Optional[float]
    target_job_title: Optional[str]
    target_company: Optional[str]
    target_job_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Include template info
    template: Optional[ResumeTemplateResponse] = None

    class Config:
        from_attributes = True


class ResumeListItem(BaseModel):
    """Simplified resume for list views"""
    id: str
    title: str
    template_id: str
    is_primary: bool
    status: str
    ats_score: Optional[float]
    target_job_title: Optional[str]
    target_company: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResumeVersionResponse(BaseModel):
    """Resume version history response"""
    id: str
    resume_id: str
    version_number: int
    content: ResumeContent
    change_summary: Optional[str]
    changed_by: str
    ats_score: Optional[float]
    keyword_density: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# AI Generation Request Schemas

class GenerateResumeRequest(BaseModel):
    """Request to auto-generate resume from user profile"""
    template_id: str
    title: Optional[str] = "My Resume"
    target_job_title: Optional[str] = None
    target_job_description: Optional[str] = None
    include_sections: List[str] = [
        "professional_summary", "experience", "education",
        "skills", "projects", "certifications"
    ]


class TailorResumeRequest(BaseModel):
    """Request to tailor resume for specific job"""
    job_title: str
    job_description: str
    company_name: Optional[str] = None
    create_new_version: bool = True  # Create new version or overwrite


class RewriteSectionRequest(BaseModel):
    """Request to rewrite a specific resume section"""
    section: str  # "professional_summary", "experience.0.achievements.0", etc.
    tone: Optional[str] = "professional"  # professional, creative, technical
    focus_keywords: List[str] = []  # Keywords to emphasize


class OptimizeResumeRequest(BaseModel):
    """Request to optimize entire resume"""
    target_job_description: Optional[str] = None
    optimization_goals: List[str] = [
        "ats_score", "keyword_density", "readability"
    ]


# AI Analysis Response Schemas

class ATSAnalysisResult(BaseModel):
    """ATS scoring analysis result"""
    overall_score: float  # 0-100
    keyword_score: float
    format_score: float
    content_score: float
    red_flags: List[str]
    suggestions: List[str]
    keyword_analysis: Dict[str, Any]


class ResumeAnalysisResult(BaseModel):
    """Complete resume analysis"""
    ats_analysis: ATSAnalysisResult
    readability_score: float
    keyword_density: float
    sections_analysis: Dict[str, Any]
    improvement_suggestions: List[Dict[str, str]]
    strengths: List[str]
    weaknesses: List[str]


class SectionRewriteResult(BaseModel):
    """Result from AI section rewrite"""
    original: str
    rewritten: str
    improvements: List[str]
    keywords_added: List[str]


# Export Schemas

class ExportFormat(BaseModel):
    """Export format options"""
    format: str  # "pdf", "docx", "html"
    template_id: Optional[str] = None  # Override template for export
    include_contact_details: bool = True
    file_name: Optional[str] = None


class ExportResponse(BaseModel):
    """Export response with download URL"""
    download_url: str
    format: str
    file_name: str
    expires_at: datetime
