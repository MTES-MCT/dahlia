import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

// S3-compatible object storage (Outscale). Configuration comes from the
// environment:
//   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_PREFIX (optional),
//   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
// The client is stored on globalThis so it survives HMR in dev.
const globalForS3 = globalThis as unknown as { s3Client: S3Client | undefined };

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
  );
}

function getS3Client(): S3Client {
  if (globalForS3.s3Client) {
    return globalForS3.s3Client;
  }
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    // Outscale (like most non-AWS providers) expects path-style URLs.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  globalForS3.s3Client = client;
  return client;
}

// Build the full object key, prepending S3_PREFIX (without duplicate slashes).
export function s3ObjectKey(key: string): string {
  const prefix = (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
  const relativeKey = key.replace(/^\/+/, "");
  return prefix ? `${prefix}/${relativeKey}` : relativeKey;
}

// Read an object from the configured bucket. `key` is relative to S3_PREFIX.
export async function readS3Object(key: string): Promise<Buffer> {
  const fullKey = s3ObjectKey(key);
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: fullKey }),
  );
  if (!response.Body) {
    throw new Error(`Empty S3 object body for key "${fullKey}"`);
  }
  return Buffer.from(await response.Body.transformToByteArray());
}
