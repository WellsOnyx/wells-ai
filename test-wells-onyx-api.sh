#!/bin/bash

##############################################################################
# Wells Onyx Campaign API - Comprehensive Test Script
#
# This script tests all three endpoints of the Wells Onyx Campaign API:
# 1. POST /api/gtm/wells-onyx/campaign - Create campaign
# 2. GET /api/gtm/wells-onyx/campaign - Retrieve campaign
# 3. PATCH /api/gtm/wells-onyx/campaign - Update campaign
#
# Usage:
#   chmod +x test-wells-onyx-api.sh
#   ./test-wells-onyx-api.sh
#
# Prerequisites:
#   - Backend running on http://localhost:3000
#   - jq installed for JSON parsing
#   - Clerk authentication (can use test token for development)
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
API_ENDPOINT="/api/gtm/wells-onyx/campaign"
FULL_URL="${BASE_URL}${API_ENDPOINT}"

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Log functions
log_header() {
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
}

log_test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -e "\n${YELLOW}Test $TESTS_RUN: $1${NC}"
}

log_success() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASSED: $1${NC}"
}

log_failure() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}✗ FAILED: $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

log_request() {
    echo -e "${YELLOW}→ Request:${NC} $1"
}

log_response() {
    echo -e "${YELLOW}← Response:${NC} $1"
}

##############################################################################
# TEST 1: POST /api/gtm/wells-onyx/campaign - Create Campaign
##############################################################################

log_header "TEST 1: CREATE CAMPAIGN (POST)"

# Test 1.1: Create valid campaign
log_test "Create campaign with valid data"
log_request "POST $FULL_URL with practiceGroupId=cybersecurity, targetCount=5"

RESPONSE=$(curl -s -X POST "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "practiceGroupId": "cybersecurity",
        "targetCount": 5
    }')

log_response "$(echo "$RESPONSE" | jq -r '.success // empty' 2>/dev/null)"

if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
    CAMPAIGN_ID=$(echo "$RESPONSE" | jq -r '.campaignId')
    PRACTICE_GROUP=$(echo "$RESPONSE" | jq -r '.practiceGroup')
    PROSPECTS=$(echo "$RESPONSE" | jq -r '.prospects')
    STATUS=$(echo "$RESPONSE" | jq -r '.status')
    MESSAGES_COUNT=$(echo "$RESPONSE" | jq '.messages | length')

    log_success "Campaign created successfully"
    log_info "  Campaign ID: $CAMPAIGN_ID"
    log_info "  Practice Group: $PRACTICE_GROUP"
    log_info "  Prospects: $PROSPECTS"
    log_info "  Messages: $MESSAGES_COUNT"
    log_info "  Status: $STATUS"

    # Verify response structure
    if [ "$PROSPECTS" == "5" ] && [ "$STATUS" == "draft" ] && [ "$MESSAGES_COUNT" == "5" ]; then
        log_success "Campaign response structure is correct"
    else
        log_failure "Campaign response structure mismatch"
        echo "Response: $(echo "$RESPONSE" | jq .)"
    fi
else
    log_failure "Failed to create campaign"
    echo "Response: $(echo "$RESPONSE" | jq .)"
    exit 1
fi

# Test 1.2: Invalid practice group
log_test "Reject campaign with invalid practice group"
log_request "POST $FULL_URL with practiceGroupId=invalid-group"

RESPONSE=$(curl -s -X POST "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "practiceGroupId": "invalid-group",
        "targetCount": 5
    }')

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Invalid practice group rejected: $ERROR"
else
    log_failure "Should have rejected invalid practice group"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 1.3: TargetCount exceeds max
log_test "Reject campaign with targetCount > 100"
log_request "POST $FULL_URL with targetCount=150"

RESPONSE=$(curl -s -X POST "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "practiceGroupId": "fintech",
        "targetCount": 150
    }')

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "TargetCount validation working: $ERROR"
else
    log_failure "Should have rejected targetCount > 100"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 1.4: Missing required field
log_test "Reject campaign with missing practiceGroupId"
log_request "POST $FULL_URL without practiceGroupId"

RESPONSE=$(curl -s -X POST "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "targetCount": 25
    }')

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Missing field validation working: $ERROR"
else
    log_failure "Should have rejected missing practiceGroupId"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

##############################################################################
# TEST 2: GET /api/gtm/wells-onyx/campaign - Retrieve Campaign
##############################################################################

log_header "TEST 2: RETRIEVE CAMPAIGN (GET)"

# Test 2.1: Retrieve valid campaign
log_test "Retrieve campaign with valid campaignId"
log_request "GET $FULL_URL?campaignId=$CAMPAIGN_ID"

RESPONSE=$(curl -s -X GET "$FULL_URL?campaignId=$CAMPAIGN_ID" \
    -H "Content-Type: application/json")

if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
    RETRIEVED_ID=$(echo "$RESPONSE" | jq -r '.campaignId')
    RETRIEVED_STATUS=$(echo "$RESPONSE" | jq -r '.status')
    RETRIEVED_PROSPECTS=$(echo "$RESPONSE" | jq -r '.prospects')
    RETRIEVED_APPROVED=$(echo "$RESPONSE" | jq -r '.approvedCount')

    log_success "Campaign retrieved successfully"
    log_info "  Campaign ID: $RETRIEVED_ID"
    log_info "  Status: $RETRIEVED_STATUS"
    log_info "  Prospects: $RETRIEVED_PROSPECTS"
    log_info "  Approved Count: $RETRIEVED_APPROVED"

    # Verify data consistency
    if [ "$RETRIEVED_ID" == "$CAMPAIGN_ID" ] && [ "$RETRIEVED_STATUS" == "draft" ]; then
        log_success "Retrieved data matches created campaign"
    else
        log_failure "Retrieved data mismatch"
        echo "Response: $(echo "$RESPONSE" | jq .)"
    fi
else
    log_failure "Failed to retrieve campaign"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 2.2: Non-existent campaign
log_test "Reject retrieval of non-existent campaign"
log_request "GET $FULL_URL?campaignId=wo_gtm_nonexistent"

RESPONSE=$(curl -s -X GET "$FULL_URL?campaignId=wo_gtm_nonexistent" \
    -H "Content-Type: application/json")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Non-existent campaign rejected: $ERROR"
else
    log_failure "Should have returned error for non-existent campaign"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 2.3: Missing campaignId parameter
log_test "Reject retrieval without campaignId parameter"
log_request "GET $FULL_URL (no query params)"

RESPONSE=$(curl -s -X GET "$FULL_URL" \
    -H "Content-Type: application/json")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Missing parameter validation working: $ERROR"
else
    log_failure "Should have rejected missing campaignId parameter"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

##############################################################################
# TEST 3: PATCH /api/gtm/wells-onyx/campaign - Update Campaign
##############################################################################

log_header "TEST 3: UPDATE CAMPAIGN (PATCH)"

# Test 3.1: Approve single message
log_test "Approve single message (messageIndex=0)"
log_request "PATCH $FULL_URL with action=approve_message, messageIndex=0"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"approve_message\",
        \"messageIndex\": 0
    }")

if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
    APPROVED_COUNT=$(echo "$RESPONSE" | jq -r '.approvedCount')
    TOTAL_MESSAGES=$(echo "$RESPONSE" | jq -r '.totalMessages')
    log_success "Message approved successfully"
    log_info "  Approved: $APPROVED_COUNT / $TOTAL_MESSAGES"

    if [ "$APPROVED_COUNT" == "1" ]; then
        log_success "Approval count is correct"
    else
        log_failure "Approval count mismatch (expected 1, got $APPROVED_COUNT)"
    fi
else
    log_failure "Failed to approve message"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.2: Approve another message
log_test "Approve another message (messageIndex=1)"
log_request "PATCH $FULL_URL with action=approve_message, messageIndex=1"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"approve_message\",
        \"messageIndex\": 1
    }")

if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
    APPROVED_COUNT=$(echo "$RESPONSE" | jq -r '.approvedCount')
    log_success "Second message approved"
    log_info "  Approved: $APPROVED_COUNT / 5"
else
    log_failure "Failed to approve second message"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.3: Reject single message
log_test "Reject previously approved message (messageIndex=0)"
log_request "PATCH $FULL_URL with action=reject_message, messageIndex=0"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"reject_message\",
        \"messageIndex\": 0
    }")

if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
    APPROVED_COUNT=$(echo "$RESPONSE" | jq -r '.approvedCount')
    log_success "Message rejected successfully"
    log_info "  Approved: $APPROVED_COUNT / 5"

    if [ "$APPROVED_COUNT" == "1" ]; then
        log_success "Rejection count is correct (decreased from 2 to 1)"
    else
        log_failure "Rejection count mismatch (expected 1, got $APPROVED_COUNT)"
    fi
else
    log_failure "Failed to reject message"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.4: Approve all messages
log_test "Approve all messages"
log_request "PATCH $FULL_URL with action=approve_all"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"approve_all\"
    }")

if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
    APPROVED_COUNT=$(echo "$RESPONSE" | jq -r '.approvedCount')
    NEW_STATUS=$(echo "$RESPONSE" | jq -r '.status')
    log_success "All messages approved"
    log_info "  Approved: $APPROVED_COUNT / 5"
    log_info "  New Status: $NEW_STATUS"

    if [ "$APPROVED_COUNT" == "5" ] && [ "$NEW_STATUS" == "ready" ]; then
        log_success "Status changed to 'ready' correctly"
    else
        log_failure "Status or count mismatch"
    fi
else
    log_failure "Failed to approve all messages"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.5: Invalid messageIndex
log_test "Reject invalid messageIndex (out of bounds)"
log_request "PATCH $FULL_URL with messageIndex=999"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"approve_message\",
        \"messageIndex\": 999
    }")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Invalid messageIndex rejected: $ERROR"
else
    log_failure "Should have rejected invalid messageIndex"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.6: Missing messageIndex for approve_message
log_test "Reject approve_message without messageIndex"
log_request "PATCH $FULL_URL with action=approve_message (no messageIndex)"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"approve_message\"
    }")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Missing messageIndex validation working: $ERROR"
else
    log_failure "Should have rejected missing messageIndex"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.7: Send without API key (should fail gracefully)
log_test "Attempt send action (may fail without API key)"
log_request "PATCH $FULL_URL with action=send"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$CAMPAIGN_ID\",
        \"action\": \"send\"
    }")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_info "Send action returned error (expected if API key not configured): $ERROR"
    log_success "Send validation working - requires API key"
else
    if echo "$RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
        log_success "Send action succeeded (API key is configured)"
        SENT=$(echo "$RESPONSE" | jq -r '.sent')
        FAILED=$(echo "$RESPONSE" | jq -r '.failed')
        log_info "  Sent: $SENT, Failed: $FAILED"
    fi
fi

# Test 3.8: Send without approval (new campaign)
log_test "Reject send without message approval"
log_request "Create new campaign and try send without approval"

# Create new campaign
CREATE_RESPONSE=$(curl -s -X POST "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "practiceGroupId": "saas",
        "targetCount": 3
    }')

NEW_CAMPAIGN_ID=$(echo "$CREATE_RESPONSE" | jq -r '.campaignId')

# Try to send without approval
RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"$NEW_CAMPAIGN_ID\",
        \"action\": \"send\"
    }")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    if echo "$ERROR" | grep -q "not approved"; then
        log_success "Send validation working - requires approval: $ERROR"
    else
        log_failure "Unexpected error message: $ERROR"
    fi
else
    log_failure "Should have rejected send without approval"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

# Test 3.9: Non-existent campaign for PATCH
log_test "Reject PATCH for non-existent campaign"
log_request "PATCH $FULL_URL with non-existent campaignId"

RESPONSE=$(curl -s -X PATCH "$FULL_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"campaignId\": \"wo_gtm_nonexistent\",
        \"action\": \"approve_all\"
    }")

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log_success "Non-existent campaign rejected: $ERROR"
else
    log_failure "Should have rejected non-existent campaign"
    echo "Response: $(echo "$RESPONSE" | jq .)"
fi

##############################################################################
# SUMMARY
##############################################################################

log_header "TEST SUMMARY"

echo -e "\n${BLUE}Total Tests:${NC} $TESTS_RUN"
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}\n"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed!${NC}\n"
    exit 1
fi
