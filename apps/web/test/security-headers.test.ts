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
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Frame-Options'
  ]) {
    assert.match(configSource, new RegExp(headerName));
  }

  assert.doesNotMatch(configSource, /Content-Security-Policy/);
});

test('middleware applies nonce-based CSP without unsafe inline scripts', () => {
  const middlewareSource = readFileSync(
    path.resolve(process.cwd(), 'middleware.ts'),
    'utf8'
  );

  assert.match(middlewareSource, /Content-Security-Policy/);
  assert.match(middlewareSource, /'nonce-\$\{nonce\}'/);
  assert.match(middlewareSource, /script-src 'self' 'nonce-\$\{nonce\}'/);
  assert.match(middlewareSource, /style-src 'self' 'nonce-\$\{nonce\}'/);
  assert.match(middlewareSource, /style-src-attr 'unsafe-inline'/);

  for (const cspDirective of [
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'"
  ]) {
    assert.ok(middlewareSource.includes(cspDirective));
  }

  const scriptDirectiveSource =
    middlewareSource.match(/`script-src[^\r\n]*/)?.[0] ?? '';
  assert.doesNotMatch(scriptDirectiveSource, /'unsafe-inline'/);
});

test('public SEO routes expose the canonical demo URL', () => {
  const robotsSource = readFileSync(
    path.resolve(process.cwd(), 'app/robots.ts'),
    'utf8'
  );
  const sitemapSource = readFileSync(
    path.resolve(process.cwd(), 'app/sitemap.ts'),
    'utf8'
  );
  const siteSource = readFileSync(
    path.resolve(process.cwd(), 'src/shared/seo/site.ts'),
    'utf8'
  );

  assert.match(siteSource, /https:\/\/personalerp\.theworkpc\.com/);
  assert.match(robotsSource, /sitemap/);
  assert.match(sitemapSource, /publicSiteUrl/);
  assert.doesNotMatch(robotsSource, /Disallow:\s*\//);
});
