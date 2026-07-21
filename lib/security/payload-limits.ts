/** Shared payload size guards for project write APIs. */

export const MAX_BUSINESS_NAME = 100
export const MAX_BUSINESS_DESCRIPTION = 2000
export const MAX_SUBDOMAIN = 63
export const MAX_STYLE = 200
export const MAX_PROFILE_IMAGE = 3_500_000
export const MAX_PAGE_CONTENT_BYTES = 1_500_000 // ~1.5MB per file
export const MAX_PAGES_PER_PROJECT = 500
export const MAX_CHAT_MESSAGES = 200
export const MAX_CHAT_MESSAGE_CHARS = 100_000
export const MAX_CHAT_PAYLOAD_CHARS = 2_000_000
export const MAX_ENV_KEY_LEN = 128
export const MAX_ENV_VALUE_LEN = 8_000
export const MAX_ENV_VARS = 100

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8")
}

export function estimateJsonSize(value: unknown): number {
  try {
    return utf8ByteLength(JSON.stringify(value))
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}
