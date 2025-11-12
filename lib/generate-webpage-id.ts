export function generateWebpageId(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString()
}
