async function createIssue(title, description, severity, type, area) {
  const query = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          title
          url
        }
      }
    }
  `;

  const input = {
    title,
    description,
    teamId: "fe706808-4bfa-4d20-a88e-0e84f625b5d0",
    projectId: "376fef73-50ad-4b82-ad7b-5c545ccdfd90",
    parentId: "0a024fbb-7eed-486d-b034-cec2e9a563b9", // The parent audit issue
    // Adding correct label ids based on the mapping above
    // Assuming you have an object like this from your query_linear_labels.js
  };

  // Label Mapping
  const labelsMap = {
    'audit': '33634a34-b697-49f7-8e00-02982295dd55',
    'P0': '3eb7b1fd-add6-4655-8f05-a4518b2e012e',
    'P1': 'a0de1d18-43b0-46a1-854a-81a26c6d2761',
    'P2': 'ef59e5a6-6a54-4fdb-870f-d3112593cc4e',
    'P3': '93f2b00c-0e9b-476f-956d-9477542f2606',
    'bug': 'abdef8e0-c3d8-4529-bff1-39cfaa19f0ba',
    'security': '60deda7d-9f98-493f-9590-bd116cbf09fd',
    'performance': '87e115dc-4a2c-4fc1-a85e-28cce9545ed6',
    'styling': '15097204-0a13-4de0-a366-0e681d621e90',
    'code-health': 'b2c53b91-d030-47b5-bedc-ae2b7aaf2680',
    'crash': '0fa7d467-22b6-44a9-9af7-ffbd81d964db',
    'optimization': '3aa202d7-4cef-4fed-ac16-250fd125defe',
    'auth': '23d3d889-8aa3-4be8-843e-7ce5b9f3ad65',
    'agent': 'a33c063c-a867-42cf-85fc-e010b3c6b6c4',
    'api': 'a2eb4996-5ab0-4a1c-bd9b-14859e6423a0',
    'ui': 'bd25d0a8-c851-4548-a991-9d251ea9e09c',
    'infra': 'a80c9ce8-516f-4576-8199-2b28a33265d5',
    'db': '100576ea-f99f-4c5a-bcce-c8d9e368e522'
  };

  input.labelIds = [labelsMap['audit']];
  if (labelsMap[severity]) input.labelIds.push(labelsMap[severity]);
  if (labelsMap[type]) input.labelIds.push(labelsMap[type]);
  if (labelsMap[area]) input.labelIds.push(labelsMap[area]);

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.LINEAR_API_KEY
    },
    body: JSON.stringify({ query, variables: { input } })
  });

  const data = await response.json();
  console.log(`Created: ${title}`, data?.data?.issueCreate?.issue?.url || data);
  return data?.data?.issueCreate?.issue;
}

async function addCommentToParent(content) {
  const query = `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
      }
    }
  `;
  const input = {
    issueId: "0a024fbb-7eed-486d-b034-cec2e9a563b9", // The parent audit issue
    body: content
  };
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.LINEAR_API_KEY
    },
    body: JSON.stringify({ query, variables: { input } })
  });
}

async function main() {
  const issues = [];

  // Create an array of promises for the issues to create
  issues.push(await createIssue(
    "[P0][security] Hardcoded mock secret and potentially exposed setup endpoint",
    "### Summary\nHardcoded fallback secrets and unverified VPS runner credentials present in `app/api/admin/vps-runner/setup/stream/route.ts`.\n\n### Severity\nP0 Critical\nImpact: confidentiality, system compromise\n\n### Evidence\n- File: `app/api/admin/vps-runner/setup/stream/route.ts`\n- Snippet:\n```typescript\nconst password = sshInput?.password || process.env.VPS_SSH_ROOT_PASSWORD || process.env.VPS_ROOT_PSW\n```\n- Why this is wrong: Potentially allows administrative access to user VMs if the endpoint is not properly protected, or allows attackers to execute commands if they can supply the credentials.\n\n### Reproduction\nExamine the VPS setup API. If an attacker can access the API, they can specify arbitrary host/password or rely on fallbacks to execute commands via SSH.\n\n### Recommended fix\nEnsure strict `isAdmin()` checks on this endpoint, never fall back to global environment variables for user-specific VPS passwords, and ensure credentials are not logged. Ensure the setup endpoints are only accessible by authorized admins.\n\n### Test plan\nTry accessing the endpoint without admin credentials; it should fail. Ensure no root passwords are hardcoded in the source or fallbacks.",
    "P0", "security", "infra"
  ));

  issues.push(await createIssue(
    "[P1][security] Missing user ID filter in deleteMany for user deletion",
    "### Summary\nThe user deletion endpoint deletes projects and deployments but fails to filter correctly by user ID, potentially wiping all projects.\n\n### Severity\nP1 High\nImpact: availability, data loss\n\n### Evidence\n- File: `app/api/admin/users/[userId]/delete/route.ts`\n- Snippet:\n```typescript\nawait db.collection(\"projects\").deleteMany({ userId });\n```\n- Why this is wrong: The schema likely stores user relationships differently (e.g. within an array or under `ownerUserId`). A faulty `deleteMany({ userId })` might delete nothing or fail, but if `userId` isn't mapped properly, it causes issues.\n\n### Reproduction\nTrigger user deletion and observe if projects actually get deleted, or if the filter fails to match.\n\n### Recommended fix\nCheck the schema for `projects` and `deployments`. If they are stored inside the `users` collection, this `deleteMany` is wrong. If they are separate, ensure the field name is correct (e.g. `ownerUserId`).\n\n### Test plan\nCreate a user with projects. Delete the user and verify only their projects are deleted.",
    "P1", "security", "db"
  ));

  issues.push(await createIssue(
    "[P2][security] Hardcoded OAuth secrets in mcp-oauth.ts and integrations.ts",
    "### Summary\nHardcoded placeholder secrets are present in source code which could lead to confusion or insecure defaults.\n\n### Severity\nP2 Medium\nImpact: confidentiality\n\n### Evidence\n- File: `lib/integrations.ts`\n- Snippet:\n```typescript\nNEXTAUTH_SECRET: \"generate-a-long-random-secret\"\nPAYPAL_CLIENT_SECRET: \"paypal-client-secret\"\n```\n- Why this is wrong: These are likely default templates, but if deployed as-is, they use weak, known secrets.\n\n### Reproduction\nInspect `lib/integrations.ts`.\n\n### Recommended fix\nEnsure these are strictly placeholders and that the application fails to start or warns loudly if they are used in production.\n\n### Test plan\nVerify the system doesn't accept these defaults in a production environment.",
    "P2", "security", "auth"
  ));

  issues.push(await createIssue(
    "[P1][security] Potential XSS in chart and Mermaid components",
    "### Summary\n`dangerouslySetInnerHTML` is used in chart and Mermaid components without apparent sanitization.\n\n### Severity\nP1 High\nImpact: integrity, confidentiality (XSS)\n\n### Evidence\n- File: `components/ui/chart.tsx` and `glovix/components/MermaidBlock.tsx`\n- Snippet:\n```typescript\ndangerouslySetInnerHTML={{ __html: svg }}\n```\n- Why this is wrong: If `svg` or chart data is derived from user input or AI generation without `isomorphic-dompurify`, it allows XSS.\n\n### Reproduction\nProvide a malicious SVG payload containing a `<script>` tag to the Mermaid block or Chart component.\n\n### Recommended fix\nEnsure `sanitize-svg.ts` (DOMPurify) is used before setting the inner HTML.\n\n### Test plan\nAttempt to render `<svg><script>alert(1)</script></svg>` and verify it's neutralized.",
    "P1", "security", "ui"
  ));

  issues.push(await createIssue(
    "[P1][security] SSRF via overly permissive fetch calls",
    "### Summary\nMultiple endpoints make `fetch` calls to URLs constructed from user input or untrusted sources.\n\n### Severity\nP1 High\nImpact: confidentiality, system compromise\n\n### Evidence\n- File: `app/api/workspace/sycord/agent-activity/route.ts` and others\n- Snippet:\n```typescript\nconst upstream = await fetch(upstreamUrl.toString(), { ... })\n```\n- Why this is wrong: An attacker could potentially supply a malicious `upstreamUrl` to access internal services or loopback interfaces.\n\n### Reproduction\nAttempt to pass an internal IP or localhost as the upstream URL or webhook URL and observe if the server fetches it.\n\n### Recommended fix\nImplement an allowlist of domains or strict validation against internal IP addresses before calling `fetch` on user-supplied URLs.\n\n### Test plan\nProvide a webhook URL pointing to `127.0.0.1` and ensure it's rejected.",
    "P1", "security", "api"
  ));

  issues.push(await createIssue(
    "[P0][security] Missing Ownership checks in multiple API routes",
    "### Summary\nSeveral API routes use `updateOne` or `findOne` without validating that the user performing the action actually owns the resource.\n\n### Severity\nP0 Critical\nImpact: integrity, confidentiality\n\n### Evidence\n- File: `app/api/business-report/route.ts`, `app/api/user/credits/route.ts`\n- Snippet:\n```typescript\nawait db.collection(COLLECTION).updateOne(...)\n```\n- Why this is wrong: If the filter only checks `id` or another parameter provided by the user, an attacker can modify resources they do not own by simply changing the ID in the request.\n\n### Reproduction\nFind an ID of a resource you don't own and try to update it using the API.\n\n### Recommended fix\nAlways include `userId: session.user.id` or use the `ownedProjectMutationFilter` in the database query filter.\n\n### Test plan\nAttempt to modify a project owned by another user and verify it returns 403 or 404.",
    "P0", "security", "api"
  ));

  const parentComment = `
### System Map
* **Entry points:** Web routes in \`app/\`, API routes in \`app/api/\`. Contains Admin routes, Webhooks, AI endpoints.
* **Architecture:** Next.js App Router. Uses a custom DB adapter (\`Torso\`) wrapping SQLite. Integrates with various deployment platforms (Coolify, Dokploy, custom VPS runner).
* **Data Stores:** Turso (SQLite) mapped to a MongoDB-like API.
* **Auth:** NextAuth.
* **Frontend:** React, Tailwind CSS, shadcn/ui.
* **Agent:** Uses WebContainers (\`glovix/lib/webcontainer.ts\`) for local execution and a custom VPS runner for remote deployment.

### Top Risks Found
1. **[P0] Missing Ownership Checks:** Several API routes lack \`userId\` verification when updating records (IDOR).
2. **[P0] VPS Runner Setup Endpoint:** Potentially exposes hardcoded root passwords or allows arbitrary SSH access if not properly secured with \`isAdmin()\`.
3. **[P1] SSRF via Unrestricted Fetch:** Multiple endpoints fetch URLs provided by users (e.g., webhook configurations, upstream proxies) without verifying they aren't internal IPs.
4. **[P1] Potential XSS in UI Components:** \`dangerouslySetInnerHTML\` used in \`MermaidBlock\` and \`Chart\` components without verified sanitization.
5. **[P1] User Deletion Logic Flaw:** \`deleteMany\` for projects may use incorrect field mappings, failing to delete or deleting incorrectly.
6. **[P2] Hardcoded Secrets:** Placeholder secrets in \`lib/integrations.ts\` could be dangerous if deployed.

### Executive Summary
The codebase is a complex multi-tenant AI website builder. The most critical issues revolve around missing ownership checks (IDOR) on multiple API endpoints, which could allow users to modify each other's data. There are also potential SSRF vulnerabilities and XSS risks in some UI components. The custom VPS runner setup has hardcoded fallback passwords that pose a significant risk.

**Recommended Roadmap:**
* **Wave 0 (Same Day):** Fix IDOR vulnerabilities by enforcing \`userId\` checks on all mutations. Secure the VPS runner setup endpoint.
* **Wave 1:** Implement strict SSRF protections for all \`fetch\` calls using user-provided URLs.
* **Wave 2:** Ensure all \`dangerouslySetInnerHTML\` usages are wrapped in \`isomorphic-dompurify\`.
* **Wave 3:** Clean up placeholder secrets and fix user deletion logic.
`;

  await addCommentToParent(parentComment);
  console.log("Parent issue updated with findings.");
}

main().catch(console.error);
