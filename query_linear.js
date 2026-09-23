async function main() {
  const query = `
    query {
      projects {
        nodes {
          id
          name
        }
      }
      teams {
        nodes {
          id
          name
        }
      }
    }
  `;

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.LINEAR_API_KEY
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
