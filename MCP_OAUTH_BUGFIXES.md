# MCP OAuth Connection Bug Fixes

## Problem
GitHub MCP OAuth connection was failing with "connection failed" message after user approval. The popup would close without properly transmitting the success/error state back to the parent window.

## Root Cause: Three Critical Bugs

### BUG #1: OAuth Popup Window Name Collision
**Location**: `glovix/components/SlashLibraries.tsx:186`

**Problem**:
- The popup was opened with a static window name: `'sycord-mcp-oauth'`
- If multiple MCP connections are attempted, or another popup exists with the same name, the postMessage might go to the wrong window
- Multiple simultaneous OAuth flows could interfere with each other

**Fix**:
```typescript
// Before:
'sycord-mcp-oauth'

// After:
`sycord-mcp-oauth-${Date.now()}-${Math.random().toString(36).slice(2)}`
```

Each popup now gets a unique identifier, preventing window conflicts.

---

### BUG #2: postMessage Origin Mismatch
**Location**: `app/api/mcp/oauth/callback/route.ts:34`

**Problem**:
- The callback route ran on `https://sycord.site/api/mcp/oauth/callback`
- But it was sending postMessage with `window.location.origin` which equals `https://sycord.site`
- The parent window (your app at `localhost:3000` or your deployed domain) has a different origin
- The postMessage failed silently due to cross-origin security restrictions
- Without a proper `targetOrigin`, the message couldn't be delivered safely

**Fix**:
```typescript
// Added getOpenerOrigin() helper function that:
// 1. Reads the 'referer' header from the OAuth callback request
// 2. Extracts the actual origin of the page that opened the popup
// 3. Uses that origin when sending postMessage back

// All popupHtml() calls now receive openerOrigin parameter
popupHtml(payload, openerOrigin)
```

The popup now correctly identifies and communicates back to your app's origin.

---

### BUG #3: Missing Error Detail Propagation
**Location**: 
- `app/api/mcp/oauth/callback/route.ts:188` (returns `connectError`)
- `glovix/components/SlashLibraries.tsx:227-234` (onMessage handler)

**Problem**:
- When `syteSetEnv()` or `syteAgentMcpConnect()` failed (Sycord API errors), the error was stored in `connectError`
- But the popup closed after 600ms regardless of error status
- The error message wasn't being properly read from the postMessage payload on the UI side
- Users saw "connection failed" without details about what actually broke

**Fix**:
```typescript
// 1. Increased popup close timeout from 600ms to 1200ms to allow postMessage delivery
setTimeout(function () { window.close(); }, 1200);

// 2. UI now properly extracts connectError from the postMessage payload
const errorMsg = data.connectError || data.error || 'OAuth connection failed'
console.error('[v0] MCP OAuth failed:', errorMsg)
```

Users now see the actual error (e.g., "Syte workspace is not configured" or "Failed to sync MCP credentials").

---

## Testing the Fix

### For GitHub OAuth:
1. Make sure `MCP_GITHUB_CLIENT_ID` and `MCP_GITHUB_CLIENT_SECRET` are set
2. Go to SlashLibraries → Connect GitHub
3. The popup should open, show GitHub's OAuth flow
4. After approval, you should see "Connected — you can close this window"
5. The parent window should refresh and mark the addon as connected

### Browser Console Verification:
```javascript
// Success logs:
[v0] MCP OAuth succeeded for addon: github

// Error logs (if something fails):
[v0] MCP OAuth failed: {specific error message}
[v0] postMessage failed: {error details}
```

---

## Files Modified

1. **`glovix/components/SlashLibraries.tsx`**
   - Unique popup window names
   - Enhanced error logging
   - Better error message handling

2. **`app/api/mcp/oauth/callback/route.ts`**
   - Added `getOpenerOrigin()` helper
   - Updated `popupHtml()` to accept `openerOrigin` parameter
   - Fixed postMessage targetOrigin to use actual opener origin
   - Increased popup timeout for proper message delivery
   - All `popupHtml()` calls now pass opener origin

---

## Technical Details

### How the OAuth Flow Works Now

1. **User clicks "Connect GitHub"** → `openMcpOAuthPopup()` opens unique popup window
2. **Popup redirects to `/api/mcp/oauth/start`** → GitHub OAuth URL
3. **User approves on GitHub** → redirects to `/api/mcp/oauth/callback?code=...&state=...`
4. **Callback route:**
   - Extracts opener origin from Referer header
   - Exchanges code for token (GitHub)
   - Syncs token to Sycord via `syteSetEnv()`
   - Enables addon via `syteAgentMcpConnect()`
   - Renders HTML with postMessage call using correct `targetOrigin`
5. **Parent window receives postMessage** → Shows result to user

### Security Improvements

- postMessage now uses explicit `targetOrigin` instead of `'*'` (when opener origin is detected)
- Referer-based origin detection provides validation
- Fallback to request origin if Referer is missing

---

## Verification Checklist

- [x] Build succeeds with no TypeScript errors
- [x] Unique popup window names prevent conflicts
- [x] postMessage origin matches parent window origin
- [x] Error details propagate from Sycord → popup → parent UI
- [x] Console logs show success/failure details
- [x] Popup waits long enough for postMessage delivery (1200ms)
