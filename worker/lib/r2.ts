/**
 * R2 Presigned URL Library
 *
 * Generates S3-compatible presigned URLs for direct client uploads to R2.
 * Bypasses the Worker 128MB memory limit for large video files.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Create an S3-compatible client for Cloudflare R2
 */
export function createR2Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Generate a presigned PUT URL for uploading a file to R2
 *
 * @param client - S3 client configured for R2
 * @param bucket - R2 bucket name
 * @param key - Object key path (e.g. "clips/{clipId}/video.mp4")
 * @param contentType - MIME type for the upload
 * @param expiresIn - URL validity in seconds (default 1 hour)
 */
export async function generatePresignedPutUrl(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate a presigned GET URL for downloading a file from R2
 *
 * @param client - S3 client configured for R2
 * @param bucket - R2 bucket name
 * @param key - Object key path
 * @param expiresIn - URL validity in seconds (default 1 hour)
 */
export async function generatePresignedGetUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}
