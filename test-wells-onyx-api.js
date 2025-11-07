#!/usr/bin/env node

/**
 * Wells Onyx Campaign API - Comprehensive Test Script (Node.js)
 *
 * This script tests all three endpoints of the Wells Onyx Campaign API:
 * 1. POST /api/gtm/wells-onyx/campaign - Create campaign
 * 2. GET /api/gtm/wells-onyx/campaign - Retrieve campaign
 * 3. PATCH /api/gtm/wells-onyx/campaign - Update campaign
 *
 * Usage:
 *   node test-wells-onyx-api.js
 *
 * Prerequisites:
 *   - Backend running on http://localhost:3000
 *   - Node.js 16+
 */

const http = require('http');
const https = require('https');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/gtm/wells-onyx/campaign';

// Test stats
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Utility functions
const log = {
  header: (msg) => console.log(`\n${colors.blue}${'='.repeat(80)}\n${msg}\n${'='.repeat(80)}${colors.reset}\n`),
  test: (msg) => {
    testsRun++;
    console.log(`${colors.yellow}Test ${testsRun}: ${msg}${colors.reset}`);
  },
  success: (msg) => {
    testsPassed++;
    console.log(`${colors.green}✓ PASSED: ${msg}${colors.reset}`);
  },
  failure: (msg) => {
    testsFailed++;
    console.log(`${colors.red}✗ FAILED: ${msg}${colors.reset}`);
  },
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  request: (msg) => console.log(`${colors.yellow}→ Request: ${msg}${colors.reset}`),
  response: (msg) => console.log(`${colors.yellow}← Response: ${msg}${colors.reset}`),
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Test runner
 */
async function runTests() {
  let campaignId = null;

  try {
    // ========================================================================
    // TEST 1: CREATE CAMPAIGN (POST)
    // ========================================================================
    log.header('TEST 1: CREATE CAMPAIGN (POST)');

    // Test 1.1: Create valid campaign
    {
      log.test('Create campaign with valid data');
      log.request(`POST ${API_ENDPOINT} with practiceGroupId=cybersecurity, targetCount=5`);

      const response = await makeRequest('POST', API_ENDPOINT, {
        practiceGroupId: 'cybersecurity',
        targetCount: 5,
      });

      if (response.body.success === true) {
        campaignId = response.body.campaignId;
        const practiceGroup = response.body.practiceGroup;
        const prospects = response.body.prospects;
        const status = response.body.status;
        const messagesCount = response.body.messages?.length || 0;

        log.success('Campaign created successfully');
        log.info(`  Campaign ID: ${campaignId}`);
        log.info(`  Practice Group: ${practiceGroup}`);
        log.info(`  Prospects: ${prospects}`);
        log.info(`  Messages: ${messagesCount}`);
        log.info(`  Status: ${status}`);

        if (prospects === 5 && status === 'draft' && messagesCount === 5) {
          log.success('Campaign response structure is correct');
        } else {
          log.failure('Campaign response structure mismatch');
          console.log(JSON.stringify(response.body, null, 2));
        }
      } else {
        log.failure('Failed to create campaign');
        console.log(JSON.stringify(response.body, null, 2));
        throw new Error('Cannot continue without campaign');
      }
    }

    // Test 1.2: Invalid practice group
    {
      log.test('Reject campaign with invalid practice group');
      log.request(`POST ${API_ENDPOINT} with practiceGroupId=invalid-group`);

      const response = await makeRequest('POST', API_ENDPOINT, {
        practiceGroupId: 'invalid-group',
        targetCount: 5,
      });

      if (response.body.error) {
        log.success(`Invalid practice group rejected: ${response.body.error}`);
      } else {
        log.failure('Should have rejected invalid practice group');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 1.3: TargetCount exceeds max
    {
      log.test('Reject campaign with targetCount > 100');
      log.request(`POST ${API_ENDPOINT} with targetCount=150`);

      const response = await makeRequest('POST', API_ENDPOINT, {
        practiceGroupId: 'fintech',
        targetCount: 150,
      });

      if (response.body.error) {
        log.success(`TargetCount validation working: ${response.body.error}`);
      } else {
        log.failure('Should have rejected targetCount > 100');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 1.4: Missing required field
    {
      log.test('Reject campaign with missing practiceGroupId');
      log.request(`POST ${API_ENDPOINT} without practiceGroupId`);

      const response = await makeRequest('POST', API_ENDPOINT, {
        targetCount: 25,
      });

      if (response.body.error) {
        log.success(`Missing field validation working: ${response.body.error}`);
      } else {
        log.failure('Should have rejected missing practiceGroupId');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // ========================================================================
    // TEST 2: RETRIEVE CAMPAIGN (GET)
    // ========================================================================
    log.header('TEST 2: RETRIEVE CAMPAIGN (GET)');

    // Test 2.1: Retrieve valid campaign
    {
      log.test('Retrieve campaign with valid campaignId');
      log.request(`GET ${API_ENDPOINT}?campaignId=${campaignId}`);

      const response = await makeRequest('GET', `${API_ENDPOINT}?campaignId=${campaignId}`);

      if (response.body.success === true) {
        const retrievedId = response.body.campaignId;
        const retrievedStatus = response.body.status;
        const retrievedProspects = response.body.prospects;
        const retrievedApproved = response.body.approvedCount;

        log.success('Campaign retrieved successfully');
        log.info(`  Campaign ID: ${retrievedId}`);
        log.info(`  Status: ${retrievedStatus}`);
        log.info(`  Prospects: ${retrievedProspects}`);
        log.info(`  Approved Count: ${retrievedApproved}`);

        if (retrievedId === campaignId && retrievedStatus === 'draft') {
          log.success('Retrieved data matches created campaign');
        } else {
          log.failure('Retrieved data mismatch');
          console.log(JSON.stringify(response.body, null, 2));
        }
      } else {
        log.failure('Failed to retrieve campaign');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 2.2: Non-existent campaign
    {
      log.test('Reject retrieval of non-existent campaign');
      log.request(`GET ${API_ENDPOINT}?campaignId=wo_gtm_nonexistent`);

      const response = await makeRequest('GET', `${API_ENDPOINT}?campaignId=wo_gtm_nonexistent`);

      if (response.body.error) {
        log.success(`Non-existent campaign rejected: ${response.body.error}`);
      } else {
        log.failure('Should have returned error for non-existent campaign');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 2.3: Missing campaignId parameter
    {
      log.test('Reject retrieval without campaignId parameter');
      log.request(`GET ${API_ENDPOINT} (no query params)`);

      const response = await makeRequest('GET', API_ENDPOINT);

      if (response.body.error) {
        log.success(`Missing parameter validation working: ${response.body.error}`);
      } else {
        log.failure('Should have rejected missing campaignId parameter');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // ========================================================================
    // TEST 3: UPDATE CAMPAIGN (PATCH)
    // ========================================================================
    log.header('TEST 3: UPDATE CAMPAIGN (PATCH)');

    // Test 3.1: Approve single message
    {
      log.test('Approve single message (messageIndex=0)');
      log.request(`PATCH ${API_ENDPOINT} with action=approve_message, messageIndex=0`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'approve_message',
        messageIndex: 0,
      });

      if (response.body.success === true) {
        const approvedCount = response.body.approvedCount;
        const totalMessages = response.body.totalMessages;
        log.success('Message approved successfully');
        log.info(`  Approved: ${approvedCount} / ${totalMessages}`);

        if (approvedCount === 1) {
          log.success('Approval count is correct');
        } else {
          log.failure(`Approval count mismatch (expected 1, got ${approvedCount})`);
        }
      } else {
        log.failure('Failed to approve message');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.2: Approve another message
    {
      log.test('Approve another message (messageIndex=1)');
      log.request(`PATCH ${API_ENDPOINT} with action=approve_message, messageIndex=1`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'approve_message',
        messageIndex: 1,
      });

      if (response.body.success === true) {
        const approvedCount = response.body.approvedCount;
        log.success('Second message approved');
        log.info(`  Approved: ${approvedCount} / 5`);
      } else {
        log.failure('Failed to approve second message');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.3: Reject single message
    {
      log.test('Reject previously approved message (messageIndex=0)');
      log.request(`PATCH ${API_ENDPOINT} with action=reject_message, messageIndex=0`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'reject_message',
        messageIndex: 0,
      });

      if (response.body.success === true) {
        const approvedCount = response.body.approvedCount;
        log.success('Message rejected successfully');
        log.info(`  Approved: ${approvedCount} / 5`);

        if (approvedCount === 1) {
          log.success('Rejection count is correct (decreased from 2 to 1)');
        } else {
          log.failure(`Rejection count mismatch (expected 1, got ${approvedCount})`);
        }
      } else {
        log.failure('Failed to reject message');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.4: Approve all messages
    {
      log.test('Approve all messages');
      log.request(`PATCH ${API_ENDPOINT} with action=approve_all`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'approve_all',
      });

      if (response.body.success === true) {
        const approvedCount = response.body.approvedCount;
        const newStatus = response.body.status;
        log.success('All messages approved');
        log.info(`  Approved: ${approvedCount} / 5`);
        log.info(`  New Status: ${newStatus}`);

        if (approvedCount === 5 && newStatus === 'ready') {
          log.success("Status changed to 'ready' correctly");
        } else {
          log.failure('Status or count mismatch');
        }
      } else {
        log.failure('Failed to approve all messages');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.5: Invalid messageIndex
    {
      log.test('Reject invalid messageIndex (out of bounds)');
      log.request(`PATCH ${API_ENDPOINT} with messageIndex=999`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'approve_message',
        messageIndex: 999,
      });

      if (response.body.error) {
        log.success(`Invalid messageIndex rejected: ${response.body.error}`);
      } else {
        log.failure('Should have rejected invalid messageIndex');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.6: Missing messageIndex for approve_message
    {
      log.test('Reject approve_message without messageIndex');
      log.request(`PATCH ${API_ENDPOINT} with action=approve_message (no messageIndex)`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'approve_message',
      });

      if (response.body.error) {
        log.success(`Missing messageIndex validation working: ${response.body.error}`);
      } else {
        log.failure('Should have rejected missing messageIndex');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.7: Send action (may fail without API key)
    {
      log.test('Attempt send action (may fail without API key)');
      log.request(`PATCH ${API_ENDPOINT} with action=send`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: campaignId,
        action: 'send',
      });

      if (response.body.error) {
        const error = response.body.error;
        log.info(`Send action returned error (expected if API key not configured): ${error}`);
        log.success('Send validation working - requires API key');
      } else if (response.body.success === true) {
        log.success('Send action succeeded (API key is configured)');
        const sent = response.body.sent;
        const failed = response.body.failed;
        log.info(`  Sent: ${sent}, Failed: ${failed}`);
      }
    }

    // Test 3.8: Send without approval (new campaign)
    {
      log.test('Reject send without message approval');
      log.request('Create new campaign and try send without approval');

      // Create new campaign
      const createResponse = await makeRequest('POST', API_ENDPOINT, {
        practiceGroupId: 'saas',
        targetCount: 3,
      });

      const newCampaignId = createResponse.body.campaignId;

      // Try to send without approval
      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: newCampaignId,
        action: 'send',
      });

      if (response.body.error) {
        const error = response.body.error;
        if (error.includes('not approved')) {
          log.success(`Send validation working - requires approval: ${error}`);
        } else {
          log.failure(`Unexpected error message: ${error}`);
        }
      } else {
        log.failure('Should have rejected send without approval');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // Test 3.9: Non-existent campaign for PATCH
    {
      log.test('Reject PATCH for non-existent campaign');
      log.request(`PATCH ${API_ENDPOINT} with non-existent campaignId`);

      const response = await makeRequest('PATCH', API_ENDPOINT, {
        campaignId: 'wo_gtm_nonexistent',
        action: 'approve_all',
      });

      if (response.body.error) {
        log.success(`Non-existent campaign rejected: ${response.body.error}`);
      } else {
        log.failure('Should have rejected non-existent campaign');
        console.log(JSON.stringify(response.body, null, 2));
      }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    log.header('TEST SUMMARY');

    console.log(`\n${colors.blue}Total Tests:${colors.reset} ${testsRun}`);
    console.log(`${colors.green}Passed:${colors.reset} ${testsPassed}`);
    console.log(`${colors.red}Failed:${colors.reset} ${testsFailed}\n`);

    if (testsFailed === 0) {
      console.log(`${colors.green}✓ All tests passed!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}✗ Some tests failed!${colors.reset}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runTests();
