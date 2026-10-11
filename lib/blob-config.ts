export type UploadMode = "token" | "presigned";

/**
 * Older Blob stores expose a read-write token; newer ones authenticate with Vercel OIDC
 * and expose only BLOB_STORE_ID + BLOB_WEBHOOK_PUBLIC_KEY, which requires presigned uploads.
 */
export function uploadMode(): UploadMode | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  if (process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY) return "presigned";
  return null;
}
