import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignUrl } from '@aws-sdk/s3-request-presigner';
import { env } from 'app/config/envConfig.js';

const s3 = new S3Client({
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
  },
  endpoint: `https://${env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
  region: 'auto',
});

const VALID_KEY_PATTERN = /^[a-zA-Z0-9\-_/.]+$/;

function assertValidKey(key: string): void {
  if (!VALID_KEY_PATTERN.test(key) || key.includes('..')) {
    throw new Error(`Invalid R2 key: ${key}`);
  }
}

async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  assertValidKey(key);
  await s3.send(
    new PutObjectCommand({
      Body: body,
      Bucket: env.R2_BUCKET_NAME,
      ContentType: contentType,
      Key: key,
    }),
  );
}

async function deleteFile(key: string): Promise<void> {
  assertValidKey(key);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

async function getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  assertValidKey(key);
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME ?? '',
    Key: key,
  });
  return presignUrl(s3, command, { expiresIn: ttlSeconds });
}

export { assertValidKey, deleteFile, getSignedUrl, uploadFile };
