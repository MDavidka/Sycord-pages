export function getVercelProjectCreationUrl(teamId: string | undefined | null) {
  const baseUrl = "https://api.vercel.com/v11/projects";
  if (teamId) {
    return `${baseUrl}?teamId=${teamId}`;
  }
  return baseUrl;
}

export function getVercelDeploymentUrl(teamId: string | undefined | null) {
  const baseUrl = "https://api.vercel.com/v13/deployments";
  if (teamId) {
    return `${baseUrl}?teamId=${teamId}`;
  }
  return baseUrl;
}
