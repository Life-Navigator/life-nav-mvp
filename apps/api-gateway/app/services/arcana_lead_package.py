"""Arcana lead-package preview + consent-gated send.

The package is a structured snapshot of the user's health-related
context (goals, fitness, diet, sleep, injuries, motivation, risk,
constraints) that LifeNavigator hands to Arcana once the user grants
the ``arcana_lead_sharing`` consent.

This module is pure data: ``preview`` builds the snapshot in memory and
``send`` requires a recorded consent before persisting the package and
hitting Arcana's intake endpoint. Both paths emit an audit-log entry
the caller is expected to persist.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ArcanaLeadPackage:
    user_id: str
    generated_at: dt.datetime
    goals: list[dict[str, Any]] = field(default_factory=list)
    current_health_status: dict[str, Any] = field(default_factory=dict)
    fitness_level: dict[str, Any] = field(default_factory=dict)
    diet: dict[str, Any] = field(default_factory=dict)
    sleep: dict[str, Any] = field(default_factory=dict)
    injuries: list[dict[str, Any]] = field(default_factory=list)
    recovery: dict[str, Any] = field(default_factory=dict)
    timeline: dict[str, Any] = field(default_factory=dict)
    motivation: list[dict[str, Any]] = field(default_factory=list)
    risk_tolerance: dict[str, Any] = field(default_factory=dict)
    constraints: list[dict[str, Any]] = field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "generated_at": self.generated_at.isoformat(),
            "goals": self.goals,
            "current_health_status": self.current_health_status,
            "fitness_level": self.fitness_level,
            "diet": self.diet,
            "sleep": self.sleep,
            "injuries": self.injuries,
            "recovery": self.recovery,
            "timeline": self.timeline,
            "motivation": self.motivation,
            "risk_tolerance": self.risk_tolerance,
            "constraints": self.constraints,
        }


@dataclass
class AuditEvent:
    user_id: str
    action: str               # 'arcana_preview' | 'arcana_sent' | 'arcana_blocked_no_consent'
    occurred_at: dt.datetime
    metadata: dict[str, Any]


def build_preview(user_id: str, snapshot: dict[str, Any]) -> tuple[ArcanaLeadPackage, AuditEvent]:
    """Build a preview package from the user-graph snapshot.

    ``snapshot`` is the dict the caller (FastAPI route) assembled from
    the user's owned tables — we don't read Supabase from here so the
    function is unit-testable without a database.
    """
    if not user_id:
        raise ValueError("user_id required")
    now = dt.datetime.now(dt.timezone.utc)
    pkg = ArcanaLeadPackage(
        user_id=user_id,
        generated_at=now,
        goals=list(snapshot.get("goals", [])),
        current_health_status=dict(snapshot.get("health_status", {})),
        fitness_level=dict(snapshot.get("fitness_level", {})),
        diet=dict(snapshot.get("diet", {})),
        sleep=dict(snapshot.get("sleep", {})),
        injuries=list(snapshot.get("injuries", [])),
        recovery=dict(snapshot.get("recovery", {})),
        timeline=dict(snapshot.get("timeline", {})),
        motivation=list(snapshot.get("motivation", [])),
        risk_tolerance=dict(snapshot.get("risk_tolerance", {})),
        constraints=list(snapshot.get("constraints", [])),
    )
    audit = AuditEvent(
        user_id=user_id,
        action="arcana_preview",
        occurred_at=now,
        metadata={"package_size": _size_estimate(pkg)},
    )
    return pkg, audit


def authorize_send(consent_record: Optional[dict[str, Any]]) -> bool:
    """Return True if the consent record is a granted, unrevoked, unexpired
    grant for ``arcana_lead_sharing``.
    """
    if not consent_record:
        return False
    if consent_record.get("integration") != "arcana_lead_sharing":
        return False
    if not consent_record.get("granted"):
        return False
    if consent_record.get("revoked_at"):
        return False
    expires_at = consent_record.get("expires_at")
    if expires_at:
        try:
            exp = dt.datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        except ValueError:
            exp = None
        if exp is not None and exp < dt.datetime.now(dt.timezone.utc):
            return False
    return True


def block_or_send(
    package: ArcanaLeadPackage,
    consent_record: Optional[dict[str, Any]],
) -> tuple[bool, AuditEvent]:
    """Returns ``(authorized, audit_event)``.

    The caller hits Arcana's intake endpoint only when ``authorized`` is
    True. The audit event is to be persisted in either case.
    """
    now = dt.datetime.now(dt.timezone.utc)
    if not authorize_send(consent_record):
        return False, AuditEvent(
            user_id=package.user_id,
            action="arcana_blocked_no_consent",
            occurred_at=now,
            metadata={"reason": "consent missing, revoked, or expired"},
        )
    return True, AuditEvent(
        user_id=package.user_id,
        action="arcana_sent",
        occurred_at=now,
        metadata={
            "package_size": _size_estimate(package),
            "consent_version": consent_record.get("consent_version"),
        },
    )


def _size_estimate(pkg: ArcanaLeadPackage) -> int:
    return (
        len(pkg.goals)
        + len(pkg.injuries)
        + len(pkg.motivation)
        + len(pkg.constraints)
        + (1 if pkg.current_health_status else 0)
        + (1 if pkg.fitness_level else 0)
        + (1 if pkg.diet else 0)
        + (1 if pkg.sleep else 0)
        + (1 if pkg.recovery else 0)
        + (1 if pkg.timeline else 0)
        + (1 if pkg.risk_tolerance else 0)
    )
