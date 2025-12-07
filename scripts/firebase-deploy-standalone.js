#!/usr/bin/env node

/**
 * Standalone Firebase Hosting Deployment Script
 * 
 * This script deploys static websites to Firebase Hosting using only the REST API.
 * No Firebase CLI required!
 * 
 * Requirements:
 * - Node.js 14+
 * - Valid Google OAuth access token with Firebase permissions
 * 
 * Usage:
 *   node firebase-deploy-standalone.js --project=my-project --token=ya29.xxx --dir=./public
 * 
 * Environment Variables (alternative to CLI args):
 *   FIREBASE_PROJECT_ID - Your Firebase project ID
 *   FIREBASE_ACCESS_TOKEN - Your Google OAuth access token
 *   DEPLOY_DIR - Directory containing files to deploy (default: ./public)
 *   DEPLOY_CHANNEL - Deployment channel (default: live, can be preview or custom)
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Configuration
const config = {
  projectId: process.env.FIREBASE_PROJECT_ID || getArg('--project'),
  accessToken: process.env.FIREBASE_ACCESS_TOKEN || getArg('--token'),
  deployDir: process.env.DEPLOY_DIR || getArg('--dir') || './public',
  channel: process.env.DEPLOY_CHANNEL || getArg('--channel') || 'live',
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
        'Authorization': `Bearer ${config.accessToken}`,
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

// Check if Firebase project exists
async function checkFirebaseProject() {
  console.log(`🔍 Checking if Firebase project exists: ${config.projectId}`);
  try {
    await httpsRequest(`https://firebase.googleapis.com/v1beta1/projects/${config.projectId}`);
    console.log('✅ Project exists');
    return true;
  } catch (error) {
    console.error('❌ Project does not exist or you don\'t have access');
    console.error('\nPlease ensure:');
    console.error(`1. Firebase project "${config.projectId}" exists`);
    console.error('2. You have the necessary permissions');
    console.error('3. Your access token is valid');
    console.error('\nCreate project at: https://console.firebase.google.com/');
    return false;
  }
}

// Check if Hosting is initialized
async function checkHostingInitialized() {
  const siteId = config.projectId;
  console.log(`🔍 Checking if Hosting is initialized for site: ${siteId}`);
  
  try {
    await httpsRequest(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${config.projectId}/sites/${siteId}`
    );
    console.log('✅ Hosting is initialized');
    return true;
  } catch (error) {
    console.error('❌ Hosting is not initialized');
    console.error('\nPlease initialize Hosting:');
    console.error(`1. Go to https://console.firebase.google.com/project/${config.projectId}/hosting`);
    console.error('2. Click "Get started" to initialize Hosting');
    console.error('3. Return here and run the script again');
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
      // Recursively read subdirectories
      files.push(...await readDirectory(fullPath, baseDir));
    } else if (item.isFile()) {
      try {
        // Read file with error handling
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
        
        // Validate file size (10MB limit per file)
        const sizeInMB = Buffer.byteLength(content, 'utf-8') / 1024 / 1024;
        if (sizeInMB > 10) {
          console.warn(`⚠️  Warning: ${relativePath} is ${sizeInMB.toFixed(2)}MB (limit: 10MB), skipping...`);
          continue;
        }
        
        files.push({ path: relativePath, content });
      } catch (error) {
        console.warn(`⚠️  Warning: Failed to read ${fullPath}: ${error.message}`);
        // Continue with other files
      }
    }
  }

  return files;
}

// Create a new Hosting version
async function createHostingVersion() {
  const siteId = config.projectId;
  console.log('📝 Creating new hosting version...');

  const response = await httpsRequest(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${config.projectId}/sites/${siteId}/versions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        config: {
          headers: [{
            glob: '**',
            headers: {
              'Cache-Control': 'public, max-age=3600',
            },
          }],
        },
      },
    }
  );

  console.log(`✅ Version created: ${response.data.name}`);
  return response.data.name;
}

// Upload files to the version
async function uploadFiles(versionName, files) {
  console.log(`📤 Uploading ${files.length} file(s)...`);

  // Convert files to base64
  const fileList = {};
  for (const file of files) {
    fileList[file.path] = Buffer.from(file.content, 'utf-8').toString('base64');
    console.log(`   - ${file.path} (${(file.content.length / 1024).toFixed(2)} KB)`);
  }

  await httpsRequest(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { files: fileList },
    }
  );

  console.log('✅ Files uploaded successfully');
}

// Finalize the version
async function finalizeVersion(versionName) {
  console.log('🔨 Finalizing version...');

  await httpsRequest(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: { status: 'FINALIZED' },
    }
  );

  console.log('✅ Version finalized');
}

// Create a release
async function createRelease(versionName) {
  const siteId = config.projectId;
  console.log(`🚀 Creating release on channel: ${config.channel}...`);

  const releaseUrl = config.channel === 'live'
    ? `https://firebasehosting.googleapis.com/v1beta1/projects/${config.projectId}/sites/${siteId}/releases?versionName=${versionName}`
    : `https://firebasehosting.googleapis.com/v1beta1/projects/${config.projectId}/sites/${siteId}/channels/${config.channel}/releases?versionName=${versionName}`;

  const response = await httpsRequest(releaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { message: 'Deployed via standalone script' },
  });

  console.log(`✅ Release created: ${response.data.name}`);
  return response.data.name;
}

// Main deployment function
async function deploy() {
  console.log('\n🔥 Firebase Hosting Deployment Tool\n');

  // Validate configuration
  if (!config.projectId) {
    console.error('❌ Error: Firebase project ID is required');
    console.error('Provide via --project=my-project or FIREBASE_PROJECT_ID env var');
    process.exit(1);
  }

  if (!config.accessToken) {
    console.error('❌ Error: Access token is required');
    console.error('Provide via --token=ya29.xxx or FIREBASE_ACCESS_TOKEN env var');
    console.error('\nTo get an access token:');
    console.error('1. Go to OAuth 2.0 Playground: https://developers.google.com/oauthplayground/');
    console.error('2. Select Firebase Hosting API v1beta1 scopes');
    console.error('3. Authorize and get access token');
    process.exit(1);
  }

  try {
    // Step 1: Check project exists
    const projectExists = await checkFirebaseProject();
    if (!projectExists) {
      process.exit(1);
    }

    // Step 2: Check hosting initialized
    const hostingInitialized = await checkHostingInitialized();
    if (!hostingInitialized) {
      process.exit(1);
    }

    // Step 3: Read files
    console.log(`\n📂 Reading files from: ${config.deployDir}`);
    const files = await readDirectory(config.deployDir);
    console.log(`✅ Found ${files.length} file(s)`);

    if (files.length === 0) {
      console.error('❌ Error: No files found to deploy');
      process.exit(1);
    }

    // Step 4: Create version
    const versionName = await createHostingVersion();

    // Step 5: Upload files
    await uploadFiles(versionName, files);

    // Step 6: Finalize version
    await finalizeVersion(versionName);

    // Step 7: Create release
    await createRelease(versionName);

    // Success!
    const siteUrl = config.channel === 'live'
      ? `https://${config.projectId}.web.app`
      : `https://${config.projectId}--${config.channel}.web.app`;

    console.log('\n🎉 Deployment successful!');
    console.log(`\n🌐 Your site is live at: ${siteUrl}\n`);

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
