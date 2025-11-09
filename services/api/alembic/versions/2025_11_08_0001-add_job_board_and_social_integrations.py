"""add job board and social integrations

Revision ID: add_job_board_integrations
Revises: a63b262ee16d
Create Date: 2025-11-08 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_job_board_integrations'
down_revision = 'a63b262ee16d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create job_listings table
    op.create_table(
        'job_listings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('company', sa.String(255), nullable=False),
        sa.Column('company_logo', sa.String(1000)),
        sa.Column('location', sa.String(500)),
        sa.Column('location_type', sa.Enum('onsite', 'remote', 'hybrid', name='locationtype')),
        sa.Column('employment_type', sa.Enum('full-time', 'part-time', 'contract', 'internship', 'temporary', name='employmenttype_job')),
        sa.Column('salary_min', sa.Float()),
        sa.Column('salary_max', sa.Float()),
        sa.Column('salary_currency', sa.String(3), default='USD'),
        sa.Column('salary_period', sa.String(50)),
        sa.Column('description', sa.Text()),
        sa.Column('requirements', postgresql.JSONB),
        sa.Column('responsibilities', postgresql.JSONB),
        sa.Column('benefits', postgresql.JSONB),
        sa.Column('skills', postgresql.JSONB),
        sa.Column('experience_level', sa.Enum('entry-level', 'mid-level', 'senior-level', 'executive', 'internship', name='experiencelevel')),
        sa.Column('years_of_experience_min', sa.Integer()),
        sa.Column('years_of_experience_max', sa.Integer()),
        sa.Column('category', sa.String(100)),
        sa.Column('industry', sa.String(100)),
        sa.Column('posted_date', sa.DateTime(), nullable=False),
        sa.Column('expiry_date', sa.DateTime()),
        sa.Column('platform', sa.Enum('linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'monster', name='platform'), nullable=False),
        sa.Column('external_id', sa.String(255), unique=True),
        sa.Column('external_url', sa.String(1000)),
        sa.Column('applicants', sa.Integer(), default=0),
        sa.Column('views', sa.Integer(), default=0),
        sa.Column('match_score', sa.Float()),
        sa.Column('is_saved', sa.Boolean(), default=False),
        sa.Column('is_applied', sa.Boolean(), default=False),
        sa.Column('applied_at', sa.DateTime()),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_job_listings_title', 'job_listings', ['title'])
    op.create_index('ix_job_listings_external_id', 'job_listings', ['external_id'])

    # Create gig_listings table
    op.create_table(
        'gig_listings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('client_name', sa.String(255)),
        sa.Column('client_rating', sa.Float()),
        sa.Column('client_reviews_count', sa.Integer(), default=0),
        sa.Column('client_country', sa.String(100)),
        sa.Column('client_verified', sa.Boolean(), default=False),
        sa.Column('budget_type', sa.Enum('fixed', 'hourly', name='budgettype'), nullable=False),
        sa.Column('budget_amount', sa.Float()),
        sa.Column('budget_min', sa.Float()),
        sa.Column('budget_max', sa.Float()),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('duration', sa.Enum('less-than-week', 'one-to-four-weeks', 'one-to-three-months', 'three-to-six-months', 'more-than-six-months', name='gigduration')),
        sa.Column('complexity', sa.Enum('basic', 'intermediate', 'expert', name='gigcomplexity')),
        sa.Column('category', sa.String(100)),
        sa.Column('subcategory', sa.String(100)),
        sa.Column('skills_required', postgresql.JSONB),
        sa.Column('experience_level', sa.String(50)),
        sa.Column('deliverables', postgresql.JSONB),
        sa.Column('posted_date', sa.DateTime(), nullable=False),
        sa.Column('deadline', sa.DateTime()),
        sa.Column('platform', sa.Enum('upwork', 'fiverr', 'freelancer', 'toptal', 'guru', name='gigplatform'), nullable=False),
        sa.Column('external_id', sa.String(255), unique=True),
        sa.Column('external_url', sa.String(1000)),
        sa.Column('proposals_count', sa.Integer(), default=0),
        sa.Column('avg_bid', sa.Float()),
        sa.Column('match_score', sa.Float()),
        sa.Column('is_saved', sa.Boolean(), default=False),
        sa.Column('is_applied', sa.Boolean(), default=False),
        sa.Column('proposal_submitted_at', sa.DateTime()),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_gig_listings_title', 'gig_listings', ['title'])
    op.create_index('ix_gig_listings_external_id', 'gig_listings', ['external_id'])

    # Create job_applications table
    op.create_table(
        'job_applications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('job_listing_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('job_listings.id')),
        sa.Column('external_job_id', sa.String(255)),
        sa.Column('job_title', sa.String(500), nullable=False),
        sa.Column('company', sa.String(255), nullable=False),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('applied', 'viewed', 'screening', 'interviewing', 'offered', 'accepted', 'rejected', 'declined', 'withdrawn', name='applicationstatus'), default='applied', nullable=False),
        sa.Column('applied_date', sa.DateTime(), nullable=False),
        sa.Column('resume_version', sa.String(255)),
        sa.Column('resume_url', sa.String(1000)),
        sa.Column('cover_letter', sa.Text()),
        sa.Column('portfolio_url', sa.String(1000)),
        sa.Column('notes', sa.Text()),
        sa.Column('follow_up_date', sa.DateTime()),
        sa.Column('contact_person', sa.String(255)),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('viewed_date', sa.DateTime()),
        sa.Column('screening_date', sa.DateTime()),
        sa.Column('interview_dates', postgresql.JSONB),
        sa.Column('offer_date', sa.DateTime()),
        sa.Column('response_deadline', sa.DateTime()),
        sa.Column('decision_date', sa.DateTime()),
        sa.Column('offer_salary', sa.Float()),
        sa.Column('offer_currency', sa.String(3), default='USD'),
        sa.Column('offer_benefits', postgresql.JSONB),
        sa.Column('rejection_reason', sa.Text()),
        sa.Column('feedback_received', sa.Text()),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )

    # Create gig_proposals table
    op.create_table(
        'gig_proposals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('gig_listing_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('gig_listings.id')),
        sa.Column('external_gig_id', sa.String(255)),
        sa.Column('gig_title', sa.String(500), nullable=False),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('applied', 'viewed', 'screening', 'interviewing', 'offered', 'accepted', 'rejected', 'declined', 'withdrawn', name='applicationstatus'), default='applied', nullable=False),
        sa.Column('submitted_date', sa.DateTime(), nullable=False),
        sa.Column('bid_amount', sa.Float(), nullable=False),
        sa.Column('bid_currency', sa.String(3), default='USD'),
        sa.Column('proposed_duration', sa.String(100)),
        sa.Column('cover_letter', sa.Text()),
        sa.Column('milestones', postgresql.JSONB),
        sa.Column('messages_count', sa.Integer(), default=0),
        sa.Column('last_message_date', sa.DateTime()),
        sa.Column('client_viewed_date', sa.DateTime()),
        sa.Column('interview_date', sa.DateTime()),
        sa.Column('awarded_date', sa.DateTime()),
        sa.Column('started_date', sa.DateTime()),
        sa.Column('completed_date', sa.DateTime()),
        sa.Column('contract_amount', sa.Float()),
        sa.Column('contract_terms', sa.Text()),
        sa.Column('notes', sa.Text()),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )

    # Create events table
    op.create_table(
        'events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('category', sa.Enum('networking', 'workshop', 'conference', 'seminar', 'career-fair', 'meetup', 'webinar', 'training', 'social', name='eventcategory')),
        sa.Column('organizer_name', sa.String(255)),
        sa.Column('organizer_logo', sa.String(1000)),
        sa.Column('organizer_url', sa.String(1000)),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime()),
        sa.Column('timezone', sa.String(100)),
        sa.Column('is_virtual', sa.Boolean(), default=False),
        sa.Column('venue_name', sa.String(255)),
        sa.Column('address', sa.String(500)),
        sa.Column('city', sa.String(100)),
        sa.Column('state', sa.String(100)),
        sa.Column('country', sa.String(100)),
        sa.Column('postal_code', sa.String(20)),
        sa.Column('online_url', sa.String(1000)),
        sa.Column('meeting_platform', sa.String(50)),
        sa.Column('requires_registration', sa.Boolean(), default=True),
        sa.Column('registration_url', sa.String(1000)),
        sa.Column('registration_deadline', sa.DateTime()),
        sa.Column('capacity', sa.Integer()),
        sa.Column('attendees_count', sa.Integer(), default=0),
        sa.Column('waitlist_available', sa.Boolean(), default=False),
        sa.Column('is_free', sa.Boolean(), default=True),
        sa.Column('price', sa.Float()),
        sa.Column('price_currency', sa.String(3), default='USD'),
        sa.Column('status', sa.Enum('upcoming', 'ongoing', 'completed', 'cancelled', name='eventstatus'), default='upcoming'),
        sa.Column('platform', sa.Enum('eventbrite', 'meetup', 'chamber', 'linkedin', 'facebook', name='eventplatform'), nullable=False),
        sa.Column('external_id', sa.String(255), unique=True),
        sa.Column('external_url', sa.String(1000)),
        sa.Column('tags', postgresql.JSONB),
        sa.Column('topics', postgresql.JSONB),
        sa.Column('match_score', sa.Float()),
        sa.Column('is_saved', sa.Boolean(), default=False),
        sa.Column('rsvp_status', sa.Enum('going', 'interested', 'not-going', 'waitlist', name='rsvpstatus')),
        sa.Column('rsvp_date', sa.DateTime()),
        sa.Column('attended', sa.Boolean()),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_events_title', 'events', ['title'])
    op.create_index('ix_events_start_date', 'events', ['start_date'])
    op.create_index('ix_events_external_id', 'events', ['external_id'])

    # Create event_attendees table
    op.create_table(
        'event_attendees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('events.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('attendee_name', sa.String(255)),
        sa.Column('attendee_title', sa.String(255)),
        sa.Column('attendee_company', sa.String(255)),
        sa.Column('attendee_profile_url', sa.String(1000)),
        sa.Column('connected', sa.Boolean(), default=False),
        sa.Column('connection_date', sa.DateTime()),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Create social_accounts table
    op.create_table(
        'social_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('platform', sa.Enum('linkedin', 'twitter', 'instagram', 'tiktok', 'facebook', 'youtube', name='socialplatform'), nullable=False),
        sa.Column('platform_user_id', sa.String(255)),
        sa.Column('username', sa.String(255)),
        sa.Column('display_name', sa.String(255)),
        sa.Column('profile_url', sa.String(1000)),
        sa.Column('avatar_url', sa.String(1000)),
        sa.Column('access_token', sa.Text()),
        sa.Column('refresh_token', sa.Text()),
        sa.Column('token_expires_at', sa.DateTime()),
        sa.Column('status', sa.Enum('connected', 'disconnected', 'expired', 'error', name='connectionstatus'), default='connected'),
        sa.Column('followers_count', sa.Integer(), default=0),
        sa.Column('following_count', sa.Integer(), default=0),
        sa.Column('posts_count', sa.Integer(), default=0),
        sa.Column('connections_count', sa.Integer()),
        sa.Column('scopes', postgresql.JSONB),
        sa.Column('last_synced_at', sa.DateTime()),
        sa.Column('sync_enabled', sa.Boolean(), default=True),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
        sa.Column('connected_at', sa.DateTime()),
    )

    # Create social_posts table
    op.create_table(
        'social_posts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('media_urls', postgresql.JSONB),
        sa.Column('hashtags', postgresql.JSONB),
        sa.Column('scheduled_at', sa.DateTime()),
        sa.Column('published_at', sa.DateTime()),
        sa.Column('is_draft', sa.Boolean(), default=False),
        sa.Column('platforms', postgresql.JSONB),
        sa.Column('linkedin_post_id', sa.String(255)),
        sa.Column('twitter_post_id', sa.String(255)),
        sa.Column('instagram_post_id', sa.String(255)),
        sa.Column('tiktok_post_id', sa.String(255)),
        sa.Column('facebook_post_id', sa.String(255)),
        sa.Column('total_likes', sa.Integer(), default=0),
        sa.Column('total_comments', sa.Integer(), default=0),
        sa.Column('total_shares', sa.Integer(), default=0),
        sa.Column('total_views', sa.Integer(), default=0),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_social_posts_published_at', 'social_posts', ['published_at'])

    # Create network_connections table
    op.create_table(
        'network_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('platform', sa.Enum('linkedin', 'twitter', 'instagram', 'tiktok', 'facebook', 'youtube', name='socialplatform'), default='linkedin'),
        sa.Column('connection_name', sa.String(255), nullable=False),
        sa.Column('connection_title', sa.String(255)),
        sa.Column('connection_company', sa.String(255)),
        sa.Column('connection_location', sa.String(255)),
        sa.Column('connection_profile_url', sa.String(1000)),
        sa.Column('connection_avatar_url', sa.String(1000)),
        sa.Column('platform_connection_id', sa.String(255)),
        sa.Column('relationship_note', sa.Text()),
        sa.Column('connection_strength', sa.Float()),
        sa.Column('last_interaction_date', sa.DateTime()),
        sa.Column('interaction_count', sa.Integer(), default=0),
        sa.Column('tags', postgresql.JSONB),
        sa.Column('connected_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )


def downgrade() -> None:
    op.drop_table('network_connections')
    op.drop_table('social_posts')
    op.drop_table('social_accounts')
    op.drop_table('event_attendees')
    op.drop_table('events')
    op.drop_table('gig_proposals')
    op.drop_table('job_applications')
    op.drop_table('gig_listings')
    op.drop_table('job_listings')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS connectionstatus')
    op.execute('DROP TYPE IF EXISTS socialplatform')
    op.execute('DROP TYPE IF EXISTS rsvpstatus')
    op.execute('DROP TYPE IF EXISTS eventstatus')
    op.execute('DROP TYPE IF EXISTS eventplatform')
    op.execute('DROP TYPE IF EXISTS eventcategory')
    op.execute('DROP TYPE IF EXISTS applicationstatus')
    op.execute('DROP TYPE IF EXISTS gigplatform')
    op.execute('DROP TYPE IF EXISTS gigcomplexity')
    op.execute('DROP TYPE IF EXISTS gigduration')
    op.execute('DROP TYPE IF EXISTS budgettype')
    op.execute('DROP TYPE IF EXISTS platform')
    op.execute('DROP TYPE IF EXISTS experiencelevel')
    op.execute('DROP TYPE IF EXISTS employmenttype_job')
    op.execute('DROP TYPE IF EXISTS locationtype')
