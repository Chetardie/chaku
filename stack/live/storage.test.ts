// CHK-14: an S3 client can do a pre-signed PUT to the private bucket from the chaku.localhost
// origin, with the bucket CORS rules that R2 will get too (spec §5.5, D42).
import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv, readRootCertificate } from '../src/stack.ts';
import { corsRules, s3Client, storageConfig } from '../src/storage.ts';
import { request } from './https.ts';

loadEnv();
const config = storageConfig();
const publicEndpoint = process.env['S3_PUBLIC_ENDPOINT'] ?? '';
const appOrigin = config.appOrigin;
const otherOrigin = 'https://elsewhere.localhost';

/** Talks to SeaweedFS directly, as server code on the host does. */
let server: S3Client;
/** Signs links for the public host name that browsers use. */
let signer: S3Client;
let ca = '';
const created: { bucket: string; key: string }[] = [];

beforeAll(() => {
  server = s3Client(config);
  signer = s3Client(config, publicEndpoint);
  ca = readRootCertificate();
});

afterAll(async () => {
  for (const { bucket, key } of created) {
    await server.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  server.destroy();
  signer.destroy();
});

function newKey(bucket: string): string {
  const key = `stack-check/${randomUUID()}.txt`;
  created.push({ bucket, key });
  return key;
}

async function presignedPut(bucket: string, key: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'text/plain' });
  return getSignedUrl(signer, command, { expiresIn: 60 });
}

function preflight(url: string, origin: string) {
  return request(url, {
    method: 'OPTIONS',
    ca,
    headers: {
      origin,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'content-type',
    },
  });
}

describe('storage', () => {
  it.each([
    ['private', config.privateBucket],
    ['public', config.publicBucket],
  ])('applies the app CORS rules to the %s bucket', async (_, bucket) => {
    const cors = await server.send(new GetBucketCorsCommand({ Bucket: bucket }));
    expect(cors.CORSRules).toEqual(corsRules(appOrigin));
  });

  it('accepts a pre-signed PUT to the private bucket from the app origin', async () => {
    const key = newKey(config.privateBucket);
    const url = await presignedPut(config.privateBucket, key);
    expect(new URL(url).origin).toBe(publicEndpoint);

    const allowed = await preflight(url, appOrigin);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(appOrigin);
    expect(allowed.headers['access-control-allow-methods']).toMatch(/PUT/);
    expect(String(allowed.headers['access-control-allow-headers'])).toMatch(/content-type/i);

    const upload = await request(url, {
      method: 'PUT',
      ca,
      headers: { origin: appOrigin, 'content-type': 'text/plain' },
      body: 'hello from the stack check',
    });
    expect(upload.status).toBe(200);
    expect(upload.headers['access-control-allow-origin']).toBe(appOrigin);
    expect(String(upload.headers['access-control-expose-headers'])).toMatch(/etag/i);

    const stored = await server.send(
      new HeadObjectCommand({ Bucket: config.privateBucket, Key: key }),
    );
    expect(stored.ContentLength).toBe('hello from the stack check'.length);
    expect(stored.ContentType).toBe('text/plain');
  });

  it('refuses the preflight from any other origin', async () => {
    const url = await presignedPut(config.privateBucket, newKey(config.privateBucket));
    const refused = await preflight(url, otherOrigin);
    expect(refused.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses an upload without a signature', async () => {
    const key = newKey(config.privateBucket);
    const upload = await request(`${publicEndpoint}/${config.privateBucket}/${key}`, {
      method: 'PUT',
      ca,
      headers: { origin: appOrigin, 'content-type': 'text/plain' },
      body: 'no signature',
    });
    expect(upload.status).toBe(403);
  });

  it('serves the public bucket to anyone and the private bucket to no one without a signature', async () => {
    const body = 'public or not';
    const keys = {
      public: newKey(config.publicBucket),
      private: newKey(config.privateBucket),
    };
    await server.send(
      new PutObjectCommand({ Bucket: config.publicBucket, Key: keys.public, Body: body }),
    );
    await server.send(
      new PutObjectCommand({ Bucket: config.privateBucket, Key: keys.private, Body: body }),
    );

    const publicRead = await request(`${publicEndpoint}/${config.publicBucket}/${keys.public}`, {
      ca,
    });
    expect(publicRead.status).toBe(200);
    expect(publicRead.body).toBe(body);

    const privateRead = await request(`${publicEndpoint}/${config.privateBucket}/${keys.private}`, {
      ca,
    });
    expect(privateRead.status).toBe(403);
  });
});
