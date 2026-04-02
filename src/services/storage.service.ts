import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { ValidationError } from '../utils/errors';

function getS3Client(): S3Client {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new ValidationError('Storage service is not configured');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadFile(
  buffer: Buffer,
  folder: string,
  originalName: string,
  contentType: string,
): Promise<string> {
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new ValidationError('Storage service is not configured');
  }

  const ext = originalName.split('.').pop() ?? 'bin';
  const key = `${folder}/${randomUUID()}.${ext}`;

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteFile(url: string): Promise<void> {
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new ValidationError('Storage service is not configured');
  }

  const key = url.replace(`${env.R2_PUBLIC_URL}/`, '');
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}
