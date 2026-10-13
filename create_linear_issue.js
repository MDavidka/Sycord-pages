async function main() {
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
    title: "[AUDIT] Full codebase health & security sweep — sycord-pages @ 9d7a726",
    description: "Goal: Conduct a full codebase health and security sweep.\nScope: All backend, frontend, API, agent endpoints, and infra code.\nCommit SHA: 9d7a726\nDate: " + new Date().toISOString().split('T')[0],
    teamId: "fe706808-4bfa-4d20-a88e-0e84f625b5d0",
    projectId: "376fef73-50ad-4b82-ad7b-5c545ccdfd90",
    labelIds: ["33634a34-b697-49f7-8e00-02982295dd55"] // "audit"
  };

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.LINEAR_API_KEY
    },
    body: JSON.stringify({ query, variables: { input } })
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
