# MCP OAuth Debugging — Quick Start

## Your MCP connection just failed. Here's what to do:

### Step 1: Open Developer Tools
```
Press F12 or Cmd+Opt+I (Mac) / Ctrl+Shift+I (Windows/Linux)
Click the "Console" tab
```

### Step 2: Look for MCP Logs
You'll see logs like:
```
[MCP-OAuth-abc1234] Callback initiated from origin: http://localhost:3000
```

**Copy this Request ID: `abc1234`** (the 6-character code)

### Step 3: Read the Error

Scroll through the console logs to find any RED ERROR messages with your Request ID:

```
[MCP-OAuth-abc1234] ✗ Failed to sync to Sycord: 503 Service Unavailable
```

**This error message** is what you need to fix.

### Step 4: Check the Popup

The OAuth popup (if visible) now shows:
- ✕ Connection Failed (or ✓ if successful)
- Full error message
- Debug info (addon, project, timestamp)

### Step 5: Fix Based on Error

| Error | Fix |
|-------|-----|
| `access_denied` | User denied OAuth — try again & click Allow |
| `Token exchange failed: invalid_client` | Check MCP_GITHUB_CLIENT_ID env var is set |
| `Syte workspace is not configured` | Set DEPLOYER_API_KEY env var in Vercel |
| `Failed to sync to Sycord: 503` | Sycord.site API is down — wait & retry |
| `Failed to enable addon on Sycord` | Contact support with Request ID |
| `postMessage failed` | Browser security issue — use Chrome/Firefox |

### Step 6: In the UI

The MCP Library panel now shows a RED ERROR BOX:
```
┌─ MCP Connection Error ──────────────┐
│ Failed to sync to Sycord: 503...    │
│ ▼ Debug Info                        │
│   Check browser console for logs... │
│ [Dismiss]                           │
└────────────────────────────────────┘
```

---

## Common Scenarios

### Scenario A: Missing Environment Variables
**Error:** `Syte workspace is not configured`
**Console shows:** `useSyteWorkspace=false`

**Fix:**
1. Go to Vercel Dashboard
2. Project Settings → Environment Variables
3. Add/verify:
   - `DEPLOYER_API_KEY` = (your Sycord API key)
   - `MCP_GITHUB_CLIENT_ID` = (GitHub OAuth client ID)
   - `MCP_GITHUB_CLIENT_SECRET` = (GitHub OAuth secret)
4. Redeploy or restart dev server

### Scenario B: OAuth Provider Denied
**Error:** `OAuth provider error: access_denied`
**Popup:** Shows "Connection Failed"

**Fix:**
1. Try again
2. This time, click "Allow" in the OAuth consent screen
3. If you click "Deny", this error appears

### Scenario C: Sycord is Down
**Error:** `Failed to sync to Sycord: 503 Service Unavailable`
**Console shows:** Token exchange successful but sync failed

**Fix:**
1. Check if https://sycord.site is accessible
2. If down, wait for it to come back up
3. Try connection again
4. Contact support if persists

### Scenario D: Invalid Workspace
**Error:** `Failed to get workspace: workspace_not_found`
**Console shows:** workspace retrieval failed

**Fix:**
1. Verify `SYTE_WORKSPACE_ID` is correct
2. Or use `DEPLOYER_API_KEY` to auto-detect workspace
3. Check Sycord dashboard that workspace still exists

---

## Copy Debug Info for Support

If you need to share the error:

1. Open DevTools (F12)
2. Find the `[MCP-OAuth-XXXXXX]` Request ID
3. Copy all logs with that Request ID
4. Include the error message from the popup
5. Share with support

**Example:**
```
Request ID: MCP-OAuth-abc1234
Error: Failed to sync to Sycord: 503 Service Unavailable

Full console output:
[MCP-OAuth-abc1234] Callback initiated from origin: http://localhost:3000
[MCP-OAuth-abc1234] Token exchange successful, tokens: access_token, refresh_token
[MCP-OAuth-abc1234] Starting Sycord sync... useSyteWorkspace=true
[MCP-OAuth-abc1234] Failed to sync to Sycord: 503 Service Unavailable
```

---

## Verification

### To verify the new error system is working:

1. **Try to connect an MCP** (e.g., GitHub)
2. **Check DevTools Console** — You should see Request ID logs
3. **If error:** Popup shows formatted error + UI shows red alert
4. **If success:** You see `MCP addon connected successfully!` in logs

### To intentionally trigger an error (for testing):

```javascript
// In browser console, run this to simulate error:
fetch('/api/mcp/oauth/start?projectId=fake&addon=github&format=json')
  .then(r => r.json())
  .then(d => console.log('OAuth config check:', d))
```

If `needsConfig: true` appears, OAuth credentials aren't set.

---

## Key Points

✓ **Every connection** has a unique Request ID  
✓ **Every step** is logged in console  
✓ **Every error** shows in popup AND UI  
✓ **All logs** stay in DevTools console  
✓ **Request ID** lets you trace the full flow  

---

## Still Stuck?

1. **Check the error message** — Is it clear what went wrong?
2. **Verify env vars** — Are all required vars set in Vercel?
3. **Restart dev server** — `npm run dev`
4. **Check console logs** — Do you see `[MCP-OAuth-XXXXXX]` logs?
5. **Read MCP_DEBUG_GUIDE.md** — Full troubleshooting guide
6. **Copy Request ID** — Share for support

---

## Reference

- **Full Guide:** `MCP_DEBUG_GUIDE.md`
- **What Was Fixed:** `MCP_OAUTH_BUGFIXES.md`
- **Enhancements Overview:** `MCP_ENHANCEMENTS.md`
- **Investigation Report:** `MCP_INVESTIGATION_REPORT.md`

---

**You've got this! 🚀**
