from sqlalchemy import Column, String, Boolean, ARRAY, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base_class import Base


class IntegrationPlatform(Base):
    """Integration platform definitions - all available platforms users can connect"""
    __tablename__ = "integration_platforms"

    id = Column(String, primary_key=True, index=True)  # e.g., 'plaid', 'smartcar'
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # finance, education, career, healthcare, automotive, smarthome
    logo = Column(String, nullable=False)
    coming_soon = Column(Boolean, default=False)
    permissions = Column(ARRAY(String), nullable=False)
    modal_description = Column(Text, nullable=True)

    # OAuth/API configuration (can be null for coming soon platforms)
    oauth_config = Column(JSONB, nullable=True)  # {"client_id_env": "PLAID_CLIENT_ID", "auth_url": "...", etc}
    api_docs_url = Column(String, nullable=True)

    # Display order
    display_order = Column(Integer, default=0)

    # Enable/disable platforms
    is_active = Column(Boolean, default=True)
