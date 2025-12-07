#!/usr/bin/env python3

"""
Standalone Cloudflare Pages Deployment Script

This script deploys static websites to Cloudflare Pages using the REST API.
No Wrangler CLI required!

Requirements:
- Python 3.7+
- requests library (pip install requests)
- Valid Cloudflare API token with Pages:Edit permissions
- Cloudflare Account ID

Usage:
    python3 cloudflare-deploy.py --account=abc123 --token=xxx --project=my-site --dir=./out

Environment Variables (alternative to CLI args):
    CLOUDFLARE_ACCOUNT_ID - Your Cloudflare Account ID
    CLOUDFLARE_API_TOKEN - Your Cloudflare API token
    CLOUDFLARE_PROJECT_NAME - Your Pages project name
    DEPLOY_DIR - Directory containing files to deploy (default: ./out)

Note: This script is designed for text-based files (HTML, CSS, JS).
For sites with binary assets (images, fonts), use Wrangler CLI or the web interface.
"""

import os
import sys
import argparse
import json
import base64
from pathlib import Path
from typing import List, Dict, Tuple

try:
    import requests
except ImportError:
    print("❌ Error: requests library is required")
    print("Install it with: pip install requests")
    sys.exit(1)


class CloudflareDeployer:
    """Cloudflare Pages deployment using REST API"""

    def __init__(self, account_id: str, api_token: str, project_name: str, deploy_dir: str, branch: str = "main"):
        self.account_id = account_id
        self.api_token = api_token
        self.project_name = project_name
        self.deploy_dir = Path(deploy_dir)
        self.branch = branch
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        })

    def check_project_exists(self) -> bool:
        """Check if Cloudflare Pages project exists"""
        print(f"🔍 Checking if Cloudflare Pages project exists: {self.project_name}")
        
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/pages/projects/{self.project_name}"
        response = self.session.get(url)
        
        if response.status_code == 200:
            print("✅ Project exists")
            return True
        else:
            print("ℹ️  Project does not exist, will create it")
            return False

    def create_project(self) -> bool:
        """Create Cloudflare Pages project"""
        print(f"📝 Creating Cloudflare Pages project: {self.project_name}")
        
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/pages/projects"
        payload = {
            "name": self.project_name,
            "production_branch": self.branch,
        }
        
        response = self.session.post(url, json=payload)
        
        if response.status_code in (200, 201):
            print("✅ Project created")
            return True
        else:
            print(f"❌ Failed to create project: {response.text}")
            return False

    def read_files(self) -> List[Dict[str, str]]:
        """Read all files from deploy directory"""
        print(f"\n📂 Reading files from: {self.deploy_dir}")
        
        if not self.deploy_dir.exists():
            raise FileNotFoundError(f"Deploy directory not found: {self.deploy_dir}")
        
        files = []
        MAX_FILE_SIZE_MB = 25  # Cloudflare limit
        
        for file_path in self.deploy_dir.rglob("*"):
            if file_path.is_file():
                try:
                    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    
                    # Validate file size
                    size_mb = len(content.encode("utf-8")) / 1024 / 1024
                    if size_mb > MAX_FILE_SIZE_MB:
                        print(f"⚠️  Warning: {file_path.name} is {size_mb:.2f}MB (limit: {MAX_FILE_SIZE_MB}MB), skipping...")
                        continue
                    
                    # Get relative path with leading slash
                    relative_path = "/" + str(file_path.relative_to(self.deploy_dir)).replace("\\", "/")
                    
                    files.append({
                        "path": relative_path,
                        "content": content
                    })
                except Exception as e:
                    print(f"⚠️  Warning: Failed to read {file_path.name}: {e}")
        
        print(f"✅ Found {len(files)} file(s)")
        return files

    def deploy_files(self, files: List[Dict[str, str]]) -> Tuple[str, str]:
        """Deploy files to Cloudflare Pages"""
        print(f"🚀 Starting deployment to Cloudflare Pages...")
        
        # Create deployment
        print("📝 Creating deployment...")
        
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/pages/projects/{self.project_name}/deployments"
        payload = {
            "branch": self.branch,
        }
        
        response = self.session.post(url, json=payload)
        
        if not response.ok:
            raise Exception(f"Failed to create deployment: {response.text}")
        
        deploy_data = response.json()
        upload_url = deploy_data.get("result", {}).get("upload_url")
        deployment_id = deploy_data.get("result", {}).get("id", "unknown")
        
        if not upload_url:
            raise Exception("No upload URL received from Cloudflare")
        
        print("✅ Deployment created, uploading files...")
        
        # Create file manifest
        manifest = {}
        for file in files:
            # Encode content to base64
            content_bytes = file["content"].encode("utf-8")
            base64_content = base64.b64encode(content_bytes).decode("utf-8")
            manifest[file["path"]] = base64_content
            
            size_kb = len(file["content"]) / 1024
            print(f"   - {file['path']} ({size_kb:.2f} KB)")
        
        # Upload manifest
        upload_response = self.session.post(upload_url, json={"manifest": manifest})
        
        if not upload_response.ok:
            raise Exception(f"Failed to upload files: {upload_response.text}")
        
        print("✅ Files uploaded successfully")
        
        # Construct deployment URL
        deployment_url = f"https://{self.project_name}.pages.dev"
        
        return deployment_url, deployment_id

    def deploy(self) -> str:
        """Main deployment workflow"""
        print("\n☁️  Cloudflare Pages Deployment Tool (Python)\n")
        
        # Step 1: Check/create project
        project_exists = self.check_project_exists()
        if not project_exists:
            created = self.create_project()
            if not created:
                raise Exception("Failed to create project")
        
        # Step 2: Read files
        files = self.read_files()
        if not files:
            raise Exception("No files found to deploy")
        
        # Step 3: Deploy
        deployment_url, deployment_id = self.deploy_files(files)
        
        return deployment_url, deployment_id


def get_config() -> Tuple[str, str, str, str, str]:
    """Get configuration from CLI args or environment variables"""
    parser = argparse.ArgumentParser(
        description="Deploy static website to Cloudflare Pages using REST API"
    )
    parser.add_argument("--account", help="Cloudflare Account ID")
    parser.add_argument("--token", help="Cloudflare API token")
    parser.add_argument("--project", help="Cloudflare Pages project name")
    parser.add_argument("--dir", default="./out", help="Directory to deploy (default: ./out)")
    parser.add_argument("--branch", default="main", help="Deployment branch (default: main)")
    
    args = parser.parse_args()
    
    account_id = args.account or os.getenv("CLOUDFLARE_ACCOUNT_ID")
    api_token = args.token or os.getenv("CLOUDFLARE_API_TOKEN")
    project_name = args.project or os.getenv("CLOUDFLARE_PROJECT_NAME")
    deploy_dir = args.dir or os.getenv("DEPLOY_DIR", "./out")
    branch = args.branch or os.getenv("DEPLOY_BRANCH", "main")
    
    return account_id, api_token, project_name, deploy_dir, branch


def main():
    """Main entry point"""
    try:
        account_id, api_token, project_name, deploy_dir, branch = get_config()
        
        # Validate configuration
        if not account_id:
            print("❌ Error: Cloudflare Account ID is required")
            print("Provide via --account=xxx or CLOUDFLARE_ACCOUNT_ID env var")
            print("\nFind your Account ID at: https://dash.cloudflare.com/")
            sys.exit(1)
        
        if not api_token:
            print("❌ Error: Cloudflare API token is required")
            print("Provide via --token=xxx or CLOUDFLARE_API_TOKEN env var")
            print("\nCreate a token at: https://dash.cloudflare.com/profile/api-tokens")
            print("Required permission: Account → Cloudflare Pages → Edit")
            sys.exit(1)
        
        if not project_name:
            print("❌ Error: Project name is required")
            print("Provide via --project=my-site or CLOUDFLARE_PROJECT_NAME env var")
            sys.exit(1)
        
        # Create deployer and deploy
        deployer = CloudflareDeployer(account_id, api_token, project_name, deploy_dir, branch)
        deployment_url, deployment_id = deployer.deploy()
        
        # Success!
        print("\n🎉 Deployment successful!")
        print(f"\n🌐 Your site is live at: {deployment_url}")
        print(f"📋 Deployment ID: {deployment_id}\n")
        
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
