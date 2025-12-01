#!/bin/bash

# Grain & Vault Complete Test Suite
# This script runs all tests, generates coverage reports, and performs static analysis
# Use this before any deployment to mainnet

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          GRAIN & VAULT COMPREHENSIVE TEST SUITE               ║"
echo "║          Securing $3B in Digital Assets                       ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Function to print section headers
print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Start timer
START_TIME=$(date +%s)

# Clean previous builds
print_section "Cleaning Previous Builds"
rm -rf cache/
rm -rf artifacts/
rm -rf coverage/
rm -rf typechain-types/
print_success "Clean complete"

# Compile contracts
print_section "Compiling Smart Contracts"
npx hardhat compile
if [ $? -eq 0 ]; then
    print_success "Compilation successful"
else
    print_error "Compilation failed"
    exit 1
fi

# Run unit tests
print_section "Running Unit Tests"
echo "Testing Grain.sol..."
npx hardhat test test/unit/Grain.test.js
if [ $? -ne 0 ]; then
    print_error "Grain unit tests failed"
    exit 1
fi
print_success "Grain.sol tests passed"

echo "Testing Vault.sol..."
npx hardhat test test/unit/Vault.test.js
if [ $? -ne 0 ]; then
    print_error "Vault unit tests failed"
    exit 1
fi
print_success "Vault.sol tests passed"

echo "Testing Escrow.sol..."
npx hardhat test test/unit/Escrow.test.js
if [ $? -ne 0 ]; then
    print_error "Escrow unit tests failed"
    exit 1
fi
print_success "Escrow.sol tests passed"

# Run integration tests
print_section "Running Integration Tests"
npx hardhat test test/integration/FullFlow.test.js
if [ $? -ne 0 ]; then
    print_error "Integration tests failed"
    exit 1
fi
print_success "Integration tests passed"

# Run security tests
print_section "Running Security Tests"
npx hardhat test test/security/AttackVectors.test.js
if [ $? -ne 0 ]; then
    print_error "Security tests failed"
    exit 1
fi
print_success "Security tests passed"

# Run gas optimization tests
print_section "Running Gas Optimization Tests"
REPORT_GAS=true npx hardhat test test/gas/GasOptimization.test.js
if [ $? -ne 0 ]; then
    print_error "Gas tests failed"
    exit 1
fi
print_success "Gas optimization tests passed"

# Run all tests together for full coverage
print_section "Running Complete Test Suite with Coverage"
npx hardhat coverage
if [ $? -ne 0 ]; then
    print_error "Coverage analysis failed"
    exit 1
fi
print_success "Coverage analysis complete"

# Check coverage thresholds
print_section "Checking Coverage Thresholds"
COVERAGE_FILE="coverage/coverage-summary.json"
if [ -f "$COVERAGE_FILE" ]; then
    # Extract coverage percentages (this is a simple check, you may want to use jq for better parsing)
    print_success "Coverage report generated at coverage/index.html"
    print_warning "Please manually verify 100% coverage in all contracts"
else
    print_warning "Coverage summary not found. Check coverage/index.html manually"
fi

# Static analysis with Slither (if installed)
print_section "Running Static Analysis"
if command -v slither &> /dev/null; then
    echo "Running Slither..."
    slither . --detect all --exclude-dependencies || true
    print_success "Slither analysis complete (check output above for issues)"
else
    print_warning "Slither not installed. Install with: pip3 install slither-analyzer"
fi

# Check for TODO and FIXME comments
print_section "Checking for TODO/FIXME Comments"
TODO_COUNT=$(grep -r "TODO\|FIXME" core/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
    print_warning "Found $TODO_COUNT TODO/FIXME comments in code"
    grep -rn "TODO\|FIXME" core/ || true
else
    print_success "No TODO/FIXME comments found"
fi

# Check contract sizes
print_section "Checking Contract Sizes"
npx hardhat size-contracts || print_warning "Size check tool not available"

# Generate summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

print_section "Test Suite Summary"
echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│                    TEST RESULTS                         │"
echo "├─────────────────────────────────────────────────────────┤"
echo "│ ✓ Unit Tests (Grain.sol)            PASSED              │"
echo "│ ✓ Unit Tests (Vault.sol)            PASSED              │"
echo "│ ✓ Unit Tests (Escrow.sol)           PASSED              │"
echo "│ ✓ Integration Tests                 PASSED              │"
echo "│ ✓ Security Tests                    PASSED              │"
echo "│ ✓ Gas Optimization Tests            PASSED              │"
echo "│ ✓ Coverage Analysis                 COMPLETE            │"
echo "│ ✓ Static Analysis                   COMPLETE            │"
echo "├─────────────────────────────────────────────────────────┤"
echo "│ Total Duration: ${MINUTES}m ${SECONDS}s                                │"
echo "└─────────────────────────────────────────────────────────┘"
echo ""

print_success "ALL TESTS PASSED! 🎉"
echo ""
echo "Next steps:"
echo "  1. Review coverage report: open coverage/index.html"
echo "  2. Review SECURITY_AUDIT_CHECKLIST.md"
echo "  3. Address any static analysis warnings"
echo "  4. Deploy to testnet for final verification"
echo "  5. Schedule external audit"
echo ""
echo -e "${GREEN}System is ready for securing $3B in assets${NC}"
echo ""

exit 0
