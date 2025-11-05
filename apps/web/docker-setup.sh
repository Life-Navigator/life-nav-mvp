#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo "====================================================="
echo "          Docker Setup for Life Navigator            "
echo "====================================================="
echo -e "${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    echo -e "Visit: https://docs.docker.com/engine/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed: $(docker --version)${NC}"

# Check if user is in docker group
if groups | grep -q docker; then
    echo -e "${GREEN}✓ User is already in the docker group${NC}"
else
    echo -e "${YELLOW}User is not in the docker group. Adding user to docker group...${NC}"
    echo -e "${YELLOW}You will need to enter your password for sudo access.${NC}"
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ User added to docker group${NC}"
    echo -e "${YELLOW}Important: You need to log out and log back in for the group changes to take effect.${NC}"
fi

# Check if Docker service is running
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓ Docker service is running${NC}"
else
    echo -e "${YELLOW}Docker service is not running. Starting Docker service...${NC}"
    echo -e "${YELLOW}You will need to enter your password for sudo access.${NC}"
    sudo systemctl start docker
    sudo systemctl enable docker
    echo -e "${GREEN}✓ Docker service started and enabled${NC}"
fi

# Test Docker functionality
echo -e "\n${YELLOW}Testing Docker functionality...${NC}"
if docker run --rm hello-world &> /dev/null; then
    echo -e "${GREEN}✓ Docker is working correctly!${NC}"
else
    echo -e "${RED}Failed to run Docker test container.${NC}"
    echo -e "${YELLOW}If you just added yourself to the docker group, you need to log out and log back in first.${NC}"
    exit 1
fi

# Set up Docker Compose
echo -e "\n${YELLOW}Checking Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose is installed: $(docker-compose --version)${NC}"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose V2 is installed (as docker compose plugin)${NC}"
else
    echo -e "${YELLOW}Docker Compose is not installed. Installing Docker Compose...${NC}"
    echo -e "${YELLOW}You will need to enter your password for sudo access.${NC}"
    
    # Install Docker Compose V2 plugin
    DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
    mkdir -p $DOCKER_CONFIG/cli-plugins
    sudo curl -SL https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

# Final message
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}          Docker Setup Complete!                     ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. If you added yourself to the docker group, log out and log back in"
echo -e "2. Run ${YELLOW}./setup.sh${NC} to set up the Life Navigator application"
echo -e "3. Or run ${YELLOW}docker-compose up -d${NC} to start the development environment"
echo -e "\n${GREEN}Happy coding!${NC}\n"