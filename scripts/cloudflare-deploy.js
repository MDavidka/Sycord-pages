#!/usr/bin/env node

/**
 * Standalone Cloudflare Pages Deployment Script
 * 
 * This script deploys static websites to Cloudflare Pages using the REST API.
 * No Wrangler CLI required!
 * 
 * Requirements:
 * - Node.js 14+
 * - Valid Cloudflare API token with Pages:Edit permissions
 * - Cloudflare Account ID
 * 
 * Usage:
 *   node cloudflare-deploy.js --account=abc123 --token=xxx --project=my-site --dir=./out
 * 
 * Environment Variables (alternative to CLI args):
 *   CLOUDFLARE_ACCOUNT_ID - Your Cloudflare Account ID
 *   CLOUDFLARE_API_TOKEN - Your Cloudflare API token
 *   CLOUDFLARE_PROJECT_NAME - Your Pages project name
 *   DEPLOY_DIR - Directory containing files to deploy (default: ./out)
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Configuration
const config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || getArg('--account'),
  apiToken: process.env.CLOUDFLARE_API_TOKEN || getArg('--token'),
  projectName: process.env.CLOUDFLARE_PROJECT_NAME || getArg('--project'),
  deployDir: process.env.DEPLOY_DIR || getArg('--dir') || './out',
  branch: process.env.DEPLOY_BRANCH || getArg('--branch') || 'main',
};

// Helper to get CLI arguments
function getArg(name) {
  const arg = process.argv.find(a => a.startsWith(name + '='));
  return arg ? arg.split('=')[1] : null;
}

// Helper to make HTTPS requests
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        ...(options.headers || {}),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Check if project exists
async function checkProject() {
  console.log(`🔍 Checking if Cloudflare Pages project exists: ${config.projectName}`);
  try {
    await httpsRequest(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}`
    );
    console.log('✅ Project exists');
    return true;
  } catch (error) {
    console.log('ℹ️  Project does not exist, will create it');
    return false;
  }
}

// Create project
async function createProject() {
  console.log(`📝 Creating Cloudflare Pages project: ${config.projectName}`);
  
  try {
    await httpsRequest(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          name: config.projectName,
          production_branch: config.branch,
        },
      }
    );
    console.log('✅ Project created');
    return true;
  } catch (error) {
    console.error('❌ Failed to create project:', error.message);
    return false;
  }
}

// Read all files from directory recursively
async function readDirectory(dir, baseDir = dir) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      files.push(...await readDirectory(fullPath, baseDir));
    } else if (item.isFile()) {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
        
        // Validate file size (25MB limit per file for Cloudflare)
        const sizeInMB = Buffer.byteLength(content, 'utf-8') / 1024 / 1024;
        if (sizeInMB > 25) {
          console.warn(`⚠️  Warning: ${relativePath} is ${sizeInMB.toFixed(2)}MB (limit: 25MB), skipping...`);
          continue;
        }
        
        files.push({ path: relativePath, content });
      } catch (error) {
        console.warn(`⚠️  Warning: Failed to read ${fullPath}: ${error.message}`);
      }
    }
  }

  return files;
}

// Deploy to Cloudflare Pages
async function deployToCloudflare(files) {
  console.log(`🚀 Starting deployment to Cloudflare Pages...`);

  // Create deployment
  console.log('📝 Creating deployment...');
  
  const deployResponse = await httpsRequest(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}/deployments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        branch: config.branch,
      },
    }
  );

  const uploadUrl = deployResponse.data.result?.upload_url;
  const deploymentId = deployResponse.data.result?.id;

  if (!uploadUrl) {
    throw new Error('No upload URL received from Cloudflare');
  }

  console.log('✅ Deployment created, uploading files...');

  // Create file manifest
  const manifest = {};
  for (const file of files) {
    manifest[file.path] = Buffer.from(file.content, 'utf-8').toString('base64');
    console.log(`   - ${file.path} (${(file.content.length / 1024).toFixed(2)} KB)`);
  }

  // Upload manifest
  await httpsRequest(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { manifest },
  });

  console.log('✅ Files uploaded successfully');

  return {
    url: `https://${config.projectName}.pages.dev`,
    deploymentId,
  };
}

// Main deployment function
async function deploy() {
  console.log('\n☁️  Cloudflare Pages Deployment Tool\n');

  // Validate configuration
  if (!config.accountId) {
    console.error('❌ Error: Cloudflare Account ID is required');
    console.error('Provide via --account=xxx or CLOUDFLARE_ACCOUNT_ID env var');
    console.error('\nFind your Account ID at: https://dash.cloudflare.com/');
    process.exit(1);
  }

  if (!config.apiToken) {
    console.error('❌ Error: Cloudflare API token is required');
    console.error('Provide via --token=xxx or CLOUDFLARE_API_TOKEN env var');
    console.error('\nCreate a token at: https://dash.cloudflare.com/profile/api-tokens');
    console.error('Required permission: Account → Cloudflare Pages → Edit');
    process.exit(1);
  }

  if (!config.projectName) {
    console.error('❌ Error: Project name is required');
    console.error('Provide via --project=my-site or CLOUDFLARE_PROJECT_NAME env var');
    process.exit(1);
  }

  try {
    // Step 1: Check/create project
    const projectExists = await checkProject();
    if (!projectExists) {
      const created = await createProject();
      if (!created) {
        process.exit(1);
      }
    }

    // Step 2: Read files
    console.log(`\n📂 Reading files from: ${config.deployDir}`);
    const files = await readDirectory(config.deployDir);
    console.log(`✅ Found ${files.length} file(s)`);

    if (files.length === 0) {
      console.error('❌ Error: No files found to deploy');
      process.exit(1);
    }

    // Step 3: Deploy
    const { url, deploymentId } = await deployToCloudflare(files);

    // Success!
    console.log('\n🎉 Deployment successful!');
    console.log(`\n🌐 Your site is live at: ${url}`);
    console.log(`📋 Deployment ID: ${deploymentId}\n`);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deploy();
}

module.exports = { deploy };
