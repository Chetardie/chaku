// CHK-19: the storage adapter stores and reads objects in SeaweedFS, and signs browser links for the
// public endpoint (D42). Needs `pnpm stack`.
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createS3Storage } from '../src/storage.ts';
import { env, stackRequest } from './env.ts';

const storage = createS3Storage({
  endpoint: env('S3_ENDPOINT'),
  publicEndpoint: env('S3_PUBLIC_ENDPOINT'),
  region: env('S3_REGION'),
  accessKeyId: env('S3_ACCESS_KEY_ID'),
  secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
});
const bucket = env('S3_BUCKET_PRIVATE');

describe('storage adapter (S3 API on SeaweedFS)', () => {
  it('puts an object and gets the same bytes back', async () => {
    const key = `adapter-check/${randomUUID()}.txt`;
    await storage.put({ bucket, key, body: 'hello', contentType: 'text/plain' });
    const bytes = await storage.get({ bucket, key });
    expect(new TextDecoder().decode(bytes ?? new Uint8Array())).toBe('hello');
  });

  it('gets null for a missing object', async () => {
    await expect(storage.get({ bucket, key: `adapter-check/${randomUUID()}` })).resolves.toBeNull();
  });

  it('signs links for the public endpoint that a browser can upload to and read from', async () => {
    const key = `adapter-check/${randomUUID()}.txt`;
    const publicOrigin = new URL(env('S3_PUBLIC_ENDPOINT')).origin;

    const upload = await storage.signUpload({
      bucket,
      key,
      contentType: 'text/plain',
      expiresIn: 60,
    });
    expect(new URL(upload).origin).toBe(publicOrigin);
    expect(new URL(upload).searchParams.get('X-Amz-Expires')).toBe('60');
    const put = await stackRequest(upload, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'uploaded by a browser',
    });
    expect(put.status).toBe(200);

    const download = await storage.signDownload({ bucket, key, expiresIn: 300 });
    expect(new URL(download).origin).toBe(publicOrigin);
    const get = await stackRequest(download);
    expect(get).toEqual({ status: 200, body: 'uploaded by a browser' });
  });
});
