#!/usr/bin/env node

/**
 * API Testing Script for Wells AI
 *
 * Tests core API endpoints to ensure they're working correctly
 */

const http = require('http');
const https = require('https');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warning: (msg) => console.warn(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const tests = [
  {
    name: 'Health Check (Homepage)',
    method: 'GET',
    path: '/',
    expectedStatus: 200,
  },
  {
    name: 'Chat API (Basic)',
    method: 'POST',
    path: '/api/chat',
    body: { message: 'Hello' },
    expectedStatus: 200,
  },
  {
    name: 'Chat API (Semiconductor)',
    method: 'POST',
    path: '/api/chat',
    body: { message: 'I need to procure 10,000 5nm chips' },
    expectedStatus: 200,
  },
  {
    name: 'Chat API (Executive Search)',
    method: 'POST',
    path: '/api/chat',
    body: { message: 'I need to hire a CTO' },
    expectedStatus: 200,
  },
];

/**
 * Make HTTP request
 */
function makeRequest(test) {
  return new Promise((resolve, reject) => {
    const url = new URL(test.path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method: test.method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (test.body) {
      const body = JSON.stringify(test.body);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (test.body) {
      req.write(JSON.stringify(test.body));
    }

    req.end();
  });
}

/**
 * Run a single test
 */
async function runTest(test) {
  log.info(`Testing: ${test.name}`);

  try {
    const response = await makeRequest(test);

    if (response.statusCode === test.expectedStatus) {
      log.success(`${test.name} - Status: ${response.statusCode}`);
      return true;
    } else {
      log.error(`${test.name} - Expected ${test.expectedStatus}, got ${response.statusCode}`);
      if (response.body) {
        console.log('Response:', response.body.substring(0, 200));
      }
      return false;
    }
  } catch (error) {
    log.error(`${test.name} - ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              Wells AI - API Tester                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  log.info(`Testing API at: ${BASE_URL}`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await runTest(test);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  log.header('\nTest Summary:');
  log.success(`Passed: ${passed}`);
  if (failed > 0) {
    log.error(`Failed: ${failed}`);
  }

  console.log('');

  if (failed > 0) {
    log.error('Some tests failed!');
    log.info('\nTroubleshooting:');
    log.info('1. Ensure the development server is running (npm run dev)');
    log.info('2. Check that environment variables are set correctly');
    log.info('3. Review the error messages above');
    process.exit(1);
  } else {
    log.success('All tests passed!');
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    log.error(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runAllTests };
