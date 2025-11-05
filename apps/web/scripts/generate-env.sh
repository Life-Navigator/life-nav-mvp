#!/bin/bash
# Script to generate environment files for different environments
# This script helps manage environment variables securely across environments

# Usage info
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -e, --env ENV    Target environment (dev, staging, prod)"
  echo "  -o, --output FILE Output file location (default: .env)"
  echo "  -h, --help       Show this help message"
  exit 1
}

# Parse arguments
ENV="dev"
OUTPUT_FILE=".env"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -e|--env) ENV="$2"; shift ;;
    -o|--output) OUTPUT_FILE="$2"; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown parameter: $1"; usage ;;
  esac
  shift
done

# Validate environment
if [[ ! "$ENV" =~ ^(dev|staging|prod)$ ]]; then
  echo "Invalid environment: $ENV. Must be one of: dev, staging, prod"
  exit 1
fi

# Source environment-specific values if available
ENV_VALUES_FILE="./env-values/${ENV}.env"
if [ -f "$ENV_VALUES_FILE" ]; then
  source "$ENV_VALUES_FILE"
else
  echo "Warning: Environment values file $ENV_VALUES_FILE not found."
  echo "You will be prompted for all required values."
fi

# Ensure required environment variables are set
ensure_var() {
  local var_name="$1"
  local default_value="${!var_name}"
  local is_secret="${2:-false}"
  local description="$3"
  local prompt_msg="Enter value for $var_name"
  
  if [ -n "$description" ]; then
    prompt_msg="$prompt_msg ($description)"
  fi
  
  if [ -z "$default_value" ]; then
    if [ "$is_secret" = true ]; then
      # Prompt for secret values without showing them
      echo "$prompt_msg:"
      read -s input_value
      echo  # Add a newline after the silent read
    else
      # Prompt for non-secret values
      echo "$prompt_msg:"
      read input_value
    fi
    
    # Use read value or default to empty string
    eval "${var_name}=\"${input_value:-""}\""
  fi
}

# Create output directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Ensure required variables
# Database configuration
ensure_var "DATABASE_URL" true "PostgreSQL connection string for database access"
ensure_var "DIRECT_URL" true "Optional direct URL for database access, if needed"

# Authentication configuration
ensure_var "NEXTAUTH_SECRET" true "Secret key for NextAuth (min 32 chars)"
ensure_var "NEXTAUTH_URL" false "Base URL of your application (domain)"

# OAuth providers (optional)
ensure_var "GOOGLE_CLIENT_ID" false "Google OAuth client ID (optional)"
ensure_var "GOOGLE_CLIENT_SECRET" true "Google OAuth client secret (optional)"
ensure_var "FACEBOOK_CLIENT_ID" false "Facebook OAuth client ID (optional)"
ensure_var "FACEBOOK_CLIENT_SECRET" true "Facebook OAuth client secret (optional)"
ensure_var "TWITTER_CLIENT_ID" false "Twitter OAuth client ID (optional)"
ensure_var "TWITTER_CLIENT_SECRET" true "Twitter OAuth client secret (optional)"

# Encryption keys
ensure_var "ENABLE_FIELD_ENCRYPTION" false "Enable field-level encryption (true/false)"
ensure_var "ENCRYPTION_MASTER_KEY" true "Master encryption key (32+ chars)"
ensure_var "ENCRYPTION_SALT" true "Salt value for key derivation"

# AWS configuration (if applicable)
ensure_var "AWS_REGION" false "AWS region (if using AWS services)"
ensure_var "AWS_ACCESS_KEY_ID" false "AWS access key (if using AWS services)"
ensure_var "AWS_SECRET_ACCESS_KEY" true "AWS secret key (if using AWS services)"
ensure_var "S3_BUCKET_NAME" false "S3 bucket for document storage (if applicable)"

# Document encryption (if applicable)
ensure_var "DOCUMENT_ENCRYPTION_KEY" true "Key for document encryption (32+ chars)"

# Environment and logging
ensure_var "NODE_ENV" false "Environment (development, production, test)"
ensure_var "LOG_LEVEL" false "Logging level (debug, info, warn, error)"
ensure_var "ENABLE_API_LOGGING" false "Log API requests (true/false)"

# Generate the environment file
cat > "$OUTPUT_FILE" << EOF
# LifeNavigator environment configuration
# Generated on $(date) for $ENV environment

# Database configuration
DATABASE_URL="${DATABASE_URL}"
${DIRECT_URL:+DIRECT_URL="${DIRECT_URL}"}

# NextAuth configuration
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="${NEXTAUTH_URL}"

# OAuth Providers
${GOOGLE_CLIENT_ID:+GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}"}
${GOOGLE_CLIENT_SECRET:+GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}"}
${FACEBOOK_CLIENT_ID:+FACEBOOK_CLIENT_ID="${FACEBOOK_CLIENT_ID}"}
${FACEBOOK_CLIENT_SECRET:+FACEBOOK_CLIENT_SECRET="${FACEBOOK_CLIENT_SECRET}"}
${TWITTER_CLIENT_ID:+TWITTER_CLIENT_ID="${TWITTER_CLIENT_ID}"}
${TWITTER_CLIENT_SECRET:+TWITTER_CLIENT_SECRET="${TWITTER_CLIENT_SECRET}"}

# Field-level encryption configuration
ENABLE_FIELD_ENCRYPTION="${ENABLE_FIELD_ENCRYPTION}"
ENCRYPTION_MASTER_KEY="${ENCRYPTION_MASTER_KEY}"
ENCRYPTION_SALT="${ENCRYPTION_SALT}"

# AWS Configuration (if applicable)
${AWS_REGION:+AWS_REGION="${AWS_REGION}"}
${AWS_ACCESS_KEY_ID:+AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"}
${AWS_SECRET_ACCESS_KEY:+AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"}
${S3_BUCKET_NAME:+S3_BUCKET_NAME="${S3_BUCKET_NAME}"}

# Document encryption
${DOCUMENT_ENCRYPTION_KEY:+DOCUMENT_ENCRYPTION_KEY="${DOCUMENT_ENCRYPTION_KEY}"}

# Environment settings
NODE_ENV="${NODE_ENV:-development}"
${LOG_LEVEL:+LOG_LEVEL="${LOG_LEVEL}"}
${ENABLE_API_LOGGING:+ENABLE_API_LOGGING="${ENABLE_API_LOGGING}"}
EOF

# Make the file readable only by the owner
chmod 600 "$OUTPUT_FILE"

echo "Environment file generated at $OUTPUT_FILE for $ENV environment."
echo "⚠️  Warning: This file contains sensitive information. Keep it secure and do not commit to version control."