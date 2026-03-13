"""Build embedding text from entity properties for vector indexing."""


def build_entity_text(entity_type: str, payload: dict) -> str:
    """Build a descriptive text string for Gemini embedding from entity payload."""
    parts: list[str] = []

    match entity_type:
        case "goal":
            parts.append(f"Goal: {payload.get('title', 'Untitled')}")
            if payload.get("category"):
                parts.append(f"Category: {payload['category']}")
            if payload.get("status"):
                parts.append(f"Status: {payload['status']}")
            if payload.get("priority"):
                parts.append(f"Priority: {payload['priority']}")
            if payload.get("target_value") is not None:
                unit = payload.get("target_unit", "")
                parts.append(f"Target: {payload['target_value']} {unit}".strip())
            if payload.get("description"):
                parts.append(f"Description: {payload['description']}")

        case "financial_account":
            parts.append(f"Financial Account: {payload.get('account_name', 'Unknown')}")
            if payload.get("account_type"):
                parts.append(f"Type: {payload['account_type']}")
            if payload.get("institution"):
                parts.append(f"Institution: {payload['institution']}")
            if payload.get("current_balance") is not None:
                parts.append(f"Balance: {payload['current_balance']}")

        case "risk_assessment":
            parts.append("Risk Assessment")
            if payload.get("overall_score") is not None:
                parts.append(f"Overall Score: {payload['overall_score']}")
            if payload.get("risk_level"):
                parts.append(f"Risk Level: {payload['risk_level']}")
            if payload.get("assessment_type"):
                parts.append(f"Type: {payload['assessment_type']}")

        case "career_profile":
            parts.append("Career Profile")
            if payload.get("current_title"):
                parts.append(f"Title: {payload['current_title']}")
            if payload.get("current_employer"):
                parts.append(f"Employer: {payload['current_employer']}")
            if payload.get("industry"):
                parts.append(f"Industry: {payload['industry']}")
            if payload.get("years_experience") is not None:
                parts.append(f"Experience: {payload['years_experience']} years")

        case "education_record":
            parts.append(f"Education: {payload.get('institution_name', 'Unknown')}")
            if payload.get("degree_type"):
                parts.append(f"Degree: {payload['degree_type']}")
            if payload.get("field_of_study"):
                parts.append(f"Field: {payload['field_of_study']}")
            if payload.get("graduation_date"):
                parts.append(f"Graduated: {payload['graduation_date']}")
            if payload.get("gpa") is not None:
                parts.append(f"GPA: {payload['gpa']}")

        case "course":
            parts.append(f"Course: {payload.get('course_name', 'Unknown')}")
            if payload.get("provider"):
                parts.append(f"Provider: {payload['provider']}")
            if payload.get("level"):
                parts.append(f"Level: {payload['level']}")
            if payload.get("topic"):
                parts.append(f"Topic: {payload['topic']}")
            if payload.get("status"):
                parts.append(f"Status: {payload['status']}")

        case "job_application":
            parts.append(f"Job Application: {payload.get('position', 'Unknown')}")
            if payload.get("company"):
                parts.append(f"Company: {payload['company']}")
            if payload.get("status"):
                parts.append(f"Status: {payload['status']}")
            if payload.get("applied_date"):
                parts.append(f"Applied: {payload['applied_date']}")
            if payload.get("match_score") is not None:
                parts.append(f"Match Score: {payload['match_score']}")

        case "career_connection":
            parts.append(f"Connection: {payload.get('name', 'Unknown')}")
            if payload.get("company"):
                parts.append(f"Company: {payload['company']}")
            if payload.get("title"):
                parts.append(f"Title: {payload['title']}")
            if payload.get("relationship_type"):
                parts.append(f"Relationship: {payload['relationship_type']}")

        case "resume":
            parts.append(f"Resume: {payload.get('title', 'Untitled')}")
            if payload.get("version"):
                parts.append(f"Version: {payload['version']}")
            if payload.get("format"):
                parts.append(f"Format: {payload['format']}")
            if payload.get("tailored_for"):
                parts.append(f"Tailored for: {payload['tailored_for']}")

        case "financial_goal":
            parts.append(f"Financial Goal: {payload.get('name', 'Untitled')}")
            if payload.get("target_amount") is not None:
                parts.append(f"Target: ${payload['target_amount']}")
            if payload.get("current_amount") is not None:
                parts.append(f"Current: ${payload['current_amount']}")
            if payload.get("target_date"):
                parts.append(f"Target Date: {payload['target_date']}")
            if payload.get("priority"):
                parts.append(f"Priority: {payload['priority']}")

        case "investment_holding":
            symbol = payload.get("symbol") or payload.get("ticker_symbol", "")
            parts.append(f"Investment: {symbol or 'Unknown'}")
            if payload.get("quantity") is not None:
                parts.append(f"Quantity: {payload['quantity']}")
            if payload.get("cost_basis") is not None:
                parts.append(f"Cost Basis: ${payload['cost_basis']}")
            if payload.get("current_value") is not None:
                parts.append(f"Current Value: ${payload['current_value']}")

        case "transaction":
            parts.append(f"Transaction: {payload.get('description', payload.get('merchant', 'Unknown'))}")
            if payload.get("amount") is not None:
                parts.append(f"Amount: ${payload['amount']}")
            if payload.get("category"):
                parts.append(f"Category: {payload['category']}")
            if payload.get("date") or payload.get("transaction_date"):
                parts.append(f"Date: {payload.get('date') or payload.get('transaction_date')}")

        case "family_member":
            parts.append(f"Family Member: {payload.get('name', 'Unknown')}")
            if payload.get("relationship"):
                parts.append(f"Relationship: {payload['relationship']}")
            if payload.get("date_of_birth"):
                parts.append(f"DOB: {payload['date_of_birth']}")

        case "health_record":
            parts.append(f"Health Record: {payload.get('record_type', 'General')}")
            if payload.get("date") or payload.get("record_date"):
                parts.append(f"Date: {payload.get('date') or payload.get('record_date')}")
            if payload.get("provider"):
                parts.append(f"Provider: {payload['provider']}")
            if payload.get("notes"):
                parts.append(f"Notes: {payload['notes'][:200]}")

        case "health_metric":
            parts.append(f"Health Metric: {payload.get('metric_type', 'Unknown')}")
            if payload.get("value") is not None:
                unit = payload.get("unit", "")
                parts.append(f"Value: {payload['value']} {unit}".strip())
            if payload.get("date") or payload.get("measured_at"):
                parts.append(f"Date: {payload.get('date') or payload.get('measured_at')}")

        case "document":
            parts.append(f"Document: {payload.get('name', payload.get('document_name', 'Untitled'))}")
            if payload.get("document_type"):
                parts.append(f"Type: {payload['document_type']}")
            if payload.get("mime_type"):
                parts.append(f"Format: {payload['mime_type']}")

        case _:
            # Fallback: serialize the payload
            import json
            parts.append(json.dumps(payload)[:800])

    return ". ".join(parts)
