#!/usr/bin/env python3

"""
Standalone Firebase Hosting Deployment Script (Python)

This script deploys static websites to Firebase Hosting using only the REST API.
No Firebase CLI required!

Requirements:
- Python 3.7+
- requests library (pip install requests)
- Valid Google OAuth access token with Firebase permissions

Usage:
    python3 firebase-deploy-standalone.py --project=my-project --token=ya29.xxx --dir=./public

Environment Variables (alternative to CLI args):
    FIREBASE_PROJECT_ID - Your Firebase project ID
    FIREBASE_ACCESS_TOKEN - Your Google OAuth access token
    DEPLOY_DIR - Directory containing files to deploy (default: ./public)
    DEPLOY_CHANNEL - Deployment channel (default: live, can be preview or custom)
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


class FirebaseDeployer:
    """Firebase Hosting deployment using REST API"""

    def __init__(self, project_id: str, access_token: str, deploy_dir: str, channel: str = "live"):
        self.project_id = project_id
        self.access_token = access_token
        self.deploy_dir = Path(deploy_dir)
        self.channel = channel
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        })

    def check_project_exists(self) -> bool:
        """Check if Firebase project exists"""
        print(f"🔍 Checking if Firebase project exists: {self.project_id}")
        
        url = f"https://firebase.googleapis.com/v1beta1/projects/{self.project_id}"
        response = self.session.get(url)
        
        if response.status_code == 200:
            print("✅ Project exists")
            return True
        else:
            print("❌ Project does not exist or you don't have access")
            print("\nPlease ensure:")
            print(f"1. Firebase project '{self.project_id}' exists")
            print("2. You have the necessary permissions")
            print("3. Your access token is valid")
            print("\nCreate project at: https://console.firebase.google.com/")
            return False

    def check_hosting_initialized(self) -> bool:
        """Check if Hosting is initialized for the site"""
        site_id = self.project_id
        print(f"🔍 Checking if Hosting is initialized for site: {site_id}")
        
        url = f"https://firebasehosting.googleapis.com/v1beta1/projects/{self.project_id}/sites/{site_id}"
        response = self.session.get(url)
        
        if response.status_code == 200:
            print("✅ Hosting is initialized")
            return True
        else:
            print("❌ Hosting is not initialized")
            print("\nPlease initialize Hosting:")
            print(f"1. Go to https://console.firebase.google.com/project/{self.project_id}/hosting")
            print("2. Click 'Get started' to initialize Hosting")
            print("3. Return here and run the script again")
            return False

    def read_files(self) -> List[Dict[str, str]]:
        """Read all files from deploy directory"""
        print(f"\n📂 Reading files from: {self.deploy_dir}")
        
        if not self.deploy_dir.exists():
            raise FileNotFoundError(f"Deploy directory not found: {self.deploy_dir}")
        
        files = []
        for file_path in self.deploy_dir.rglob("*"):
            if file_path.is_file():
                # Read file content
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                
                # Get relative path with leading slash
                relative_path = "/" + str(file_path.relative_to(self.deploy_dir)).replace("\\", "/")
                
                files.append({
                    "path": relative_path,
                    "content": content
                })
        
        print(f"✅ Found {len(files)} file(s)")
        return files

    def create_hosting_version(self) -> str:
        """Create a new hosting version"""
        site_id = self.project_id
        print("📝 Creating new hosting version...")
        
        url = f"https://firebasehosting.googleapis.com/v1beta1/projects/{self.project_id}/sites/{site_id}/versions"
        payload = {
            "config": {
                "headers": [{
                    "glob": "**",
                    "headers": {
                        "Cache-Control": "public, max-age=3600"
                    }
                }]
            }
        }
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        version_data = response.json()
        version_name = version_data["name"]
        print(f"✅ Version created: {version_name}")
        return version_name

    def upload_files(self, version_name: str, files: List[Dict[str, str]]) -> None:
        """Upload files to the version"""
        print(f"📤 Uploading {len(files)} file(s)...")
        
        # Convert files to base64
        file_list = {}
        for file in files:
            # Encode content to base64
            content_bytes = file["content"].encode("utf-8")
            base64_content = base64.b64encode(content_bytes).decode("utf-8")
            file_list[file["path"]] = base64_content
            
            size_kb = len(file["content"]) / 1024
            print(f"   - {file['path']} ({size_kb:.2f} KB)")
        
        url = f"https://firebasehosting.googleapis.com/v1beta1/{version_name}:populateFiles"
        payload = {"files": file_list}
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        print("✅ Files uploaded successfully")

    def finalize_version(self, version_name: str) -> None:
        """Finalize the version"""
        print("🔨 Finalizing version...")
        
        url = f"https://firebasehosting.googleapis.com/v1beta1/{version_name}?update_mask=status"
        payload = {"status": "FINALIZED"}
        
        response = self.session.patch(url, json=payload)
        response.raise_for_status()
        
        print("✅ Version finalized")

    def create_release(self, version_name: str) -> str:
        """Create a release to deploy the version"""
        site_id = self.project_id
        print(f"🚀 Creating release on channel: {self.channel}...")
        
        if self.channel == "live":
            url = f"https://firebasehosting.googleapis.com/v1beta1/projects/{self.project_id}/sites/{site_id}/releases?versionName={version_name}"
        else:
            url = f"https://firebasehosting.googleapis.com/v1beta1/projects/{self.project_id}/sites/{site_id}/channels/{self.channel}/releases?versionName={version_name}"
        
        payload = {"message": "Deployed via Python standalone script"}
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        release_data = response.json()
        release_name = release_data["name"]
        print(f"✅ Release created: {release_name}")
        return release_name

    def deploy(self) -> str:
        """Main deployment workflow"""
        print("\n🔥 Firebase Hosting Deployment Tool (Python)\n")
        
        # Step 1: Check project exists
        if not self.check_project_exists():
            raise Exception("Project check failed")
        
        # Step 2: Check hosting initialized
        if not self.check_hosting_initialized():
            raise Exception("Hosting not initialized")
        
        # Step 3: Read files
        files = self.read_files()
        if not files:
            raise Exception("No files found to deploy")
        
        # Step 4: Create version
        version_name = self.create_hosting_version()
        
        # Step 5: Upload files
        self.upload_files(version_name, files)
        
        # Step 6: Finalize version
        self.finalize_version(version_name)
        
        # Step 7: Create release
        self.create_release(version_name)
        
        # Construct site URL
        if self.channel == "live":
            site_url = f"https://{self.project_id}.web.app"
        else:
            site_url = f"https://{self.project_id}--{self.channel}.web.app"
        
        return site_url


def get_config() -> Tuple[str, str, str, str]:
    """Get configuration from CLI args or environment variables"""
    parser = argparse.ArgumentParser(
        description="Deploy static website to Firebase Hosting using REST API"
    )
    parser.add_argument("--project", help="Firebase project ID")
    parser.add_argument("--token", help="Google OAuth access token")
    parser.add_argument("--dir", default="./public", help="Directory to deploy (default: ./public)")
    parser.add_argument("--channel", default="live", help="Deployment channel (default: live)")
    
    args = parser.parse_args()
    
    project_id = args.project or os.getenv("FIREBASE_PROJECT_ID")
    access_token = args.token or os.getenv("FIREBASE_ACCESS_TOKEN")
    deploy_dir = args.dir or os.getenv("DEPLOY_DIR", "./public")
    channel = args.channel or os.getenv("DEPLOY_CHANNEL", "live")
    
    return project_id, access_token, deploy_dir, channel


def main():
    """Main entry point"""
    try:
        project_id, access_token, deploy_dir, channel = get_config()
        
        # Validate configuration
        if not project_id:
            print("❌ Error: Firebase project ID is required")
            print("Provide via --project=my-project or FIREBASE_PROJECT_ID env var")
            sys.exit(1)
        
        if not access_token:
            print("❌ Error: Access token is required")
            print("Provide via --token=ya29.xxx or FIREBASE_ACCESS_TOKEN env var")
            print("\nTo get an access token:")
            print("1. Go to OAuth 2.0 Playground: https://developers.google.com/oauthplayground/")
            print("2. Select Firebase Hosting API v1beta1 scopes")
            print("3. Authorize and get access token")
            sys.exit(1)
        
        # Create deployer and deploy
        deployer = FirebaseDeployer(project_id, access_token, deploy_dir, channel)
        site_url = deployer.deploy()
        
        # Success!
        print("\n🎉 Deployment successful!")
        print(f"\n🌐 Your site is live at: {site_url}\n")
        
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
