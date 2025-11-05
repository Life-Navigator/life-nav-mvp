"""
Main API Router for Finance Service
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    profile,
    goals,
    investments,
    accounts,
    transactions,
    budgets,
    analytics,
    plaid
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(
    profile.router,
    prefix="/profile",
    tags=["Profile"]
)

api_router.include_router(
    goals.router,
    prefix="/goals",
    tags=["Goals"]
)

api_router.include_router(
    investments.router,
    prefix="/investments",
    tags=["Investments"]
)

api_router.include_router(
    accounts.router,
    prefix="/accounts",
    tags=["Accounts"]
)

api_router.include_router(
    transactions.router,
    prefix="/transactions",
    tags=["Transactions"]
)

api_router.include_router(
    budgets.router,
    prefix="/budgets",
    tags=["Budgets"]
)

api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["Analytics"]
)

api_router.include_router(
    plaid.router,
    prefix="/plaid",
    tags=["Banking Integration"]
)