"""
Life Navigator - Main FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Life Navigator API",
    description="Production-grade AI life management platform backend",
    version="0.1.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Life Navigator API", "version": "0.1.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# TODO: Implement API routes
# - /api/v1/users
# - /api/v1/goals
# - /api/v1/health
# - /api/v1/finance
# - /api/v1/career
# - /api/v1/education
