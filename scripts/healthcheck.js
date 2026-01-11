#!/usr/bin/env node
/**
 * Comprehensive Health Check Script
 * Checks local configuration, API endpoints, and production secrets
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkLocalSecrets() {
  log('\n🔐 Checking Local Secrets (.dev.vars)...', 'blue');

  if (!existsSync('.dev.vars')) {
    log('❌ .dev.vars not found!', 'red');
    log('   Run: cp .env.example .dev.vars', 'yellow');
    return false;
  }

  const devVars = readFileSync('.dev.vars', 'utf-8');
  const requiredSecrets = [
    'BETTER_AUTH_SECRET',
    'SOLIDGATE_SECRET_KEY',
    'SOLIDGATE_WEBHOOK_SECRET',
    'CLOUDFLARE_STREAM_CUSTOMER_CODE',
    'CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID',
  ];

  let allConfigured = true;
  for (const secret of requiredSecrets) {
    const regex = new RegExp(`^${secret}=(?!your_)(.+)`, 'm');
    if (regex.test(devVars)) {
      log(`✅ ${secret}`, 'green');
    } else {
      log(`❌ ${secret} (missing or placeholder)`, 'red');
      allConfigured = false;
    }
  }

  return allConfigured;
}

async function checkApiHealth(baseUrl = 'http://localhost:5173') {
  log(`\n🌐 Checking API Endpoints (${baseUrl})...`, 'blue');

  const endpoints = [
    { path: '/api/health', expected: '"status":"ok"', name: 'Health' },
    { path: '/api/plans', expected: '"success":true', name: 'Plans' },
    {
      path: '/api/series/a49ab52f-71ab-477f-b886-bc762fb72e64',
      expected: '"title"',
      name: 'Series Core',
    },
    {
      path: '/api/series/a49ab52f-71ab-477f-b886-bc762fb72e64/access',
      expected: '"user"',
      name: 'Series Access',
    },
    {
      path: '/api/series/a49ab52f-71ab-477f-b886-bc762fb72e64/stats',
      expected: '"totalViews"',
      name: 'Series Stats',
    },
  ];

  let allHealthy = true;
  for (const { path, expected, name } of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      const text = await response.text();

      if (text.includes(expected)) {
        log(`✅ ${name} (${path})`, 'green');

        // Check cache header if available
        const cacheStatus = response.headers.get('cache-status');
        if (cacheStatus) {
          log(`   Cache: ${cacheStatus}`, 'cyan');
        }
      } else {
        log(`❌ ${name} (unexpected response)`, 'red');
        log(`   Path: ${path}`, 'yellow');
        allHealthy = false;
      }
    } catch (error) {
      log(`❌ ${name} (${error.message})`, 'red');
      log(`   Path: ${path}`, 'yellow');
      allHealthy = false;
    }
  }

  return allHealthy;
}

function checkProductionSecrets() {
  log('\n☁️  Checking Production Secrets...', 'blue');

  try {
    const output = execSync('wrangler secret list', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    const requiredSecrets = [
      'BETTER_AUTH_SECRET',
      'SOLIDGATE_SECRET_KEY',
      'SOLIDGATE_WEBHOOK_SECRET',
    ];

    let allSet = true;
    for (const secret of requiredSecrets) {
      if (output.includes(secret)) {
        log(`✅ ${secret}`, 'green');
      } else {
        log(`❌ ${secret} (not set)`, 'red');
        log(`   Run: wrangler secret put ${secret}`, 'yellow');
        allSet = false;
      }
    }

    return allSet;
  } catch (error) {
    if (error.message.includes('not logged in') || error.message.includes('login')) {
      log('⚠️  Not logged in to Cloudflare', 'yellow');
      log('   Run: wrangler login', 'yellow');
    } else {
      log('⚠️  Could not check production secrets', 'yellow');
      log(`   Error: ${error.message}`, 'yellow');
    }
    return null;
  }
}

function checkGitIgnore() {
  log('\n🔒 Checking .gitignore configuration...', 'blue');

  if (!existsSync('.gitignore')) {
    log('⚠️  .gitignore not found', 'yellow');
    return false;
  }

  const gitignore = readFileSync('.gitignore', 'utf-8');
  const requiredEntries = ['.dev.vars', '.env'];

  let allConfigured = true;
  for (const entry of requiredEntries) {
    if (gitignore.includes(entry)) {
      log(`✅ ${entry} is in .gitignore`, 'green');
    } else {
      log(`❌ ${entry} NOT in .gitignore (security risk!)`, 'red');
      allConfigured = false;
    }
  }

  return allConfigured;
}

async function main() {
  log('╔════════════════════════════════════════╗', 'cyan');
  log('║   🏥 Webtoon Health Check Suite       ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');

  const results = {
    local: checkLocalSecrets(),
    gitignore: checkGitIgnore(),
    api: await checkApiHealth(),
    production: checkProductionSecrets(),
  };

  log('\n' + '='.repeat(50), 'cyan');
  log('SUMMARY', 'cyan');
  log('='.repeat(50), 'cyan');

  if (results.local) {
    log('✅ Local secrets configured', 'green');
  } else {
    log('❌ Local secrets need attention', 'red');
  }

  if (results.gitignore) {
    log('✅ .gitignore properly configured', 'green');
  } else {
    log('⚠️  .gitignore needs updating', 'yellow');
  }

  if (results.api) {
    log('✅ API endpoints healthy', 'green');
  } else {
    log('❌ API endpoints have issues', 'red');
  }

  if (results.production === true) {
    log('✅ Production secrets configured', 'green');
  } else if (results.production === false) {
    log('❌ Production secrets need attention', 'red');
  } else {
    log('⚠️  Production secrets not checked', 'yellow');
  }

  log('='.repeat(50) + '\n', 'cyan');

  const criticalIssues = !results.local || !results.api;
  const warnings = !results.gitignore || results.production === false;

  if (criticalIssues) {
    log('❌ CRITICAL ISSUES FOUND', 'red');
    log('Fix the issues above before deploying.', 'yellow');
    process.exit(1);
  } else if (warnings) {
    log('⚠️  WARNINGS FOUND', 'yellow');
    log('Review the issues above.', 'yellow');
    process.exit(0);
  } else {
    log('🎉 All health checks passed!', 'green');
    process.exit(0);
  }
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
