// File storage (spec §5.5, D42). One implementation over the S3 API: SeaweedFS locally, Cloudflare
// R2 in production. Server code talks to `endpoint`; browsers get links signed for
// `publicEndpoint`, because a pre-signed link is only valid for the host it was signed for.
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageObject {
  bucket: string;
  key: string;
}

export interface Storage {
  put(object: StorageObject & { body: Uint8Array | string; contentType: string }): Promise<void>;
  /** The object's bytes, or `null` when it doesn't exist. */
  get(object: StorageObject): Promise<Uint8Array | null>;
  /** A link a browser can upload to with PUT, valid for `expiresIn` seconds. */
  signUpload(object: StorageObject & { contentType: string; expiresIn: number }): Promise<string>;
  /** A link a browser can read from with GET, valid for `expiresIn` seconds. */
  signDownload(object: StorageObject & { expiresIn: number }): Promise<string>;
}

export interface S3StorageOptions {
  /** Where server code reaches the storage API (`S3_ENDPOINT`). */
  endpoint: string;
  /** Where browsers reach it (`S3_PUBLIC_ENDPOINT`). */
  publicEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function client(options: S3StorageOptions, endpoint: string): S3Client {
  const config: S3ClientConfig = {
    endpoint,
    region: options.region,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    // Bucket in the path, not the host name: one certificate covers every bucket locally.
    forcePathStyle: true,
    // Without this, pre-signed PUT links carry a checksum of an empty body and uploads fail.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  };
  return new S3Client(config);
}

export function createS3Storage(options: S3StorageOptions): Storage {
  const server = client(options, options.endpoint);
  const signer = client(options, options.publicEndpoint);
  return {
    async put({ bucket, key, body, contentType }) {
      await server.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get({ bucket, key }) {
      try {
        const response = await server.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return response.Body ? await response.Body.transformToByteArray() : null;
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    signUpload({ bucket, key, contentType, expiresIn }) {
      return getSignedUrl(
        signer,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn },
      );
    },
    signDownload({ bucket, key, expiresIn }) {
      return getSignedUrl(signer, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn,
      });
    },
  };
}
