#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    NotebookLM RAG - Startup Guide                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
echo -e "${YELLOW}[1/5] Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 16 or higher${NC}"
    exit 1
fi

# Check if Docker is installed
echo ""
echo -e "${YELLOW}[2/5] Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ $DOCKER_VERSION found${NC}"
    
    # Check if Qdrant is running
    if docker ps | grep -q qdrant; then
        echo -e "${GREEN}✓ Qdrant container is already running${NC}"
    else
        echo -e "${YELLOW}Qdrant not running. Starting Qdrant...${NC}"
        docker run -d -p 6333:6333 qdrant/qdrant
        echo -e "${GREEN}✓ Qdrant started (docker run -d -p 6333:6333 qdrant/qdrant)${NC}"
        echo -e "${YELLOW}  Waiting for Qdrant to be ready...${NC}"
        sleep 3
    fi
else
    echo -e "${YELLOW}⚠ Docker not found.${NC}"
    echo -e "${YELLOW}  You can:${NC}"
    echo -e "${YELLOW}  1. Install Docker: https://docs.docker.com/get-docker/${NC}"
    echo -e "${YELLOW}  2. Use cloud Qdrant at: https://qdrant.tech${NC}"
    echo -e "${YELLOW}  3. Update .env with your Qdrant URL${NC}"
fi

# Check dependencies
echo ""
echo -e "${YELLOW}[3/5] Checking dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
else
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Check build
echo ""
echo -e "${YELLOW}[4/5] Checking TypeScript build...${NC}"
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
    echo -e "${GREEN}✓ TypeScript already compiled${NC}"
else
    echo -e "${YELLOW}Building TypeScript...${NC}"
    npm run build
    echo -e "${GREEN}✓ TypeScript built${NC}"
fi

# Check configuration
echo ""
echo -e "${YELLOW}[5/5] Checking configuration...${NC}"
if [ -f ".env" ]; then
    if grep -q "GEMINI_API_KEY" .env; then
        echo -e "${GREEN}✓ .env file configured${NC}"
    else
        echo -e "${YELLOW}⚠ GEMINI_API_KEY not found in .env${NC}"
    fi
else
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env created${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Setup Complete! 🎉                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}You can now start the application in 3 ways:${NC}"
echo ""
echo -e "${BLUE}1. Web UI (Recommended):${NC}"
echo -e "   ${GREEN}npm start${NC}"
echo -e "   Then open: ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}2. Command Line Interface:${NC}"
echo -e "   ${GREEN}npm run cli${NC}"
echo ""
echo -e "${BLUE}3. Development Mode (Auto-reload):${NC}"
echo -e "   ${GREEN}npm run dev${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Run: npm start"
echo "  2. Upload a PDF or TXT file"
echo "  3. Ask questions about the document"
echo "  4. See answers with sources"
echo ""

echo -e "${YELLOW}Documentation:${NC}"
echo "  • Full guide: README.md"
echo "  • Quick reference: QUICKSTART.md"
echo "  • Feature list: CHECKLIST.md"
echo "  • Project info: PROJECT_SUMMARY.md"
echo ""

echo -e "${GREEN}Happy chatting! 📚💬${NC}"
