// Buckets and their CORS rules, as code (spec §5.5, D42). `pnpm stack` applies them to SeaweedFS;
// the R2 setup in phase 4 applies the same rules with the production app origin.
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
  S3ServiceException,
  type CORSRule,
} from '@aws-sdk/client-s3';

export interface StorageConfig {
  /** Where server code reaches the storage API. */
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  privateBucket: string;
  publicBucket: string;
  /** The web app's origin: the only origin allowed to upload from the browser. */
  appOrigin: string;
}

/** Reads the storage settings from the environment (`.env`, falling back to `.env.example`). */
export function storageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const read = (name: string): string => {
    const value = env[name];
    if (value === undefined || value === '') throw new Error(`${name} is not set`);
    return value;
  };
  return {
    endpoint: read('S3_ENDPOINT'),
    region: read('S3_REGION'),
    accessKeyId: read('S3_ACCESS_KEY_ID'),
    secretAccessKey: read('S3_SECRET_ACCESS_KEY'),
    privateBucket: read('S3_BUCKET_PRIVATE'),
    publicBucket: read('S3_BUCKET_PUBLIC'),
    appOrigin: new URL(read('APP_URL')).origin,
  };
}

/**
 * The CORS rules on both buckets. Browsers upload with a pre-signed PUT and may read with a
 * signed GET, only from the app's origin. Everything else goes through the app's servers.
 */
export function corsRules(appOrigin: string): CORSRule[] {
  return [
    {
      ID: 'app',
      AllowedOrigins: [appOrigin],
      AllowedMethods: ['GET', 'HEAD', 'PUT'],
      AllowedHeaders: ['content-type'],
      ExposeHeaders: ['etag'],
      MaxAgeSeconds: 3600,
    },
  ];
}

export function s3Client(config: StorageConfig, endpoint = config.endpoint): S3Client {
  return new S3Client({
    endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Bucket in the path, not the host name: one certificate covers every bucket locally.
    forcePathStyle: true,
    // Without this, pre-signed PUT links carry a checksum of an empty body and uploads fail.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
}

/** Creates the private and public buckets if they don't exist, and sets their CORS rules. */
export async function applyBuckets(config: StorageConfig): Promise<void> {
  const client = s3Client(config);
  try {
    for (const bucket of [config.privateBucket, config.publicBucket]) {
      if (!(await bucketExists(client, bucket))) {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      }
      await client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: { CORSRules: corsRules(config.appOrigin) },
        }),
      );
    }
  } finally {
    client.destroy();
  }
}

async function bucketExists(client: S3Client, bucket: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return false;
    throw error;
  }
}
