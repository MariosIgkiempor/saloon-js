// Port of ../saloon/src/Http/Faking/Fixture.php
//
// A fixture records a live response to disk once, then replays it offline. On-disk
// schema (pretty-printed JSON): `{ statusCode, headers, data }` where `data` is the
// raw response body text. PHP did redaction via subclass overrides; here it is
// options/callbacks: `sensitiveHeaders`, `sensitiveJsonParameters`,
// `sensitiveRegexPatterns`, and a final `beforeSave(recorded)` transform.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { FIXTURE_BRAND, type Fixture } from '@/contracts/Fixture';
import type { Response } from '@/contracts/Response';
import { mockResponse } from '@/faking/mockResponse';

const REDACTED = 'REDACTED';
const DEFAULT_DIRECTORY = join('tests', 'Fixtures', 'saloon');

/** The on-disk fixture record. */
export interface RecordedFixture {
  statusCode: number;
  headers: Record<string, string>;
  data: string;
}

export interface FixtureOptions {
  /** Directory fixtures live under (default `tests/Fixtures/saloon`). */
  directory?: string;
  /** Header names whose values are replaced with `REDACTED` before saving. */
  sensitiveHeaders?: string[];
  /** JSON keys (at any depth) whose values are replaced with `REDACTED`. */
  sensitiveJsonParameters?: string[];
  /** Regexes applied to the body text, each match replaced with `REDACTED`. */
  sensitiveRegexPatterns?: RegExp[];
  /** A final transform over the record just before it is written. */
  beforeSave?: (recorded: RecordedFixture) => RecordedFixture;
}

export function fixture(name: string, options: FixtureOptions = {}): Fixture {
  const directory = options.directory ?? DEFAULT_DIRECTORY;
  const safeName = sanitizeName(name);
  const path = `${join(directory, safeName)}.json`;

  // Defense in depth: the resolved path must stay inside the fixture directory.
  const root = resolve(directory);
  if (resolve(path) !== root && !resolve(path).startsWith(root + sep)) {
    throw new Error(`Fixture name escapes the fixture directory: ${name}`);
  }

  return {
    [FIXTURE_BRAND]: true,
    name: safeName,
    async getMockResponse() {
      const raw = await readFileOrNull(path);
      if (raw === null) return null;
      const recorded = JSON.parse(raw) as RecordedFixture;
      return mockResponse(recorded.data, recorded.statusCode, recorded.headers);
    },
    async store(response: Response) {
      let recorded: RecordedFixture = {
        statusCode: response.status(),
        headers: response.headers().all(),
        data: response.body(),
      };
      recorded = redact(recorded, options);
      if (options.beforeSave) recorded = options.beforeSave(recorded);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(recorded, null, 2), 'utf8');
    },
  };
}

// Sanitize to alphanumerics + `-_/`, then reject any traversal attempt outright.
function sanitizeName(name: string): string {
  if (name.includes('..')) throw new Error(`Fixture name may not contain "..": ${name}`);
  const cleaned = name.replace(/[^a-zA-Z0-9\-_/]/g, '');
  const segments = cleaned.split('/').filter((segment) => segment !== '');
  if (segments.length === 0) throw new Error(`Fixture name is empty after sanitization: ${name}`);
  return segments.join('/');
}

async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

function redact(recorded: RecordedFixture, options: FixtureOptions): RecordedFixture {
  let { headers, data } = recorded;

  if (options.sensitiveHeaders?.length) {
    const lower = new Set(options.sensitiveHeaders.map((header) => header.toLowerCase()));
    headers = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key,
        lower.has(key.toLowerCase()) ? REDACTED : value,
      ]),
    );
  }

  if (options.sensitiveJsonParameters?.length) {
    try {
      const parsed: unknown = JSON.parse(data);
      data = JSON.stringify(redactJson(parsed, new Set(options.sensitiveJsonParameters)));
    } catch {
      // Body is not JSON — leave it for the regex pass.
    }
  }

  if (options.sensitiveRegexPatterns?.length) {
    for (const pattern of options.sensitiveRegexPatterns) data = data.replace(pattern, REDACTED);
  }

  return { statusCode: recorded.statusCode, headers, data };
}

function redactJson(value: unknown, keys: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => redactJson(item, keys));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        keys.has(key) ? REDACTED : redactJson(nested, keys),
      ]),
    );
  }
  return value;
}
