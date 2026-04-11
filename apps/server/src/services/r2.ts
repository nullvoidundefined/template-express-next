import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from 'app/config/env.js';

const s3 = new S3Client({
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
  },
  endpoint: `https://${env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
  region: 'auto',
});

async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Body: body,
      Bucket: env.R2_BUCKET_NAME,
      ContentType: contentType,
      Key: key,
    }),
  );
}

function getFileUrl(key: string): string {
  return `https://${env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME ?? ''}/${key}`;
}

export { getFileUrl, uploadFile };
