"""
Career schemas
"""
from datetime import date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, UUID4
from app.schemas.base import BaseResponseSchema
from app.models.career import EmploymentType, SkillLevel


# Career Profile Schemas
class CareerProfileCreate(BaseModel):
    headline: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None


class CareerProfileUpdate(BaseModel):
    headline: Optional[str] = None
    summary: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    desired_salary_min: Optional[Decimal] = None
    desired_salary_max: Optional[Decimal] = None


class CareerProfileResponse(BaseResponseSchema):
    headline: Optional[str]
    current_title: Optional[str]
    current_company: Optional[str]
    years_of_experience: Optional[int]
    is_actively_looking: bool


# Job Experience Schemas
class JobExperienceCreate(BaseModel):
    company_name: str
    job_title: str
    start_date: date
    is_current: bool = False


class JobExperienceUpdate(BaseModel):
    job_title: Optional[str] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class JobExperienceResponse(BaseResponseSchema):
    company_name: str
    job_title: str
    start_date: date
    end_date: Optional[date]
    is_current: bool


# Skill Schemas
class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None
    proficiency: Optional[SkillLevel] = None


class SkillUpdate(BaseModel):
    proficiency: Optional[SkillLevel] = None
    years_of_experience: Optional[int] = None


class SkillResponse(BaseResponseSchema):
    name: str
    category: Optional[str]
    proficiency: Optional[SkillLevel]
    years_of_experience: Optional[int]
