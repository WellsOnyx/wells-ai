#!/usr/bin/env node

/**
 * Environment Validation Script for Wells AI
 *
 * Validates that all required environment variables are set
 * and have valid formats before running the application.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
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

// Environment variable definitions
const ENV_VARS = {
  required: {
    ANTHROPIC_API_KEY: {
      description: 'Anthropic Claude API key for AI conversations',
      pattern: /^sk-ant-api03-[A-Za-z0-9_-]+$/,
      example: 'sk-ant-api03-...',
    },
  },
  optional: {
    NOTION_API_KEY: {
      description: 'Notion API key for database integration',
      pattern: /^secret_[A-Za-z0-9]+$/,
      example: 'secret_...',
    },
    NOTION_RFQ_DATABASE_ID: {
      description: 'Notion database ID for RFQs',
      pattern: /^[a-f0-9]{32}$/,
      example: '32-character hex string',
    },
    NOTION_SUPPLIER_DATABASE_ID: {
      description: 'Notion database ID for suppliers',
      pattern: /^[a-f0-9]{32}$/,
      example: '32-character hex string',
    },
    TWILIO_ACCOUNT_SID: {
      description: 'Twilio account SID for SMS',
      pattern: /^AC[a-f0-9]{32}$/,
      example: 'AC...',
    },
    TWILIO_AUTH_TOKEN: {
      description: 'Twilio auth token',
      pattern: /^[a-f0-9]{32}$/,
      example: '32-character hex string',
    },
    TWILIO_PHONE_NUMBER: {
      description: 'Twilio phone number',
      pattern: /^\+1\d{10}$/,
      example: '+15551234567',
    },
    POSTGRES_URL: {
      description: 'PostgreSQL connection URL',
      pattern: /^postgres:\/\/.+$/,
      example: 'postgres://user:pass@host/db',
    },
    REDIS_URL: {
      description: 'Redis connection URL',
      pattern: /^redis:\/\/.+$/,
      example: 'redis://host:port',
    },
    STRIPE_SECRET_KEY: {
      description: 'Stripe secret key for payments',
      pattern: /^sk_(test|live)_[A-Za-z0-9]+$/,
      example: 'sk_test_...',
    },
    SENTRY_DSN: {
      description: 'Sentry DSN for error tracking',
      pattern: /^https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/\d+$/,
      example: 'https://...@....ingest.sentry.io/...',
    },
    SLACK_WEBHOOK_URL: {
      description: 'Slack webhook URL for notifications',
      pattern: /^https:\/\/hooks\.slack\.com\/services\/.+$/,
      example: 'https://hooks.slack.com/services/...',
    },
  },
};

/**
 * Load environment variables from .env.local if it exists
 */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    log.warning('.env.local file not found');
    return false;
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    return true;
  } catch (error) {
    log.error(`Failed to load .env.local: ${error.message}`);
    return false;
  }
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(name, config, isRequired = false) {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    if (isRequired) {
      log.error(`${name} is required but not set`);
      log.info(`  Description: ${config.description}`);
      log.info(`  Example: ${config.example}`);
      return false;
    } else {
      log.warning(`${name} is not set (optional)`);
      return true;
    }
  }

  if (config.pattern && !config.pattern.test(value)) {
    log.error(`${name} has invalid format`);
    log.info(`  Description: ${config.description}`);
    log.info(`  Expected: ${config.example}`);
    return false;
  }

  log.success(`${name} is valid`);
  return true;
}

/**
 * Validate all environment variables
 */
function validateAllEnvVars() {
  log.header('Validating Environment Variables');

  let hasErrors = false;
  let warningCount = 0;

  // Validate required variables
  log.header('\nRequired Variables:');
  for (const [name, config] of Object.entries(ENV_VARS.required)) {
    if (!validateEnvVar(name, config, true)) {
      hasErrors = true;
    }
  }

  // Validate optional variables
  log.header('\nOptional Variables:');
  for (const [name, config] of Object.entries(ENV_VARS.optional)) {
    const result = validateEnvVar(name, config, false);
    if (!result || !process.env[name]) {
      warningCount++;
    }
  }

  // Summary
  log.header('\nValidation Summary:');

  if (hasErrors) {
    log.error('Environment validation failed!');
    log.info('\nTo fix:');
    log.info('1. Copy .env.local.example to .env.local');
    log.info('2. Fill in all required environment variables');
    log.info('3. Run this script again: npm run validate:env');
    process.exit(1);
  } else {
    log.success('All required environment variables are valid!');
    if (warningCount > 0) {
      log.warning(`${warningCount} optional variable(s) not set`);
      log.info('Some features may not be available');
    }
  }
}

/**
 * Check if .env.local.example exists and is up to date
 */
function checkEnvExample() {
  const examplePath = path.join(process.cwd(), '.env.local.example');

  if (!fs.existsSync(examplePath)) {
    log.warning('.env.local.example file not found');
    log.info('Creating .env.local.example with required variables...');

    let content = '# Wells AI Environment Variables\n\n';
    content += '# Required Variables\n';
    for (const [name, config] of Object.entries(ENV_VARS.required)) {
      content += `# ${config.description}\n`;
      content += `# Example: ${config.example}\n`;
      content += `${name}=\n\n`;
    }

    content += '# Optional Variables\n';
    for (const [name, config] of Object.entries(ENV_VARS.optional)) {
      content += `# ${config.description}\n`;
      content += `# Example: ${config.example}\n`;
      content += `# ${name}=\n\n`;
    }

    try {
      fs.writeFileSync(examplePath, content);
      log.success('Created .env.local.example');
    } catch (error) {
      log.error(`Failed to create .env.local.example: ${error.message}`);
    }
  }
}

/**
 * Main execution
 */
function main() {
  // Skip validation in CI/production builds (Vercel, GitHub Actions, etc.)
  if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
    console.log(`${colors.yellow}⚠ Skipping env validation (CI/production build)${colors.reset}`);
    return;
  }

  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           Wells AI - Environment Validator                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  checkEnvExample();
  loadEnvFile();
  validateAllEnvVars();

  console.log('');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateAllEnvVars, ENV_VARS };
