"""
Education schemas
"""

from datetime import date
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, UUID4
from app.schemas.base import BaseResponseSchema
from app.models.education import DegreeType, CourseStatus


# Education Record Schemas
class EducationRecordCreate(BaseModel):
    institution_name: str
    degree_type: DegreeType
    field_of_study: Optional[str] = None
    start_date: date


class EducationRecordUpdate(BaseModel):
    degree_name: Optional[str] = None
    gpa: Optional[Decimal] = None
    end_date: Optional[date] = None


class EducationRecordResponse(BaseResponseSchema):
    institution_name: str
    degree_type: DegreeType
    degree_name: Optional[str]
    field_of_study: Optional[str]
    start_date: date
    end_date: Optional[date]
    is_current: bool


# Course Schemas
class CourseCreate(BaseModel):
    course_name: str
    education_record_id: Optional[UUID4] = None


class CourseUpdate(BaseModel):
    status: Optional[CourseStatus] = None
    grade: Optional[str] = None


class CourseResponse(BaseResponseSchema):
    course_name: str
    status: CourseStatus
    grade: Optional[str]


# Certification Schemas
class CertificationCreate(BaseModel):
    name: str
    issuing_organization: str
    issue_date: date


class CertificationUpdate(BaseModel):
    expiration_date: Optional[date] = None
    is_active: Optional[bool] = None


class CertificationResponse(BaseResponseSchema):
    name: str
    issuing_organization: str
    issue_date: date
    expiration_date: Optional[date]
    is_active: bool
