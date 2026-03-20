# BurnerGuard

Detect disposable and burner email addresses in Node.js. Static blocklist mode works offline with zero runtime dependencies. Add an API key to unlock real-time risk scoring from the [BurnerGuard service](https://burnerguard.com).

Part of the [Quarg](https://quarg.com) developer tools platform.

---

## Why this library?

Disposable email detection sounds simple — just check a domain against a list. In practice, you end up solving the same problems every time:

- **Raw domain lists** leave you to handle parsing, deduplication, lookup optimization, email validation, and keeping the list current. Every project rebuilds this from scratch.
- **Minimal wrappers** give you a function but stop there — no allowlists to handle false positives, no batch operations, no way to bring your own data sources.
- **Full email verification platforms** pull in DNS and SMTP dependencies, add latency, and introduce complexity you may not need when all you want is a fast domain check.

This library fills the gap: a fast, flexible, self-updating email checker that works offline, supports allowlists, handles batch operations, and ships with zero runtime dependencies.

### Static list limitations

A static blocklist catches known disposable domains but cannot detect newly created throwaway domains, catch-all configurations, or suspicious registration patterns. For real-time detection with domain age analysis, MX provider fingerprinting, velocity signals, and risk scoring, see the [BurnerGuard service](https://burnerguard.com). The upgrade path is seamless — add an API key and the same `verify()` call returns enriched results.

---

## Features

- **O(1) lookups** — Domains are stored in a `Set` for constant-time checks.
- **Subdomain detection** — If `yopmail.com` is blocked, `mail.yopmail.com` is automatically caught too. Works at any depth.
- **Allowlist support** — Explicitly permit domains that would otherwise be matched, preventing false positives. The allowlist takes priority at every level of the domain hierarchy.
- **Flexible input** — Pass an email address or a bare domain to any method. The library detects which one you gave it.
- **Batch operations** — Verify multiple emails, filter into matched/clean buckets, or test whether any email in a set matches.
- **Fully async API** — Every verification method returns a `Promise`. Synchronous today (static mode), ready for network calls tomorrow (service mode).
- **Flexible data loading** — Use the bundled blocklist (works offline), load from a local file, fetch from a URL, pass an inline array, or combine multiple sources.
- **Stays current automatically** — A GitHub Actions pipeline fetches the latest upstream blocklist daily, opens a PR, runs tests, merges, bumps the version, and publishes to npm. Consumers just run `npm update`.
- **Lazy-loaded, memory-conscious** — The bundled blocklist is loaded via dynamic `import()` only when `create()` is called, not at module import time. In service mode with an API key, the list is never loaded at all — verification is handled entirely by the remote API, keeping your memory footprint near zero.
- **Universal** — No Node.js built-ins in the core path. Works in Node.js, Angular, React, Vite, Deno, Bun, edge runtimes, and serverless functions. File-based sources use a dynamic `import('node:fs/promises')` that is only resolved when you explicitly opt into file loading.
- **Zero runtime dependencies** — Nothing beyond platform built-ins. No `node_modules` bloat.
- **TypeScript-first** — Full type definitions, discriminated union configuration, and a private-constructor pattern that guarantees a fully initialized instance.
- **Service-ready** — Add an API key to upgrade from static blocklist checks to real-time risk scoring with no code changes.

---

## Installation

```bash
npm install @quarg/burnerguard
# or
yarn add @quarg/burnerguard
```

## Usage

### Basic verification

```typescript
import {BurnerGuard} from '@quarg/burnerguard';

const guard = await BurnerGuard.create();

const result = await guard.verify('user@yopmail.com');
// {
//   isMatch: true,
//   domain: 'yopmail.com',
//   matchedOn: 'blocklist',
//   isAllowlisted: false
// }

await guard.verify('user@gmail.com');
// { isMatch: false, domain: 'gmail.com', matchedOn: null, isAllowlisted: false }

await guard.verify('yopmail.com');       // bare domain — works too
await guard.verify('mail.yopmail.com');  // subdomain — caught automatically
```

### Batch verification

```typescript
const results = await guard.verifyBatch([
    'alice@gmail.com',
    'bob@yopmail.com',
    'carol@outlook.com'
]);
// [{ isMatch: false, ... }, { isMatch: true, ... }, { isMatch: false, ... }]
```

### Filtering a list

```typescript
const {matched, clean} = await guard.filter([
    'alice@gmail.com',
    'bob@yopmail.com',
    'carol@outlook.com'
]);
// matched: ['bob@yopmail.com']
// clean: ['alice@gmail.com', 'carol@outlook.com']

await guard.hasMatch(emails); // true if any are matched
```

### Blocking and allowing at runtime

```typescript
await guard.block('sketchy-domain.io');
(await guard.verify('user@sketchy-domain.io')).isMatch; // true

await guard.allow('false-positive.com');
(await guard.verify('user@false-positive.com')).isMatch; // false
```

### Adding domains at creation

```typescript
const guard = await BurnerGuard.create({
    additionalBlockedDomains: ['sketchy.com'],
    additionalAllowedDomains: ['legit-but-flagged.com']
});
```

### Loading from custom sources

```typescript
const guard = await BurnerGuard.create({
    sources: [
        {type: 'block', filePath: '/path/to/my-blocklist.txt'},
        {type: 'allow', filePath: '/path/to/my-allowlist.txt'}
    ]
});
```

```typescript
const guard = await BurnerGuard.create({
    sources: [{
        type: 'block',
        url: 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf'
    }]
});
```

### Service mode (coming soon)

```typescript
const guard = await BurnerGuard.create({
    apiKey: 'bg_live_...',
    threshold: 0.7
});

const result = await guard.verify('user@sketchy.com');
// {
//   isMatch: true,
//   domain: 'sketchy.com',
//   matchedOn: 'domainAge',
//   isAllowlisted: false,
//   verdict: 'block',
//   riskScore: 0.94,
//   signals: {
//     blocklist: false,
//     domainAgeDays: 4,
//     mxProvider: 'catch-all',
//     catchAll: true,
//     roleAddress: false,
//     patternCluster: false,
//     velocity: false
//   }
// }
```

---

## API Reference

### `BurnerGuard.create(options?)`

Creates a fully initialized instance. Returns `Promise<BurnerGuard>`.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | BurnerGuard API key. Enables service mode. |
| `threshold` | `number` | `0.5` | Risk score threshold (0.0–1.0) for service mode. |
| `sources` | `DomainListSource[]` | — | Full-power domain list sources (file, URL, or inline array). |
| `additionalBlockedDomains` | `string[]` | — | Shorthand: extra domains to block. |
| `additionalAllowedDomains` | `string[]` | — | Shorthand: extra domains to allow. |
| `useBundledBlocklist` | `boolean` | `true` | Load the bundled blocklist. |
| `useBundledAllowlist` | `boolean` | `false` | Load the bundled allowlist. |

### Async methods

| Method | Returns | Description |
|--------|---------|-------------|
| `verify(emailOrDomain, options?)` | `Promise<VerifyResult>` | Verify a single email or domain |
| `verifyBatch(emailsOrDomains, options?)` | `Promise<VerifyResult[]>` | Verify multiple inputs |
| `filter(emailsOrDomains, options?)` | `Promise<FilterResult>` | Split into `{matched, clean}` |
| `hasMatch(emailsOrDomains, options?)` | `Promise<boolean>` | True if any input matches |
| `block(domain)` | `Promise<void>` | Add a domain to the blocklist |
| `allow(domain)` | `Promise<void>` | Add a domain to the allowlist |

### Sync methods

| Method | Returns | Description |
|--------|---------|-------------|
| `extractDomain(email)` | `string \| null` | Extract the domain from an email |
| `isValidEmail(email)` | `boolean` | Validate email syntax |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `blocklistSize` | `number` | Number of domains in the blocklist |
| `allowlistSize` | `number` | Number of domains in the allowlist |

### Response types

**`VerifyResult`** (static mode)

```typescript
{
    isMatch: boolean;
    domain: string | null;
    matchedOn: string | null;   // "blocklist" or null
    isAllowlisted: boolean;
}
```

**`EnrichedVerifyResult`** (service mode — extends VerifyResult)

```typescript
{
    // ...VerifyResult fields
    verdict: 'allow' | 'block' | 'suspect';
    riskScore: number;          // 0.0 to 1.0
    signals: RiskSignals;
}
```

---

## Bundled Data & Updates

The library ships with a pre-processed copy of the upstream blocklist and allowlist, so it works offline out of the box.

To keep the bundled data current, this project includes a GitHub Actions pipeline that:

1. Fetches the latest blocklist and allowlist from upstream daily
2. Opens a PR with the changes
3. Runs the test suite
4. Auto-merges and publishes a new patch version to npm

As a consumer, you just run `npm update` to get the latest domains. No manual list management required.

If you need to update the bundled data manually:

```bash
npm run update-blocklist
npm run build
```

---

## Acknowledgements

* Built on the [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) community blocklist.
* Email validation regex derived from [Angular's form validation](https://github.com/angular/angular/blob/6dd8cce155d36daad11fa07d9732d6079cd3646a/packages/forms/src/validators.ts#L146-L147).

## License

This project is licensed under the [MIT License](https://github.com/quargtools/burnerguard/blob/main/LICENSE).
