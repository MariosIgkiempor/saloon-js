import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { fixture } from '@/faking/fixture';
import { createMockClient } from '@/faking/mockClient';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { startTestServer, type TestServer } from '../support/testServer';

interface RecordedFixtureFile {
  statusCode: number;
  headers: Record<string, string>;
  data: string;
}

describe('fixture', () => {
  let server: TestServer;
  let dir: string;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    server.reset();
    dir = await mkdtemp(join(tmpdir(), 'saloon-fixture-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('records a live response, then replays it offline', async () => {
    const connector = defineConnector({ baseUrl: server.url });
    const request = defineRequest({ method: Method.GET, endpoint: '/get' });

    // First send: record mode (no file yet) → the real request runs and is stored.
    const record = createMockClient([fixture('users/ada', { directory: dir })]);
    const live = await send(connector, request, { mockClient: record });
    expect(live.isMocked()).toBe(false);
    expect(server.requests).toHaveLength(1);

    // Second send: replay (file now exists) → no live request, flagged isMocked.
    server.reset();
    const replay = createMockClient([fixture('users/ada', { directory: dir })]);
    const replayed = await send(connector, request, { mockClient: replay });
    expect(replayed.isMocked()).toBe(true);
    expect(server.requests).toHaveLength(0);
    expect(replayed.json<string>('path')).toBe('/get');
  });

  it('applies header, JSON-parameter and regex redaction to the stored bytes', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      headers: { authorization: 'Bearer super-secret' },
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/get' });

    const fix = fixture('redacted/one', {
      directory: dir,
      sensitiveHeaders: ['content-type'],
      sensitiveJsonParameters: ['authorization'],
      sensitiveRegexPatterns: [/GET/g],
    });
    await send(connector, request, { mockClient: createMockClient([fix]) });

    const raw = await readFile(join(dir, 'redacted', 'one.json'), 'utf8');
    const stored = JSON.parse(raw) as RecordedFixtureFile;

    // Sensitive response header redacted.
    expect(stored.headers['content-type']).toBe('REDACTED');
    // The echoed request's Authorization (a nested JSON key) redacted.
    const data = JSON.parse(stored.data) as { method: string; headers: Record<string, string> };
    expect(data.headers.authorization).toBe('REDACTED');
    expect(stored.data).not.toContain('super-secret');
    // Regex applied to the body text: "GET" → "REDACTED".
    expect(data.method).toBe('REDACTED');
  });

  it('rejects a path-traversal fixture name', () => {
    expect(() => fixture('../escape', { directory: dir })).toThrow(/\.\./);
  });
});
