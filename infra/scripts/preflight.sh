#!/usr/bin/env bash
#
# FloodWatch Pre-flight Checks
#
# Run before deployment to verify system readiness
# Exit 0 if all checks pass, 1 if any fail
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "======================================"
echo "FloodWatch Pre-flight Checks"
echo "======================================"
echo ""

# Check 1: Disk space
echo "[1/9] Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo -e "${RED}✗ Disk usage is ${DISK_USAGE}% (threshold: 80%)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Disk usage: ${DISK_USAGE}%${NC}"
fi
df -h / | tail -1
echo ""

# Check 2: Inodes
echo "[2/9] Checking inodes..."
INODE_USAGE=$(df -i / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$INODE_USAGE" -gt 80 ]; then
    echo -e "${RED}✗ Inode usage is ${INODE_USAGE}% (threshold: 80%)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Inode usage: ${INODE_USAGE}%${NC}"
fi
df -i / | tail -1
echo ""

# Check 3: Memory
echo "[3/9] Checking available memory..."
if command -v free &> /dev/null; then
    free -h
    MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
    if [ "$MEM_AVAILABLE" -lt 512 ]; then
        echo -e "${YELLOW}⚠ Low available memory: ${MEM_AVAILABLE}MB${NC}"
    else
        echo -e "${GREEN}✓ Available memory: ${MEM_AVAILABLE}MB${NC}"
    fi
elif command -v vm_stat &> /dev/null; then
    vm_stat | head -5
    echo -e "${GREEN}✓ Memory check (macOS)${NC}"
else
    echo -e "${YELLOW}⚠ Cannot check memory (no free/vm_stat)${NC}"
fi
echo ""

# Check 4: Time and timezone
echo "[4/9] Checking system time and timezone..."
date
if command -v timedatectl &> /dev/null; then
    timedatectl | grep "Time zone"
fi
echo -e "${GREEN}✓ Time zone checked${NC}"
echo ""

# Check 5: Docker
echo "[5/9] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ ${DOCKER_VERSION}${NC}"
fi
echo ""

# Check 6: Docker Compose
echo "[6/9] Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose (v2) not found${NC}"
    echo "  Install: https://docs.docker.com/compose/install/"
    ERRORS=$((ERRORS + 1))
else
    COMPOSE_VERSION=$(docker compose version)
    echo -e "${GREEN}✓ ${COMPOSE_VERSION}${NC}"
fi
echo ""

# Check 7: Required ports
echo "[7/9] Checking ports 80 and 443..."
PORT_CHECK=0
if command -v ss &> /dev/null; then
    if ss -tulpen 2>/dev/null | grep -q ':80 '; then
        echo -e "${YELLOW}⚠ Port 80 already in use${NC}"
        ss -tulpen 2>/dev/null | grep ':80 '
    else
        echo -e "${GREEN}✓ Port 80 available${NC}"
    fi

    if ss -tulpen 2>/dev/null | grep -q ':443 '; then
        echo -e "${YELLOW}⚠ Port 443 already in use${NC}"
        ss -tulpen 2>/dev/null | grep ':443 '
    else
        echo -e "${GREEN}✓ Port 443 available${NC}"
    fi
elif command -v lsof &> /dev/null; then
    # macOS fallback
    if lsof -iTCP:80 -sTCP:LISTEN &> /dev/null; then
        echo -e "${YELLOW}⚠ Port 80 already in use${NC}"
        lsof -iTCP:80 -sTCP:LISTEN
    else
        echo -e "${GREEN}✓ Port 80 available${NC}"
    fi

    if lsof -iTCP:443 -sTCP:LISTEN &> /dev/null; then
        echo -e "${YELLOW}⚠ Port 443 already in use${NC}"
        lsof -iTCP:443 -sTCP:LISTEN
    else
        echo -e "${GREEN}✓ Port 443 available${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Cannot check ports (no ss/lsof)${NC}"
fi
echo ""

# Check 8: Required directories
echo "[8/9] Checking required directories..."
DIRS=("infra/backups" "logs" "ops/snapshots")
for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}⚠ Creating $dir${NC}"
        mkdir -p "$dir"
    fi

    if [ -w "$dir" ]; then
        echo -e "${GREEN}✓ $dir is writable${NC}"
    else
        echo -e "${RED}✗ $dir is not writable${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# Check 9: .env.prod validation
echo "[9/9] Validating .env.prod..."
if [ ! -f ".env.prod" ]; then
    echo -e "${RED}✗ .env.prod not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    REQUIRED_VARS=(
        "ADMIN_TOKEN"
        "DATABASE_URL"
        "CORS_ORIGINS"
        "NEXT_PUBLIC_MAPBOX_TOKEN"
    )

    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env.prod; then
            VALUE=$(grep "^${var}=" .env.prod | cut -d= -f2 | tr -d '"' | head -c 20)
            if [ -z "$VALUE" ]; then
                echo -e "${RED}✗ ${var} is empty${NC}"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "${GREEN}✓ ${var} is set${NC}"
            fi
        else
            echo -e "${RED}✗ ${var} not found in .env.prod${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi
echo ""

# Summary
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All pre-flight checks passed!${NC}"
    echo "Ready to deploy."
    exit 0
else
    echo -e "${RED}✗ ${ERRORS} check(s) failed${NC}"
    echo "Please fix the issues above before deploying."
    exit 1
fi
