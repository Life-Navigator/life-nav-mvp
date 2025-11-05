"""
Configuration settings for Financial Services API
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # Application
    VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, env="DEBUG")
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "LifeNavigator Financial Services"
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"
    
    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40
    
    # Redis
    REDIS_URL: str = Field(..., env="REDIS_URL")
    CACHE_TTL: int = 3600  # 1 hour default
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:3001",
        ],
        env="ALLOWED_ORIGINS"
    )
    
    # External APIs
    ALPHA_VANTAGE_API_KEY: Optional[str] = Field(None, env="ALPHA_VANTAGE_API_KEY")
    IEX_CLOUD_API_KEY: Optional[str] = Field(None, env="IEX_CLOUD_API_KEY")
    FRED_API_KEY: Optional[str] = Field(None, env="FRED_API_KEY")
    PLAID_CLIENT_ID: Optional[str] = Field(None, env="PLAID_CLIENT_ID")
    PLAID_SECRET: Optional[str] = Field(None, env="PLAID_SECRET")
    PLAID_ENVIRONMENT: str = Field(default="sandbox", env="PLAID_ENVIRONMENT")
    STRIPE_SECRET_KEY: Optional[str] = Field(None, env="STRIPE_SECRET_KEY")
    ALPACA_API_KEY: Optional[str] = Field(None, env="ALPACA_API_KEY")
    ALPACA_SECRET_KEY: Optional[str] = Field(None, env="ALPACA_SECRET_KEY")
    
    # Azure Services
    AZURE_OPENAI_ENDPOINT: Optional[str] = Field(None, env="AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_KEY: Optional[str] = Field(None, env="AZURE_OPENAI_API_KEY")
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = "json"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()