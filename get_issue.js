async function main() {
  const query = `
    query {
      issue(id: "0a024fbb-7eed-486d-b034-cec2e9a563b9") {
        id
        title
        url
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
