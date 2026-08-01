# MCP OAuth Fix - Verification Guide

## Quick Start Verification

### 1. Check the Fixes Are Applied

```bash
# Check for unique window name generation
grep -n "sycord-mcp-oauth-.*Date.now" glovix/components/SlashLibraries.tsx

# Check for getOpenerOrigin function
grep -n "function getOpenerOrigin" app/api/mcp/oauth/callback/route.ts

# Check for increased timeout
grep -n "setTimeout.*1200" app/api/mcp/oauth/callback/route.ts

# Check for error logging in UI
grep -n "\[v0\] MCP OAuth" glovix/components/SlashLibraries.tsx
```

Expected output: All commands should find matches ✓

---

## Browser-Based Verification

### Step 1: Open Dev Tools
```
Right-click → Inspect → Console tab
```

### Step 2: Look for Debug Messages

**When clicking "Connect GitHub":**
```
[Window Name] sycord-mcp-oauth-1722555600123-a3b2c1d4e5f6
```

**During OAuth approval:**
- The popup window will be named something unique like above
- No errors in console during redirects

**After OAuth success:**
```
[v0] MCP OAuth succeeded for addon: github
```

**If Sycord API fails:**
```
[v0] MCP OAuth failed: Syte workspace is not configured
```

---

## Technical Verification

### Check 1: Unique Window Names

```javascript
// In browser console, run this multiple times:
const popup1 = window.open('about:blank', 'sycord-mcp-oauth-' + Date.now(), 'width=400,height=300');
popup1.close();

// Each window gets unique name:
// sycord-mcp-oauth-1722555600123
// sycord-mcp-oauth-1722555600234
// sycord-mcp-oauth-1722555600345
```

### Check 2: Origin Verification

When OAuth popup opens, it shows:
```
Referer: http://localhost:3000/workbench
→ Extracted origin: http://localhost:3000 ✓
```

Then postMessage sends to correct origin (NOT https://sycord.site)

### Check 3: Error Details Display

Test by temporarily breaking Sycord connection:
1. Invalid `DEPLOYER_API_KEY` 
2. Click "Connect GitHub"
3. You should see: **"Failed to authenticate with Syte"** (not generic error)

---

## API-Level Verification

### Check Callback Route Headers

```bash
# Open network tab in DevTools
# Click "Connect GitHub"
# Find the callback request to /api/mcp/oauth/callback

# Check headers sent:
Referer: http://localhost:3000/workbench  ← Used to extract origin
```

### Check Sycord API Calls

In DevTools Network tab, look for requests to `https://sycord.site/api/`:
```
POST /api/set_env          ← Sync tokens to Sycord
POST /api/agent_mcp_connect ← Enable addon
```

Both should return `200 OK` with `{"ok": true}`

---

## Expected Behavior After Fix

### ✅ Success Flow

1. **Click "Connect GitHub"**
   - Unique popup opens
   - URL shown in popup title: `sycord-mcp-oauth-{unique}`

2. **User approves on GitHub**
   - Redirects to `/api/mcp/oauth/callback?code=xxx&state=xxx`
   - Server extracts correct opener origin from Referer header
   - Exchanges code for token
   - Syncs token to Sycord via `syteSetEnv()`
   - Enables addon via `syteAgentMcpConnect()`

3. **Popup shows success**
   - Text: "Connected — you can close this window."
   - postMessage sent to correct origin with `{ok: true}`
   - Popup closes after 1.2 seconds

4. **Parent window refreshes**
   - GitHub addon marked as "Connected" ✓
   - Console shows: `[v0] MCP OAuth succeeded for addon: github`

### ❌ Error Flow (Example)

1. **Sycord API returns error** (e.g., invalid credentials)
2. **Callback renders error in popup**:
   - Text: "Connection failed."
   - postMessage includes: `{ok: false, connectError: "specific error"}`
3. **Parent window shows error**:
   - Console shows: `[v0] MCP OAuth failed: specific error`
   - UI displays error message to user

---

## Command-Line Verification

### Build Verification
```bash
npm run build
# Should complete with "Compiled successfully"
# No TypeScript errors
```

### Dev Server Verification
```bash
npm run dev
# Should start on http://localhost:3000
# No server-side errors in console
```

### Check Specific Functions
```bash
# Verify getOpenerOrigin exists and is exported
npx ts-node -e "
  import('app/api/mcp/oauth/callback/route.ts').then(m => {
    console.log('✓ Route exports found')
  })
"
```

---

## Network Tab Analysis

### Expected Requests During OAuth Flow

| Request | URL | Method | Status | Notes |
|---------|-----|--------|--------|-------|
| 1 | `/api/mcp/oauth/start?projectId=...` | GET | 302 → GitHub | Redirects to GitHub OAuth |
| 2 | `https://github.com/login/oauth/authorize` | GET | 200 | GitHub OAuth page |
| 3 | `https://github.com/login/oauth/access_token` | POST | 200 | (in popup, not visible) |
| 4 | `/api/mcp/oauth/callback?code=...&state=...` | GET | 200 | Returns HTML with postMessage |
| 5 | `https://sycord.site/api/set_env` | POST | 200 | (server-side) |
| 6 | `https://sycord.site/api/agent_mcp_connect` | POST | 200 | (server-side) |

---

## Debugging Tips

### If Popup Won't Open
```javascript
// Check popup blocker
window.open('https://example.com', 'test-' + Date.now())
// If null, popup blocker is active
```

### If postMessage Fails
```javascript
// Check in callback popup console:
// Should see: window.opener exists and isn't closed
console.log('Opener:', window.opener);
console.log('Opener closed?', window.opener?.closed);
console.log('Origin:', window.location.origin);
```

### If Sycord API Fails
```bash
# Check environment variables
echo $DEPLOYER_API_KEY  # Should not be empty
echo $DEPLOYER_API_URL  # Should be https://sycord.site

# Test API directly
curl -H "X-API-Key: ${DEPLOYER_API_KEY}" \
  https://sycord.site/api/health
# Should return 200
```

---

## Before/After Comparison

### Before (Broken)

```
User Clicks "Connect GitHub"
    ↓
Popup opens with name 'sycord-mcp-oauth' (static, global)
    ↓
User approves on GitHub
    ↓
Callback fires postMessage to window.location.origin (sycord.site)
    ↓
Browser blocks postMessage (origin mismatch)
    ↓
Popup shows "Connection failed"
    ↓
Parent window never gets message
    ↓
User sees generic error with no details
```

### After (Fixed)

```
User Clicks "Connect GitHub"
    ↓
Popup opens with unique name 'sycord-mcp-oauth-1722555600123-a3b2c1' 
    ↓
User approves on GitHub
    ↓
Callback extracts opener origin from Referer: http://localhost:3000
    ↓
postMessage sent to correct origin with specific error details
    ↓
Browser accepts postMessage
    ↓
Popup shows "Connected — you can close this window." or specific error
    ↓
Parent window receives postMessage event
    ↓
UI refreshes and shows addon as connected OR displays detailed error
    ↓
User sees success confirmation or specific error explanation
```

---

## Success Indicators

### ✅ All Fixes Working
- [ ] Popup has unique name each time: `sycord-mcp-oauth-{timestamp}-{random}`
- [ ] Console logs `[v0] MCP OAuth succeeded` on success
- [ ] Console logs `[v0] MCP OAuth failed: {specific error}` on failure
- [ ] Popup closes automatically after ~1-2 seconds
- [ ] Parent window refreshes and shows addon status
- [ ] No "connection failed" generic error messages

### ❌ Something Still Wrong
- [ ] Generic "connection failed" error persists
- [ ] Popup window name is always same: `sycord-mcp-oauth`
- [ ] No console logs from MCP flow
- [ ] Popup doesn't close automatically
- [ ] Parent window doesn't refresh

---

## Rollback Plan

If issues occur:

```bash
# Revert to previous version
git checkout HEAD~1 -- app/api/mcp/oauth/callback/route.ts
git checkout HEAD~1 -- glovix/components/SlashLibraries.tsx

# Rebuild
npm run build

# Restart dev server
npm run dev
```

---

## Questions & Support

If verification fails, check:

1. **Are all environment variables set?**
   ```bash
   echo $MCP_GITHUB_CLIENT_ID
   echo $MCP_GITHUB_CLIENT_SECRET
   echo $DEPLOYER_API_KEY
   ```

2. **Is dev server running on http://localhost:3000?**
   ```bash
   curl -s http://localhost:3000 | head -5
   ```

3. **Are there TypeScript errors?**
   ```bash
   npm run build 2>&1 | grep error
   ```

4. **Check browser console for errors?**
   - F12 → Console tab
   - Look for red error messages

---

**Verification Last Updated**: August 2026  
**Status**: ✅ All fixes applied and tested
