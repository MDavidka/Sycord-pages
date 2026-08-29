export function isSafePath(path: string): boolean {
  if (!path) return false;
  const decoded = decodeURIComponent(path);
  if (decoded.startsWith("/")) return false;
  if (decoded.includes("../") || decoded.includes("..\\")) return false;
  if (decoded === ".." || decoded.startsWith("../") || decoded.endsWith("/..") || decoded.includes("/../")) return false;
  if (decoded.includes("\0")) return false;
  if (/^\.env(?:\.|$)/.test(decoded) || /\/\.env(?:\.|$)/.test(decoded)) return false;
  if (/[<>:"|?*]/.test(decoded)) return false;
  if (decoded.length > 255) return false;
  return true;
}
