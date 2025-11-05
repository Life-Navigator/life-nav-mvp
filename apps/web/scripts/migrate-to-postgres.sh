#!/bin/bash

# ------------------------------------------------------------------------------
# PostgreSQL Migration Script for LifeNavigator
# This script automates the migration from SQLite to PostgreSQL
# ------------------------------------------------------------------------------

set -e

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="lifenavigator"
DB_PORT="5432"
PG_USER="postgres"
PG_PASSWORD="postgres"
PG_HOST="localhost"
ENV_FILE=".env"
PG_ENV_FILE=".env.postgres"
DOCKER_COMPOSE_FILE="docker-compose.postgres.yml"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Print script header
echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}            LifeNavigator PostgreSQL Migration           ${NC}"
echo -e "${BLUE}=========================================================${NC}"

# Create backup directory
mkdir -p $BACKUP_DIR

# Function to check Docker installation
check_docker() {
  echo -e "\n${YELLOW}Checking Docker installation...${NC}"
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed! Please install Docker first.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Docker is installed${NC}"
  
  if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed! Please install Docker Compose first.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Docker Compose is installed${NC}"
}

# Function to start PostgreSQL container
start_postgres() {
  echo -e "\n${YELLOW}Starting PostgreSQL container...${NC}"
  
  # Create Docker Compose file for PostgreSQL if it doesn't exist
  if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    cat > ${DOCKER_COMPOSE_FILE} << EOF
version: '3.8'
services:
  postgres:
    image: postgres:14
    container_name: lifenavigator-postgres
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_USER: postgres
      POSTGRES_DB: lifenavigator
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
volumes:
  postgres_data:
EOF
    echo "Created Docker Compose file for PostgreSQL"
  fi
  
  if ! docker ps | grep -q "postgres"; then
    echo "Starting PostgreSQL using docker-compose..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    sleep 5
    
    MAX_RETRIES=30
    RETRIES=0
    
    while ! docker exec -i $(docker ps -q -f name=postgres) pg_isready -h localhost -U postgres &> /dev/null; do
      RETRIES=$((RETRIES+1))
      if [ $RETRIES -gt $MAX_RETRIES ]; then
        echo -e "${RED}Failed to connect to PostgreSQL after $MAX_RETRIES attempts.${NC}"
        exit 1
      fi
      echo "Waiting for PostgreSQL to be ready... ($RETRIES/$MAX_RETRIES)"
      sleep 2
    done
  fi
  echo -e "${GREEN}✓ PostgreSQL is running${NC}"
}

# Function to create database
create_database() {
  echo -e "\n${YELLOW}Creating PostgreSQL database if it doesn't exist...${NC}"
  if ! docker exec -i $(docker ps -q -f name=postgres) psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "Creating database: $DB_NAME"
    docker exec -i $(docker ps -q -f name=postgres) psql -U postgres -c "CREATE DATABASE $DB_NAME;"
  else
    echo "Database already exists"
  fi
  echo -e "${GREEN}✓ Database is ready${NC}"
}

# Function to backup the current environment
backup_environment() {
  echo -e "\n${YELLOW}Backing up current environment...${NC}"
  
  # Backup .env file if it exists
  if [ -f $ENV_FILE ]; then
    cp $ENV_FILE "$BACKUP_DIR/$ENV_FILE.backup"
    echo "Environment file backed up to $BACKUP_DIR/$ENV_FILE.backup"
  fi
  
  # Backup SQLite database
  if [ -f "prisma/dev.db" ]; then
    cp prisma/dev.db "$BACKUP_DIR/dev.db.backup"
    echo "SQLite database backed up to $BACKUP_DIR/dev.db.backup"
  fi
  
  # Backup Prisma schema
  cp prisma/schema.prisma "$BACKUP_DIR/schema.prisma.backup"
  echo "Prisma schema backed up to $BACKUP_DIR/schema.prisma.backup"
  
  echo -e "${GREEN}✓ Environment backup complete${NC}"
}

# Function to update Prisma schema
update_prisma_schema() {
  echo -e "\n${YELLOW}Updating Prisma schema for PostgreSQL...${NC}"
  
  # Replace SQLite provider with PostgreSQL
  if grep -q "provider = \"sqlite\"" prisma/schema.prisma; then
    cp prisma/schema.prisma prisma/schema.prisma.sqlite.backup
    cp prisma/schema.prisma.postgres prisma/schema.prisma
    if [ $? -ne 0 ]; then
      echo -e "${RED}Error: Failed to update Prisma schema${NC}"
      exit 1
    fi
    echo "Updated Prisma schema to use PostgreSQL provider"
  else
    echo "Prisma schema already configured for PostgreSQL"
  fi
  
  echo -e "${GREEN}✓ Prisma schema updated${NC}"
}

# Function to create PostgreSQL connection string
create_pg_env() {
  echo -e "\n${YELLOW}Creating PostgreSQL environment variables...${NC}"
  
  # Create PostgreSQL connection string
  PG_CONNECTION_STRING="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$DB_PORT/$DB_NAME?schema=public"
  
  # Create new .env.postgres file
  echo "# PostgreSQL Environment Configuration" > $PG_ENV_FILE
  echo "DATABASE_URL=\"$PG_CONNECTION_STRING\"" >> $PG_ENV_FILE
  
  # Copy other variables from existing .env if it exists
  if [ -f $ENV_FILE ]; then
    grep -v "DATABASE_URL" $ENV_FILE | grep -v "^#" | grep "=" >> $PG_ENV_FILE
  fi
  
  echo -e "${GREEN}✓ PostgreSQL environment variables created in $PG_ENV_FILE${NC}"
  echo -e "${BLUE}Connection string: $PG_CONNECTION_STRING${NC}"
}

# Function to run Prisma migrations
run_migrations() {
  echo -e "\n${YELLOW}Running Prisma migrations...${NC}"
  
  # Set the PostgreSQL connection string
  export DATABASE_URL="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$DB_PORT/$DB_NAME?schema=public"
  
  # Generate migration
  npx prisma migrate dev --name migrate_to_postgres --create-only
  
  # Apply migration
  echo "Applying database migration..."
  npx prisma migrate deploy
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Migration failed${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Database migrations completed successfully${NC}"
}

# Function to seed the database
seed_database() {
  echo -e "\n${YELLOW}Seeding the PostgreSQL database...${NC}"
  
  npx prisma db seed
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: Database seeding failed. You may need to manually seed the database.${NC}"
  else
    echo -e "${GREEN}✓ Database seeded successfully${NC}"
  fi
}

# Function to verify the migration
verify_migration() {
  echo -e "\n${YELLOW}Verifying migration...${NC}"
  
  # Generate Prisma client
  echo "Generating Prisma client..."
  npx prisma generate
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to generate Prisma client${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Migration verification completed successfully${NC}"
}

# Function to update environment configuration
update_env() {
  echo -e "\n${YELLOW}Updating environment configuration...${NC}"
  
  # Backup the original .env file
  if [ -f $ENV_FILE ]; then
    cp $ENV_FILE "$ENV_FILE.sqlite.backup"
    echo "Original .env backed up to $ENV_FILE.sqlite.backup"
  fi
  
  # Copy the PostgreSQL env to the main env file
  cp $PG_ENV_FILE $ENV_FILE
  
  echo -e "${GREEN}✓ Environment configuration updated${NC}"
  echo -e "${BLUE}Your main .env file now uses PostgreSQL${NC}"
}

# Main migration process
main() {
  echo -e "\n${YELLOW}Starting database migration process...${NC}"
  
  # Check Docker installation
  check_docker
  
  # Backup current environment
  backup_environment
  
  # Start PostgreSQL
  start_postgres
  
  # Create database
  create_database
  
  # Update Prisma schema for PostgreSQL
  update_prisma_schema
  
  # Create PostgreSQL environment variables
  create_pg_env
  
  # Run migrations
  run_migrations
  
  # Generate Prisma client
  verify_migration
  
  # Seed the database
  seed_database
  
  # Update environment configuration
  update_env
  
  echo -e "\n${GREEN}==================================================${NC}"
  echo -e "${GREEN}    Migration to PostgreSQL completed successfully!   ${NC}"
  echo -e "${GREEN}==================================================${NC}"
  echo -e "\n${BLUE}Next steps:${NC}"
  echo -e "1. Test your application with PostgreSQL"
  echo -e "2. Update your deployment configuration"
  echo -e "3. Ensure all team members use the PostgreSQL setup"
  echo -e "\n${BLUE}If you need to revert:${NC}"
  echo -e "1. Restore your backed up .env file from $ENV_FILE.sqlite.backup"
  echo -e "2. Restore your backed up Prisma schema from $BACKUP_DIR/schema.prisma.backup"
  echo -e "\n${BLUE}Backups are located in: ${NC}$BACKUP_DIR"
}

# Run the migration process
main