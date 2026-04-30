import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('next config applies baseline web security headers to every route', () => {
  const configSource = readFileSync(
    path.resolve(process.cwd(), 'next.config.mjs'),
    'utf8'
  );

  assert.match(configSource, /async headers\(\)/);
  assert.match(configSource, /source:\s*'\/:path\*'/);

  for (const headerName of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Frame-Options'
  ]) {
    assert.match(configSource, new RegExp(headerName));
  }

  for (const cspDirective of [
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'"
  ]) {
    assert.ok(configSource.includes(cspDirective));
  }
});
