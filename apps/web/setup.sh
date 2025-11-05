#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo "====================================================="
echo "             Life Navigator Setup Script             "
echo "====================================================="
echo -e "${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 20 or later.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)

if [ $NODE_MAJOR_VERSION -lt 20 ]; then
    echo -e "${RED}Node.js version $NODE_VERSION detected. Life Navigator requires Node.js 20 or later.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js v$NODE_VERSION${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker is not installed. Some features require Docker for local development.${NC}"
else
    echo -e "${GREEN}✓ Docker $(docker --version | cut -d ' ' -f 3 | tr -d ',')${NC}"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}⚠ Docker Compose is not installed. It's recommended for local development.${NC}"
    else
        echo -e "${GREEN}✓ Docker Compose $(docker-compose --version | cut -d ' ' -f 3 | tr -d ',')${NC}"
    fi
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n${YELLOW}Creating .env file from template...${NC}"
    cp env.example .env
    echo -e "${GREEN}✓ Created .env file. Please update it with your credentials.${NC}"
else
    echo -e "\n${GREEN}✓ .env file already exists.${NC}"
fi

# Check if Docker is running and start database
if command -v docker &> /dev/null; then
    echo -e "\n${YELLOW}Starting PostgreSQL database using Docker...${NC}"
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    sleep 5
    
    # Check if PostgreSQL is running
    if docker-compose ps | grep postgres | grep "Up" &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is running.${NC}"
    else
        echo -e "${RED}⚠ PostgreSQL failed to start. Please check Docker logs.${NC}"
    fi
else
    echo -e "\n${YELLOW}⚠ Skipping database setup because Docker is not installed.${NC}"
    echo -e "${YELLOW}⚠ You'll need to set up PostgreSQL manually.${NC}"
fi

# Generate Prisma client
echo -e "\n${YELLOW}Generating Prisma client...${NC}"
npx prisma generate

# Run migrations if database is available
if docker-compose ps | grep postgres | grep "Up" &> /dev/null; then
    echo -e "\n${YELLOW}Running database migrations...${NC}"
    npx prisma migrate dev --name init
    
    # Seed the database
    echo -e "\n${YELLOW}Seeding the database...${NC}"
    npm run db:seed
else
    echo -e "\n${YELLOW}⚠ Skipping database migrations because PostgreSQL is not running.${NC}"
fi

# Final message
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}          Life Navigator Setup Complete!            ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Update your ${YELLOW}.env${NC} file with required credentials"
echo -e "2. Run ${YELLOW}npm run dev${NC} to start the development server"
echo -e "3. Visit ${YELLOW}http://localhost:3000${NC} to see your application"
echo -e "\nSee the ${YELLOW}IMPLEMENTATION_GUIDE.md${NC} for detailed project architecture and instructions"
echo -e "\n${GREEN}Happy coding!${NC}\n"