import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { uploadMode } from "@/lib/blob-config";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/*",
  "application/pdf",
  "text/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/rtf",
  "application/json",
];

export async function POST(request: Request) {
  const mode = uploadMode();
  if (!mode) return NextResponse.json({ error: "File uploads aren’t configured. Connect a Vercel Blob store." }, { status: 503 });

  try {
    if (mode === "token") {
      const body = (await request.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({ allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true }),
      });
      return NextResponse.json(json);
    }

    const body = (await request.json()) as HandleUploadPresignedBody;
    const json = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => ({
        token: await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
        }),
        urlOptions: { allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true },
      }),
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
