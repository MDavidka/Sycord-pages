# Visual Error Screens Guide

## What Users Will See Now

### Screen 1: OAuth Popup (Success)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                         ┃
┃           ✓ Connected Successfully      ┃
┃                                         ┃
┃  MCP OAuth tokens were received and     ┃
┃  synced to Sycord.                      ┃
┃                                         ┃
┃  Details:                               ┃
┃  Addon: github                          ┃
┃  Project: proj-abc123                   ┃
┃  Timestamp: 2025-08-01T12:45:00Z        ┃
┃                                         ┃
┃  Window closing in 1 seconds...         ┃
┃                                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Styling:**
- Green background (#1a3a1a)
- Green border (#2d5a2d)
- Green checkmark ✓
- Green message text (#9cff9c)

---

### Screen 2: OAuth Popup (Error)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                         ┃
┃           ✕ Connection Failed           ┃
┃                                         ┃
┃  MCP OAuth connection encountered an    ┃
┃  error:                                 ┃
┃                                         ┃
┃  ╔═════════════════════════════════╗   ┃
┃  ║ Error: Syte workspace is not    ║   ┃
┃  ║ configured. Check               ║   ┃
┃  ║ SYTE_WORKSPACE_ID or            ║   ┃
┃  ║ DEPLOYER_API_KEY.               ║   ┃
┃  ╚═════════════════════════════════╝   ┃
┃                                         ┃
┃  Details:                               ┃
┃  Addon: github                          ┃
┃  Project: proj-abc123                   ┃
┃  Timestamp: 2025-08-01T12:45:00Z        ┃
┃                                         ┃
┃  Window closing in 2 seconds...         ┃
┃                                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Styling:**
- Red/dark background (#3a1a1a)
- Red border (#5a2d2d)
- Red X button ✕
- Red error box (#1a1a1a with red text)
- Error details in monospace font

---

### Screen 3: MCP Library UI (No Error)

```
┌────────────────────────────────────────┐
│ ← MCP library                      ⟳   │
│   Connect with real OAuth or API keys   │
├────────────────────────────────────────┤
│                                        │
│  [GitHub] GitHub                   ⟲  │
│  GitHub integration for AI SDK     OAuth│
│  Connect with OAuth                    │
│                                        │
│  [Linear] Linear                       │
│  Issue tracking for development    OAuth│
│  Connect with OAuth                    │
│                                        │
│  [Slack]  Slack                        │
│  Team communication platform       OAuth│
│  Connect with OAuth                    │
│                                        │
│  [Syte]   Syte Web Search              │
│  Search the web                        │
│  Enable Syte web search                │
│                                        │
└────────────────────────────────────────┘
```

**No errors shown** — Clean UI

---

### Screen 4: MCP Library UI (With Error)

```
┌────────────────────────────────────────┐
│ ← MCP library                      ⟳   │
│   Connect with real OAuth or API keys   │
├────────────────────────────────────────┤
│                                        │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃ MCP Connection Error            ┃  │
│  ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫  │
│  ┃ Failed to sync to Sycord:       ┃  │
│  ┃ 503 Service Unavailable         ┃  │
│  ┃                                 ┃  │
│  ┃ ▼ Debug Info                    ┃  │
│  ┃   Check browser console for     ┃  │
│  ┃   detailed logs                 ┃  │
│  ┃   Press F12 → Console to see    ┃  │
│  ┃   request ID and error details  ┃  │
│  ┃                                 ┃  │
│  ┃ [Dismiss]                       ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                        │
│  [GitHub] GitHub                       │
│  GitHub integration for AI SDK         │
│  Connect with OAuth                    │
│                                        │
│  [Linear] Linear (disabled)            │
│  Issue tracking for development        │
│  Connect with OAuth                    │
│                                        │
└────────────────────────────────────────┘
```

**Styling:**
- Red border box (#5a2d2d)
- Red/dark background (#3a1a1a)
- Red header text
- Expandable debug info
- Dismiss button

---

### Screen 5: DevTools Console (Full Flow - Success)

```
> [MCP-OAuth-abc1234] Callback initiated from origin: http://localhost:3000
> [MCP-OAuth-abc1234] Session user: user-123, has code: true, has state: true
> [MCP-OAuth-abc1234] Exchanging OAuth code for tokens...
> [MCP-OAuth-abc1234] Token exchange successful, tokens: access_token, refresh_token
> [MCP-OAuth-abc1234] Starting Sycord sync... useSyteWorkspace=true
> [MCP-OAuth-abc1234] Getting workspace UUID for project: proj-abc123
> [MCP-OAuth-abc1234] Got workspace UUID: workspace-uuid-456
> [MCP-OAuth-abc1234] Syncing environment variables to Sycord...
> [MCP-OAuth-abc1234] Env synced successfully. Enabling MCP addon: github
> [MCP-OAuth-abc1234] MCP addon connected successfully!
> [MCP-OAuth-abc1234] Final result - ok=true, error=none
```

---

### Screen 6: DevTools Console (Full Flow - Error at Token Exchange)

```
> [MCP-OAuth-def5678] Callback initiated from origin: http://localhost:3000
> [MCP-OAuth-def5678] Session user: user-123, has code: true, has state: true
> [MCP-OAuth-def5678] Exchanging OAuth code for tokens...
✕ [MCP-OAuth-def5678] Token exchange failed: invalid_client
✕ [MCP-OAuth-def5678] Error: Token exchange failed: invalid_client
```

**In RED** — Error message, easy to spot

---

### Screen 7: DevTools Console (Full Flow - Error at Sycord Sync)

```
> [MCP-OAuth-ghi9012] Callback initiated from origin: http://localhost:3000
> [MCP-OAuth-ghi9012] Session user: user-123, has code: true, has state: true
> [MCP-OAuth-ghi9012] Exchanging OAuth code for tokens...
> [MCP-OAuth-ghi9012] Token exchange successful, tokens: access_token, refresh_token
> [MCP-OAuth-ghi9012] Starting Sycord sync... useSyteWorkspace=true
> [MCP-OAuth-ghi9012] Getting workspace UUID for project: proj-abc123
> [MCP-OAuth-ghi9012] Got workspace UUID: workspace-uuid-456
> [MCP-OAuth-ghi9012] Syncing environment variables to Sycord...
✕ [MCP-OAuth-ghi9012] Failed to sync to Sycord: 503 Service Unavailable
```

---

### Screen 8: DevTools Console (Missing Environment Variables)

```
> [MCP-OAuth-jkl3456] Callback initiated from origin: http://localhost:3000
> [MCP-OAuth-jkl3456] Session user: user-123, has code: true, has state: true
> [MCP-OAuth-jkl3456] Exchanging OAuth code for tokens...
> [MCP-OAuth-jkl3456] Token exchange successful, tokens: access_token, refresh_token
> [MCP-OAuth-jkl3456] Starting Sycord sync... useSyteWorkspace=false
✕ [MCP-OAuth-jkl3456] Syte workspace is not configured. Check SYTE_WORKSPACE_ID or DEPLOYER_API_KEY.
```

**Key clue:** `useSyteWorkspace=false` — environment variable not set

---

### Screen 9: UI Message Handler Debugging

```
console.log('[v0] Received postMessage:', event.data)
// Output:
{
  type: "sycord-mcp-oauth",
  ok: false,
  addon: "github",
  error: "Token exchange failed: invalid_client",
  connectError: undefined,
  projectId: "proj-abc123"
}

console.error('[v0] MCP OAuth failed:', {
  error: "Token exchange failed: invalid_client",
  addon: "github",
  connectError: undefined,
  rawError: "Token exchange failed: invalid_client"
})
```

---

## Step-by-Step: What Users See

### When Everything Works:

1. Click "Connect GitHub"
2. GitHub OAuth popup appears
3. User clicks "Allow"
4. Popup shows **✓ Connected Successfully**
5. DevTools shows: `MCP addon connected successfully!`
6. UI closes popup automatically
7. GitHub addon shows as **Connected** ✓

---

### When OAuth Provider Denies:

1. Click "Connect GitHub"
2. GitHub OAuth popup appears
3. User clicks **Deny**
4. Popup shows **✕ Connection Failed**
5. Error box shows: `OAuth provider error: access_denied`
6. DevTools shows: `OAuth provider error: access_denied - user denied access`
7. Popup closes
8. Red error alert appears in UI

---

### When Credentials Are Wrong:

1. Click "Connect GitHub"
2. GitHub OAuth popup appears
3. User clicks "Allow"
4. Popup shows **✕ Connection Failed**
5. Error box shows: `Token exchange failed: invalid_client`
6. DevTools shows: `Token exchange failed: invalid_client`
7. Red error alert in UI: "Token exchange failed: invalid_client"
8. UI suggests: Check MCP_GITHUB_CLIENT_ID/SECRET env vars

---

### When Sycord Connection Issues:

1. Click "Connect GitHub"
2. GitHub OAuth succeeds
3. Popup shows **✕ Connection Failed**
4. Error box shows: `Failed to sync to Sycord: 503 Service Unavailable`
5. DevTools shows multiple log lines leading to error
6. Request ID visible in all logs (e.g., `[MCP-OAuth-abc1234]`)
7. Red error alert in UI

---

## Error States Visual Comparison

### State 1: Loading
```
🔄 Connecting GitHub...
(spinner rotating)
```

### State 2: Success
```
✓ Connected (Green)
Connected — tap to disconnect
```

### State 3: Error
```
❌ Error
(Red error box appears in UI)
```

### State 4: Retry
```
(Click addon again)
→ Retry connection
```

---

## Color Scheme

| State | Background | Border | Text | Icon |
|-------|-----------|--------|------|------|
| Success | #1a3a1a | #2d5a2d | #9cff9c | ✓ (Green) |
| Error | #3a1a1a | #5a2d2d | #ff9c9c | ✕ (Red) |
| Error Details | #1a1a1a | #333 | #aaa | — |
| UI Dark Theme | #18191B | #2a2b2e | #e0e0e0 | — |

---

## Key UI Elements

### Error Box
- Appears in UI when any error occurs
- Shows full error message
- Has expandable "Debug Info"
- Has "Dismiss" button to clear

### Popup Window
- Now shows detailed error information
- Has countdown timer
- Shows success/error status
- Has debug info (addon, project, timestamp)

### Console Output
- Each line prefixed with `[MCP-OAuth-XXXXXX]`
- Request ID makes tracing easy
- Color-coded (green for info, red for errors)
- Shows exact step-by-step flow

---

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Header | System | 16px | 500 |
| Message | System | 14px | 400 |
| Error Details | Monospace | 12px | 400 |
| Debug Info | Monospace | 12px | 400 |
| Closing Text | System | 12px | 400 |

---

## Accessibility

- ✓ High contrast ratios
- ✓ Clear semantic structure
- ✓ Readable error messages
- ✓ Keyboard navigable
- ✓ Screen reader friendly

---

## Mobile View

Same error screens adapt to mobile:
- Popup: Full width - 20px margins
- UI Alert: Full width - 20px margins
- Console: Same on mobile DevTools
- All text remains readable

---

End of Visual Guide
