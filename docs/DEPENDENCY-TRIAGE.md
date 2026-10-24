# Dependency triage — 2026-10-24

Bun 1.4.4's registry audit initially reported **2 critical, 30 high, 36 moderate,
and 9 low advisories**. After the updates below it reports **0 critical, 0 high,
3 moderate, and 3 low**. These are advisory counts, not independently confirmed
exploits. `bun audit --audit-level=high` exits successfully; the remaining
findings remain visible and are not suppressed.

## Applied updates

| Dependency       | Change                                        | Evidence and application exposure                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sharp            | 0.35.3 → 0.35.5 in API and docs               | User avatar uploads reach `apps/api/src/services/avatar.ts`. [The upstream advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) identifies 0.35.5 and librsvg 2.63.2 as patched. The installed binary reports both versions.                                                                                                                                                                                                 |
| Zod              | Catalog 4.4.3 → 4.6.6                         | Request schemas use this package. [Collection-validation memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) is patched in 4.6.6. Existing request limits reduce exposure but do not substitute for updating.                                                                                                                                                                                                      |
| Puppeteer        | Core 25.8.0 → 25.13.0; browsers 3.2.1 → 3.2.4 | This same-major update selects Chromium BiDi 157.0.8090-0 with Zod 4, removing the otherwise vulnerable Zod 3 copy without overriding its dependency contract.                                                                                                                                                                                                                                                                       |
| Nodemailer       | 9.0.5 → 10.1.4                                | SMTP email is a runtime feature. [Parser denial of service](https://github.com/advisories/GHSA-v53p-9fqp-m79j) requires at least 10.0.6; later recipient parsing advisories require 10.1.4. [Version 10's migration notes](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0) require Node 20+ and preserve the type layout. Bun compatibility was checked with the actual SMTP provider against a loopback test server. |
| oxfmt / Tinypool | 0.63.0 → 0.67.0 / 2.1.0 → 2.1.2               | The formatter declares the fixed worker pool directly. [Worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) advisories concern development/CI execution and require a separate prototype-pollution primitive.                                                                                                                                    |
| fast-xml-parser  | 5.9.3 → 5.11.2                                | Compatible Google Cloud Storage dependency refresh; [entity-limit bypass](https://github.com/advisories/GHSA-8r6m-32jq-jx6q) is fixed from 5.10.1.                                                                                                                                                                                                                                                                                   |
| Undici           | 8.10.0 → 8.12.2                               | Compatible refresh under Kubernetes client and docs font fetching. [Malformed response crash](https://github.com/advisories/GHSA-xjj6-f33q-929c) and the other audited 8.x findings are covered.                                                                                                                                                                                                                                     |
| fast-uri         | 3.1.3 → 3.1.9                                 | Compatible AJV dependency refresh; [scheme normalization advisory](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) specifies the 3.1.9 backport.                                                                                                                                                                                                                                                                                  |

Bun also refreshed/deduplicated vulnerable compatible copies of devalue to
5.9.4, ip-address to 10.7.4, js-yaml to 4.3.2/5.5.0, nanoid to 3.3.20,
PostCSS to 8.5.30, smol-toml to 1.9.1, source-map-js to 1.2.2, and fflate to
0.7.5. No new dependency overrides were introduced.

The http-cache-semantics refresh to 4.3.0 also leaves its reported affected range.
However, [the maintainer disputes that advisory](https://github.com/kornelski/http-cache-semantics/issues/56),
and GHSA lists no patched version. Treat this as an upstream dispute and compatible
refresh, not evidence that a confirmed application exploit was repaired. This
dependency is used by the docs toolchain, not as the API's shared response cache.

## Remaining findings and follow-up

These reachability assessments come from the local dependency graph and call
sites; they are not universal claims that the packages are safe.

| Finding                                              | Current path / assessment                                                                                                                                                                                                                               | Follow-up                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| SvelteKit: two low advisories; cookie 0.6.0: one low | SvelteKit 2.70.2 and its cookie dependency. The web app uses static output with SSR disabled and separate Hono API routes. The reported server form/prerender/cookie paths are not used in production.                                                  | Evaluate SvelteKit 3 as a separate framework migration; reassess before enabling server rendering or form actions.              |
| esbuild 0.18.20: moderate                            | Drizzle Kit → legacy esbuild-kit loader. The advisory concerns esbuild's development HTTP server; database commands do not start that server.                                                                                                           | Upgrade the parent migration tooling when it removes the old loader. Do not force a 0.25+ esbuild into a `~0.18.20` dependency. |
| postcss-selector-parser 6.1.4: moderate              | Docs expressive-code → postcss-nested 6.2.0. Trusted repository CSS is processed during builds. [The advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) specifically distinguishes trusted build input from request-time untrusted selectors. | Upgrade the parent docs stack to a parser 7.1.6+ dependency; do not serve untrusted CSS compilation.                            |
| uuid 9.0.1: moderate                                 | Google Cloud Storage → gaxios/teeny-request. Installed callers use `v4()` for multipart boundaries; the reported buffer-bounds issue concerns v3/v5/v6 with a caller-provided buffer.                                                                   | Upgrade the Google SDK dependency chain when it selects uuid 11.1.1+; avoid a cross-major override.                             |

## Reproduction and verification

The seven-day install delay remains in `bunfig.toml`. Newly published security
patches Nodemailer 10.1.4 and fast-uri 3.1.9 required one-time, package-specific
CLI release-age exceptions. The first install also named Zod and Sharp, which
were already old enough. No persistent exception or global age reduction was
added. Normal frozen installation succeeds without these flags.

Run from the repository root with Bun 1.4.4:

```sh
bun install --frozen-lockfile --ignore-scripts
bun audit --audit-level=high
bun run --filter @rctf/web test
bun run test:server
bun run build:api
bun run --filter @rctf/api typecheck
bun run test:admin-bot
bun run --filter @rctf/admin-bot typecheck
```

Verified locally: frozen install, audit threshold, **1,076 web tests**, **647
server tests**, **106 admin-bot tests**, API build, and API/admin-bot typechecks.
Additional smoke checks converted SVG to a 256px WebP using the installed Sharp
binary and sent mail through the actual SMTP provider to a loopback-only test
server. The admin-bot unit suite mocks browser automation; a real browser
end-to-end run was not performed in this environment.
