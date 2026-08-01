# MCP OAuth Debugging Guide

## Enhanced Error Detection & Display

This guide explains the new comprehensive error debugging system for MCP OAuth connections.

---

## What Changed

### 1. **Detailed Error Screen in Popup**
When OAuth fails, the popup now shows:
- ✓ Status indicator (Connected ✓ or Failed ✕)
- ✓ Clear error message
- ✓ Error details in a formatted box
- ✓ Debug info (addon ID, project ID, timestamp)
- ✓ Visual countdown timer

**Error Screen Example:**
```
┌─────────────────────────────────────┐
│ ✕ Connection Failed                 │
├─────────────────────────────────────┤
│ MCP OAuth connection encountered an │
│ error:                              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │Error: Syte workspace is not     │ │
│ │configured. Check SYTE_WORKSPACE │ │
│ │_ID or DEPLOYER_API_KEY.         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Details:                            │
│ Addon: github                       │
│ Project: abc123                     │
│ Timestamp: 2025-08-01T...          │
│                                     │
│ Window closing in 2 seconds...      │
└─────────────────────────────────────┘
```

### 2. **Enhanced UI Error Alert**
In the MCP Library panel, errors now display with:
- ✓ Red error box (contextual styling)
- ✓ Bold "MCP Connection Error" header
- ✓ Full error message text
- ✓ Debug info dropdown with instructions
- ✓ Dismiss button to clear error

**UI Error Alert Example:**
```
┌──────────────────────────────────────────────┐
│ MCP Connection Error                         │
├──────────────────────────────────────────────┤
│ Failed to sync to Sycord: 503 Service        │
│ Unavailable                                  │
│                                              │
│ ▼ Debug Info                                 │
│   Check browser console for detailed logs    │
│   Press F12 → Console to see request ID      │
│   and error details                          │
│                                              │
│ [Dismiss]                                    │
└──────────────────────────────────────────────┘
```

### 3. **Server-Side Detailed Logging**
Every OAuth callback now logs with a unique Request ID.

---

## How to Debug

### Step 1: Open Browser DevTools
Press **F12** or right-click → **Inspect** → **Console tab**

### Step 2: Trigger MCP Connection
Click to connect any OAuth MCP (e.g., GitHub)

### Step 3: Watch Console Logs
You'll see logs like:

```
[MCP-OAuth-abc1234] Callback initiated from origin: http://localhost:3000
[MCP-OAuth-abc1234] Session user: user-id-here, has code: true, has state: true
[MCP-OAuth-abc1234] Exchanging OAuth code for tokens...
[MCP-OAuth-abc1234] Token exchange successful, tokens: access_token, refresh_token
[MCP-OAuth-abc1234] Starting Sycord sync... useSyteWorkspace=true
[MCP-OAuth-abc1234] Getting workspace UUID for project: proj-xyz
[MCP-OAuth-abc1234] Got workspace UUID: workspace-uuid-123
[MCP-OAuth-abc1234] Syncing environment variables to Sycord...
[MCP-OAuth-abc1234] Env synced successfully. Enabling MCP addon: github
[MCP-OAuth-abc1234] MCP addon connected successfully!
[MCP-OAuth-abc1234] Final result - ok=true, error=none
```

Or if it fails:

```
[MCP-OAuth-def5678] Callback initiated from origin: http://localhost:3000
[MCP-OAuth-def5678] Session user: none
[MCP-OAuth-def5678] Failed: Unauthorized
```

### Step 4: Check Error Details

#### Look for these key Request ID markers:
- `[MCP-OAuth-XXXXXX]` — Unique request identifier
- Follow the full chain to see where it failed
- Each step is clearly labeled

#### Common Error Patterns:

**Pattern 1: OAuth Provider Error**
```
[MCP-OAuth-xyz] OAuth provider error: access_denied - user denied access
```
→ User clicked "Deny" in OAuth consent screen

**Pattern 2: Token Exchange Failed**
```
[MCP-OAuth-xyz] Token exchange failed: invalid_client
```
→ OAuth client credentials are wrong or not set

**Pattern 3: Sycord Workspace Not Configured**
```
[MCP-OAuth-xyz] Syte workspace is not configured. Check SYTE_WORKSPACE_ID or DEPLOYER_API_KEY.
```
→ Missing environment variables in Vercel project

**Pattern 4: Sycord Sync Failed**
```
[MCP-OAuth-xyz] Failed to sync to Sycord: 503 Service Unavailable
```
→ sycord.site API is down or not reachable

**Pattern 5: MCP Addon Enable Failed**
```
[MCP-OAuth-xyz] Failed to enable addon on Sycord: workspace_not_found
```
→ Workspace UUID doesn't exist on Sycord

---

## Error Message Interpretation

### In Popup Error Box:

| Error Message | Cause | Fix |
|---|---|---|
| `OAuth provider error: access_denied` | User denied OAuth | User must approve |
| `Token exchange failed: invalid_client` | Bad credentials | Check MCP_*_CLIENT_ID/SECRET env vars |
| `Syte workspace is not configured` | Missing env vars | Set SYTE_WORKSPACE_ID or DEPLOYER_API_KEY |
| `Failed to sync to Sycord: 503` | Sycord API down | Wait & retry, or contact Sycord support |
| `Failed to enable addon on Sycord: workspace_not_found` | Invalid workspace UUID | Verify workspace exists in Sycord |
| `postMessage failed: *` | Browser security issue | Check origin matching |

### In UI Error Alert:

Same error messages appear here, with full context from server logs.

---

## Copy Debug Info

To share errors for support:

1. Open DevTools (F12)
2. Right-click log lines → **Copy message**
3. Find lines with `[MCP-OAuth-XXXXXX]`
4. Copy the full chain (start to finish)
5. Include the final popup error message

Example share format:
```
Request ID: MCP-OAuth-abc1234

Server Logs:
[MCP-OAuth-abc1234] Callback initiated from origin: http://localhost:3000
[MCP-OAuth-abc1234] Token exchange successful, tokens: access_token, refresh_token
[MCP-OAuth-abc1234] Failed to sync to Sycord: 503 Service Unavailable

Error in Popup:
Failed to sync to Sycord: 503 Service Unavailable
```

---

## What Each Log Means

### Callback Initiated ✓
```
[MCP-OAuth-abc] Callback initiated from origin: http://localhost:3000
```
→ OAuth callback received, origin detected correctly

### Session Check ✓
```
[MCP-OAuth-abc] Session user: user-id-123, has code: true, has state: true
```
→ User authenticated, OAuth code received, state token valid

### Token Exchange ✓
```
[MCP-OAuth-abc] Exchanging OAuth code for tokens...
[MCP-OAuth-abc] Token exchange successful, tokens: access_token, refresh_token
```
→ OAuth provider returned tokens successfully

### Workspace Resolution ✓
```
[MCP-OAuth-abc] Starting Sycord sync... useSyteWorkspace=true
[MCP-OAuth-abc] Got workspace UUID: workspace-uuid-123
```
→ Sycord workspace found and ready

### Env Sync ✓
```
[MCP-OAuth-abc] Syncing environment variables to Sycord...
[MCP-OAuth-abc] Env synced successfully. Enabling MCP addon: github
```
→ Credentials sent to Sycord

### MCP Enable ✓
```
[MCP-OAuth-abc] MCP addon connected successfully!
[MCP-OAuth-abc] Final result - ok=true, error=none
```
→ All steps completed successfully

---

## Browser Compatibility

- ✓ Chrome/Edge/Brave: Full logging support
- ✓ Firefox: Full logging support  
- ✓ Safari: Full logging support
- ✓ Mobile browsers: Console available via WebInspector (iOS) or DevTools (Android)

---

## Network Inspection

To inspect API calls:

1. Open DevTools (F12) → **Network** tab
2. Trigger MCP connection
3. Look for requests to:
   - `/api/mcp/oauth/start` — Starts OAuth flow
   - `/api/mcp/oauth/callback` — Receives OAuth result
   - `/api/projects/[id]/agent/mcp` — Checks MCP status

Click each request → **Response** tab to see API results.

---

## Still Stuck?

If errors persist after checking above:

1. **Verify Environment Variables**
   - Check Vercel project Settings → Environment Variables
   - Required: `MCP_GITHUB_CLIENT_ID`, `MCP_GITHUB_CLIENT_SECRET`, `DEPLOYER_API_KEY`
   - All must be set and non-empty

2. **Check Sycord Status**
   - Visit https://sycord.site
   - Try accessing `/api` endpoint to verify it's up

3. **Test from Console**
   ```javascript
   // Manually trigger connection
   fetch('/api/mcp/oauth/start?projectId=test&addon=github&format=json')
     .then(r => r.json())
     .then(d => console.log(d))
   ```

4. **Check Server Logs**
   - In Vercel dashboard, check Function Logs
   - Filter by request ID from console logs
   - Look for full stack traces

---

## Version Info

- Enhanced error display: v2
- Detailed logging: Enabled
- Popup timeout: 2000ms
- UI error retention: Until manually dismissed
