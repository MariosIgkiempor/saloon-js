// Tree-shaking proof. SaloonPHP bundles behavior into class methods, which a
// bundler cannot split — pull in the connector and you pull in OAuth and faking.
// saloon-js exposes free functions from a side-effect-free barrel, so a consumer
// who only imports `defineConnector`/`defineRequest`/`send` should never ship the
// OAuth2 grant entry points or the mock-client/faking surface.
//
// We bundle a synthetic entry against `src/index.ts` with Rolldown (the same
// engine tsdown builds with) and assert which symbols survive tree-shaking.

import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(import.meta.dirname, '..', 'src');

/** Bundle an entry that imports `names` from the public barrel; return the code. */
async function bundleBarrelImport(names: string): Promise<string> {
  const entryId = '\0saloon-treeshake-entry';
  const bundle = await rolldown({
    input: 'saloon-treeshake-entry',
    logLevel: 'silent',
    plugins: [
      {
        name: 'virtual-entry',
        resolveId(id) {
          return id === 'saloon-treeshake-entry' ? entryId : undefined;
        },
        load(id) {
          // Reference the imports through a global sink so nothing is dropped
          // merely for being unused at the entry — only via tree-shaking.
          return id === entryId
            ? `import { ${names} } from '@/index';\nglobalThis.__sink = [${names}];\n`
            : undefined;
        },
      },
    ],
    resolve: { alias: { '@': srcDir } },
  });
  const { output } = await bundle.generate({ format: 'esm', minify: false });
  await bundle.close();
  return output[0].code;
}

// Entry points unique to each subsystem. If a subsystem is tree-shaken away,
// none of its declarations survive, so its name vanishes from the bundle.
const OAUTH_ENTRY_POINTS = [
  'authorizationUrl',
  'exchangeCode',
  'clientCredentials',
  'getOAuthUser',
];
const FAKING_ENTRY_POINTS = ['createMockClient', 'mockResponse'];

describe('tree-shaking', () => {
  it('drops the OAuth2 and faking subsystems from a core-only import', async () => {
    const code = await bundleBarrelImport('defineConnector, defineRequest, send');

    for (const symbol of [...OAUTH_ENTRY_POINTS, ...FAKING_ENTRY_POINTS]) {
      expect(code, `expected core bundle to drop "${symbol}"`).not.toContain(symbol);
    }
  });

  it('includes the OAuth2 grants only when they are imported', async () => {
    const code = await bundleBarrelImport(
      'defineConnector, send, authorizationUrl, clientCredentials',
    );

    for (const symbol of ['authorizationUrl', 'clientCredentials']) {
      expect(code, `expected OAuth bundle to keep "${symbol}"`).toContain(symbol);
    }
  });

  it('includes the faking surface only when it is imported', async () => {
    const code = await bundleBarrelImport('createMockClient, mockResponse');

    for (const symbol of FAKING_ENTRY_POINTS) {
      expect(code, `expected faking bundle to keep "${symbol}"`).toContain(symbol);
    }
  });

  it('keeps the core-only bundle smaller than one that also pulls in OAuth grants', async () => {
    const core = await bundleBarrelImport('defineConnector, defineRequest, send');
    const withOauth = await bundleBarrelImport(
      'defineConnector, defineRequest, send, authorizationUrl, clientCredentials, exchangeCode',
    );

    expect(core.length).toBeLessThan(withOauth.length);
  });
});
