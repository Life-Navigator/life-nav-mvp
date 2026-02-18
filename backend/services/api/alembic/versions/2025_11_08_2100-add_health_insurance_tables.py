"""add health insurance tables

Revision ID: add_health_insurance_tables
Revises: add_job_board_integrations
Create Date: 2025-11-08 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_health_insurance_tables'
down_revision = 'add_job_board_integrations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create health_insurance table
    op.create_table(
        'health_insurance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        # Insurance Details
        sa.Column('insurance_type', sa.Enum('health', 'dental', 'vision', 'life', 'disability', name='insurancetype'), nullable=False),
        sa.Column('carrier_name', sa.String(255), nullable=False),
        sa.Column('carrier_logo', sa.String(500)),
        sa.Column('plan_name', sa.String(255), nullable=False),

        # Card Information
        sa.Column('member_id', sa.String(100), nullable=False),
        sa.Column('group_number', sa.String(100)),
        sa.Column('bin_number', sa.String(50)),
        sa.Column('pcn_number', sa.String(50)),

        # Coverage
        sa.Column('coverage_type', sa.Enum('individual', 'family', 'employee_only', 'employee_spouse', 'employee_children', name='coveragetype')),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('termination_date', sa.Date()),

        # Costs
        sa.Column('monthly_premium', sa.Float()),
        sa.Column('deductible_individual', sa.Float()),
        sa.Column('deductible_family', sa.Float()),
        sa.Column('out_of_pocket_max_individual', sa.Float()),
        sa.Column('out_of_pocket_max_family', sa.Float()),
        sa.Column('copay_primary_care', sa.Float()),
        sa.Column('copay_specialist', sa.Float()),
        sa.Column('copay_urgent_care', sa.Float()),
        sa.Column('copay_emergency_room', sa.Float()),

        # Network
        sa.Column('network_type', sa.String(50)),
        sa.Column('in_network', sa.Boolean(), default=True),

        # Provider Information
        sa.Column('primary_care_physician', sa.String(255)),
        sa.Column('pcp_phone', sa.String(20)),

        # Contact
        sa.Column('customer_service_phone', sa.String(20)),
        sa.Column('claims_address', sa.Text()),
        sa.Column('website_url', sa.String(500)),

        # Policy Details
        sa.Column('policy_number', sa.String(100)),
        sa.Column('employer', sa.String(255)),

        # Dependents
        sa.Column('dependents', postgresql.JSONB),

        # Card Images
        sa.Column('front_card_image', sa.String(500)),
        sa.Column('back_card_image', sa.String(500)),

        # Notes
        sa.Column('notes', sa.Text()),

        # Status
        sa.Column('is_active', sa.Boolean(), default=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_health_insurance_user_id', 'health_insurance', ['user_id'])
    op.create_index('ix_health_insurance_is_active', 'health_insurance', ['is_active'])

    # Create insurance_claims table
    op.create_table(
        'insurance_claims',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('insurance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('health_insurance.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        # Claim Details
        sa.Column('claim_number', sa.String(100), nullable=False),
        sa.Column('service_date', sa.Date(), nullable=False),
        sa.Column('provider_name', sa.String(255), nullable=False),

        # Amounts
        sa.Column('billed_amount', sa.Float(), nullable=False),
        sa.Column('covered_amount', sa.Float()),
        sa.Column('patient_responsibility', sa.Float()),
        sa.Column('paid_amount', sa.Float()),

        # Status
        sa.Column('status', sa.Enum('submitted', 'processing', 'approved', 'denied', 'paid', 'appealed', name='claimstatus'), nullable=False),
        sa.Column('status_date', sa.Date()),

        # Service
        sa.Column('service_type', sa.String(100)),
        sa.Column('diagnosis_codes', postgresql.JSONB),
        sa.Column('procedure_codes', postgresql.JSONB),

        # Documents
        sa.Column('eob_document', sa.String(500)),

        # Notes
        sa.Column('notes', sa.Text()),

        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_insurance_claims_user_id', 'insurance_claims', ['user_id'])
    op.create_index('ix_insurance_claims_insurance_id', 'insurance_claims', ['insurance_id'])
    op.create_index('ix_insurance_claims_claim_number', 'insurance_claims', ['claim_number'])
    op.create_index('ix_insurance_claims_status', 'insurance_claims', ['status'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('ix_insurance_claims_status', 'insurance_claims')
    op.drop_index('ix_insurance_claims_claim_number', 'insurance_claims')
    op.drop_index('ix_insurance_claims_insurance_id', 'insurance_claims')
    op.drop_index('ix_insurance_claims_user_id', 'insurance_claims')
    op.drop_table('insurance_claims')

    op.drop_index('ix_health_insurance_is_active', 'health_insurance')
    op.drop_index('ix_health_insurance_user_id', 'health_insurance')
    op.drop_table('health_insurance')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS claimstatus')
    op.execute('DROP TYPE IF EXISTS coveragetype')
    op.execute('DROP TYPE IF EXISTS insurancetype')
