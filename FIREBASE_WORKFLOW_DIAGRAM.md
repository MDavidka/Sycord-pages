# Firebase Deployment Workflow Diagram

## Complete Deployment Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Sycord Pages App
    participant Google as Google OAuth
    participant Firebase as Firebase REST API
    participant MongoDB as Database

    %% Authentication Flow
    User->>App: Click "Authenticate with Google"
    App->>Google: Redirect to OAuth (with scopes)
    Google->>User: Show consent screen
    User->>Google: Grant permissions
    Google->>App: Callback with authorization code
    App->>Google: Exchange code for tokens
    Google->>App: Return access + refresh tokens
    App->>MongoDB: Store tokens securely
    App->>User: Redirect to project page (authenticated)

    %% Deployment Flow
    User->>App: Click "Deploy to Firebase"
    App->>MongoDB: Get access token

    alt Token expired
        App->>Google: Refresh access token
        Google->>App: New access token
        App->>MongoDB: Update token
    end

    App->>Firebase: GET /projects/{projectId}

    alt Project doesn't exist
        Firebase->>App: 404 Not Found
        App->>User: Show setup instructions
    else Project exists
        Firebase->>App: 200 OK (project info)

        App->>Firebase: GET /projects/{id}/sites/{id}

        alt Hosting not initialized
            Firebase->>App: 404 Not Found
            App->>User: Show Hosting setup instructions
        else Hosting initialized
            Firebase->>App: 200 OK (site info)

            %% Create Version
            App->>Firebase: POST /sites/{id}/versions
            Firebase->>App: 200 OK (version created)

            %% Upload Files
            App->>Firebase: POST /{version}:populateFiles
            Note over App,Firebase: Upload base64-encoded files
            Firebase->>App: 200 OK (files uploaded)

            %% Finalize Version
            App->>Firebase: PATCH /{version}?update_mask=status
            Note over App,Firebase: Set status=FINALIZED
            Firebase->>App: 200 OK (version finalized)

            %% Create Release
            App->>Firebase: POST /sites/{id}/releases
            Firebase->>App: 200 OK (release created)

            %% Update Database
            App->>MongoDB: Update project with deployment info
            App->>User: Show success + live URL 🎉
        end
    end
```

## API Call Sequence

### 1. Authentication (One-time setup)

```
1. User Action → Click "Authenticate with Google"
   ↓
2. GET https://accounts.google.com/o/oauth2/v2/auth
   - client_id, redirect_uri, scopes
   ↓
3. User grants permissions
   ↓
4. POST https://oauth2.googleapis.com/token
   - Exchange code for tokens
   ↓
5. Store tokens in MongoDB
```

### 2. Token Refresh (When expired)

```
1. Check token age in database
   ↓
2. If expired → POST https://oauth2.googleapis.com/token
   - Use refresh_token grant type
   ↓
3. Update access_token in database
```

### 3. Deployment (Main flow)

```
1. User Action → Click "Deploy to Firebase"
   ↓
2. Get valid access token (refresh if needed)
   ↓
3. Check project exists
   GET https://firebase.googleapis.com/v1beta1/projects/{projectId}
   ↓
4. Check hosting initialized
   GET https://firebasehosting.googleapis.com/v1beta1/projects/{id}/sites/{siteId}
   ↓
5. Create hosting version
   POST https://firebasehosting.googleapis.com/v1beta1/projects/{id}/sites/{siteId}/versions
   Response: { name: "projects/.../versions/abc123" }
   ↓
6. Upload files
   POST https://firebasehosting.googleapis.com/v1beta1/{versionName}:populateFiles
   Body: { files: { "/index.html": "base64...", ... } }
   ↓
7. Finalize version
   PATCH https://firebasehosting.googleapis.com/v1beta1/{versionName}?update_mask=status
   Body: { status: "FINALIZED" }
   ↓
8. Create release
   POST https://firebasehosting.googleapis.com/v1beta1/projects/{id}/sites/{siteId}/releases
   Query: versionName={versionName}
   ↓
9. Update database with deployment info
   ↓
10. Return success + URL to user
```

## Error Handling Flow

```mermaid
flowchart TD
    Start[Start Deployment] --> GetToken[Get Access Token]
    GetToken --> CheckExpired{Token Expired?}
    CheckExpired -->|Yes| Refresh[Refresh Token]
    CheckExpired -->|No| CheckProject[Check Project Exists]
    Refresh --> RefreshOK{Refresh Success?}
    RefreshOK -->|Yes| CheckProject
    RefreshOK -->|No| Error1[Error: Re-authenticate]

    CheckProject --> ProjectExists{Project Exists?}
    ProjectExists -->|No| Error2[Error: Create Project Instructions]
    ProjectExists -->|Yes| CheckHosting[Check Hosting]

    CheckHosting --> HostingOK{Hosting Initialized?}
    HostingOK -->|No| Error3[Error: Initialize Hosting Instructions]
    HostingOK -->|Yes| CreateVersion[Create Version]

    CreateVersion --> VersionOK{Success?}
    VersionOK -->|No| Error4[Error: Version Creation Failed]
    VersionOK -->|Yes| UploadFiles[Upload Files]

    UploadFiles --> UploadOK{Success?}
    UploadOK -->|No| Error5[Error: File Upload Failed]
    UploadOK -->|Yes| FinalizeVersion[Finalize Version]

    FinalizeVersion --> FinalizeOK{Success?}
    FinalizeOK -->|No| Error6[Error: Finalization Failed]
    FinalizeOK -->|Yes| CreateRelease[Create Release]

    CreateRelease --> ReleaseOK{Success?}
    ReleaseOK -->|No| Error7[Error: Release Failed]
    ReleaseOK -->|Yes| Success[Success! Site Live]

    Error1 --> End[Return Error to User]
    Error2 --> End
    Error3 --> End
    Error4 --> End
    Error5 --> End
    Error6 --> End
    Error7 --> End
    Success --> End
```

## Channel-Specific Deployment

### Live Channel (Default)

```
POST /projects/{id}/sites/{siteId}/releases?versionName={version}
↓
Site live at: https://{siteId}.web.app
```

### Preview Channel

```
POST /projects/{id}/sites/{siteId}/channels/preview/releases?versionName={version}
↓
Site live at: https://{siteId}--preview.web.app
```

### Custom Channel

```
POST /projects/{id}/sites/{siteId}/channels/{channelId}/releases?versionName={version}
↓
Site live at: https://{siteId}--{channelId}.web.app
```

## Data Flow

### User Interaction → API → Database

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ 1. Click "Authenticate"
       ▼
┌─────────────┐
│  Frontend   │
│  Component  │
└──────┬──────┘
       │ 2. Redirect to OAuth
       ▼
┌─────────────┐
│   Google    │
│   OAuth     │
└──────┬──────┘
       │ 3. Callback with code
       ▼
┌─────────────┐
│   Backend   │
│ /api/auth/  │
│  callback   │
└──────┬──────┘
       │ 4. Store tokens
       ▼
┌─────────────┐      ┌─────────────┐
│   MongoDB   │◄─────┤   Backend   │
│             │      │ /api/deploy │
└─────────────┘      └──────┬──────┘
                            │ 5. Deploy via REST API
                            ▼
                     ┌─────────────┐
                     │  Firebase   │
                     │   Hosting   │
                     │  REST API   │
                     └─────────────┘
```

## Security Flow

```
1. OAuth Tokens
   ├─ Stored encrypted in MongoDB
   ├─ Access token: Short-lived (1 hour)
   ├─ Refresh token: Long-lived (used to get new access tokens)
   └─ Scoped to specific user + project

2. API Authentication
   ├─ All Firebase API calls include: Authorization: Bearer {token}
   ├─ Token validated by Google for each request
   └─ Invalid token → 401 error → Auto-refresh or re-auth

3. User Authorization
   ├─ Session checked before deployment
   ├─ User can only deploy their own projects
   └─ Tokens tied to user + project in database
```

## File Preparation

```javascript
// Convert files for upload
const files = {}
for (const page of project.pages) {
  const path = page.name.startsWith('/') ? page.name : '/' + page.name
  const base64Content = Buffer.from(page.content, 'utf-8').toString('base64')
  files[path] = base64Content
}

// Send to Firebase
POST /{versionName}:populateFiles
Body: { files: files }
```

## Response Handling

```javascript
// Success response
{
  success: true,
  url: "https://my-site.web.app",
  projectId: "my-site-abc123",
  versionName: "projects/.../versions/xyz789",
  releaseName: "projects/.../releases/rel456",
  channel: "live"
}

// Error response with instructions
{
  message: "Firebase project does not exist",
  details: "The Firebase project 'my-site-abc123' does not exist...",
  instructions: [
    "1. Go to https://console.firebase.google.com/",
    "2. Create a new project...",
    ...
  ],
  helpUrl: "https://console.firebase.google.com/"
}
```
