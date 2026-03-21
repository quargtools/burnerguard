# BurnerGuard

Stop disposable and burner email addresses from polluting your signup flow. BurnerGuard ships a curated blocklist with zero runtime dependencies, works in any JavaScript environment, and gives you a clean async API to verify emails against it.

Down the road, adding an API key will upgrade the same `verify()` call to real-time risk scoring from the [BurnerGuard service](https://burnerguard.com) — but the static library is fully functional on its own.

Part of the [Quarg](https://quarg.com) developer tools platform.

---

## Why this library?

Disposable email detection sounds simple — just check a domain against a list. In practice, you end up solving the same problems every time:

- **Raw domain lists** leave you to handle parsing, deduplication, lookup optimization, email validation, and keeping the list current. Every project rebuilds this from scratch.
- **Minimal wrappers** give you a function but stop there — no allowlists to handle false positives, no batch operations, no way to bring your own data.
- **Full email verification platforms** pull in DNS and SMTP dependencies, add latency, and introduce complexity you may not need when all you want is a fast domain check.

BurnerGuard fills the gap: a fast, flexible, self-updating email checker that works offline, supports allowlists, handles batch operations, and ships with zero runtime dependencies.

### Honest limitations

A static blocklist catches known disposable domains, but it can't detect brand-new throwaway domains, catch-all configurations, or suspicious registration patterns. If you need real-time detection with domain age analysis, MX provider fingerprinting, velocity signals, and risk scoring, the [BurnerGuard service](https://burnerguard.com) is on the way. The upgrade path will be seamless — add an API key and the same `verify()` call returns enriched results.

---

## Features

- **Fast lookups** — Domains are stored in a `Set` for constant-time hash lookups. Subdomains are resolved by walking up the domain hierarchy, so even deep subdomains like `a.b.c.throwaway.example` resolve quickly.
- **Subdomain detection** — If `throwaway.example` is blocked, `mail.throwaway.example` is automatically caught too. Works at any depth.
- **Allowlist support** — Explicitly permit domains that would otherwise be matched. The allowlist takes priority at every level of the domain hierarchy, so you can block `example.net` but allow `legit.example.net`.
- **Flexible input** — Pass a full email address or a bare domain to any method. BurnerGuard detects which one you gave it.
- **Batch operations** — Verify a list of emails, filter them into matched and clean buckets, or check whether any email in a set matches.
- **Fully async** — Every verification method returns a `Promise`, so the API won't change when service mode adds network calls. In static mode, the underlying work is synchronous — the async wrapper adds negligible overhead.
- **Bring your own data** — Use the bundled blocklist out of the box, load from a local file, fetch from a URL, pass an inline array, or combine multiple sources. When custom sources are provided, the bundled list steps aside unless you explicitly keep it.
- **Stays current** — The bundled blocklist is updated automatically and published as new patch versions. Just run `npm update` to get the latest domains.
- **Lazy-loaded and memory-conscious** — The bundled blocklist is loaded via dynamic `import()` only when `create()` is called, not at module import time. If you're using custom sources exclusively, the bundled data is never loaded at all.
- **Universal** — No Node.js built-ins in the core path. Works in Node.js, Deno, Bun, Angular, React, Vite, edge runtimes, and serverless functions. File-based sources dynamically import `node:fs` only when you opt into them.
- **Zero runtime dependencies** — Nothing beyond platform built-ins.
- **TypeScript-first** — Full type definitions with a private-constructor factory pattern that guarantees every instance is fully initialized before you can use it.

---

## Requirements

Node.js 20 or later. Works in Deno, Bun, and edge runtimes with no additional configuration.

## Installation

```bash
npm install @quarg/burnerguard
```

```bash
yarn add @quarg/burnerguard
```

```bash
pnpm add @quarg/burnerguard
```

## Quick start

```typescript
import {BurnerGuard} from '@quarg/burnerguard';

const guard = await BurnerGuard.create();

const result = await guard.verify('user@throwaway.example');
// {
//   isMatch: true,
//   domain: 'throwaway.example',
//   matchedOn: 'blocklist',
//   isAllowlisted: false
// }
```

## Usage

### Verifying a single email or domain

`verify()` accepts a full email address or a bare domain. It returns a `VerifyResult` with everything you need to make a decision.

```typescript
await guard.verify('user@throwaway.example');       // email address
await guard.verify('throwaway.example');             // bare domain — works too
await guard.verify('mail.throwaway.example');        // subdomain — caught automatically
await guard.verify('user@company.example');          // clean — { isMatch: false, ... }
```

### Verifying a batch

`verifyBatch()` checks multiple inputs and returns a result for each, in the same order.

```typescript
const results = await guard.verifyBatch([
    'alice@company.example',
    'bob@throwaway.example',
    'carol@another.example'
]);
// [{ isMatch: false, ... }, { isMatch: true, ... }, { isMatch: false, ... }]
```

### Filtering a list

`filter()` splits your list into two buckets: `matched` (disposable) and `clean`.

```typescript
const {matched, clean} = await guard.filter([
    'alice@company.example',
    'bob@throwaway.example',
    'carol@another.example'
]);
// matched: ['bob@throwaway.example']
// clean: ['alice@company.example', 'carol@another.example']
```

### Checking if any email matches

`hasMatch()` short-circuits on the first match — useful when you just need a yes/no answer for a batch.

```typescript
await guard.hasMatch(['alice@company.example', 'bob@throwaway.example']); // true
await guard.hasMatch(['alice@company.example', 'carol@another.example']); // false
```

### Blocking and allowing domains at runtime

You can add domains to the blocklist or allowlist after initialization. These changes apply to the current instance only.

```typescript
await guard.block('sketchy.example');
(await guard.verify('user@sketchy.example')).isMatch; // true

await guard.allow('false-positive.example');
(await guard.verify('user@false-positive.example')).isMatch; // false
```

### Adding extra domains at creation

If you know upfront which domains to add, pass them as options. These are merged with the bundled blocklist.

```typescript
const guard = await BurnerGuard.create({
    additionalBlockedDomains: ['sketchy.example'],
    additionalAllowedDomains: ['legit-but-flagged.example']
});
```

### Loading from custom sources

You can load domain lists from local files, remote URLs, or inline arrays. When custom sources are provided, the bundled blocklist is not loaded by default — pass `useBundledBlocklist: true` to keep it.

```typescript
// From local files (Node.js only)
const guard = await BurnerGuard.create({
    sources: [
        {type: 'block', filePath: '/path/to/my-blocklist.txt'},
        {type: 'allow', filePath: '/path/to/my-allowlist.txt'}
    ]
});

// From a URL (works everywhere — uses native fetch)
const guard = await BurnerGuard.create({
    sources: [{
        type: 'block',
        url: 'https://example.com/my-blocklist.txt'
    }]
});

// From an inline array
const guard = await BurnerGuard.create({
    sources: [{type: 'block', list: ['spam.example', 'junk.example']}]
});

// Mix and match — bundled list + custom sources
const guard = await BurnerGuard.create({
    useBundledBlocklist: true,
    sources: [{type: 'block', list: ['my-extra-domain.example']}]
});
```

### Service mode (coming soon)

Service mode is not yet available. When it launches, you'll add an API key and the same `verify()` call will return enriched results with risk scoring. No code changes required.

```typescript
const guard = await BurnerGuard.create({
    apiKey: 'bg_live_...',
    threshold: 0.7
});

const result = await guard.verify('user@sketchy.example');
// {
//   isMatch: true,
//   domain: 'sketchy.example',
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

Creates and initializes a new instance. Returns `Promise<BurnerGuard>`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | BurnerGuard API key. Enables service mode (coming soon). |
| `threshold` | `number` | `0.5` | Risk score threshold (0.0–1.0). Service mode only. |
| `sources` | `DomainListSource[]` | — | Domain list sources: file path, URL, or inline array. |
| `additionalBlockedDomains` | `string[]` | — | Extra domains to add to the blocklist. |
| `additionalAllowedDomains` | `string[]` | — | Extra domains to add to the allowlist. |
| `useBundledBlocklist` | `boolean` | `true`\* | Whether to load the bundled blocklist. \*Defaults to `false` when custom `sources` are provided. |
| `useBundledAllowlist` | `boolean` | `false` | Whether to load the bundled allowlist. |

### Async methods

| Method | Returns | Description |
|--------|---------|-------------|
| `verify(emailOrDomain, options?)` | `Promise<VerifyResult>` | Verify a single email or domain. |
| `verifyBatch(emailsOrDomains, options?)` | `Promise<VerifyResult[]>` | Verify multiple inputs. Returns results in the same order. |
| `filter(emailsOrDomains, options?)` | `Promise<FilterResult>` | Split inputs into `{matched, clean}`. |
| `hasMatch(emailsOrDomains, options?)` | `Promise<boolean>` | Returns `true` if any input matches. Short-circuits on first match. |
| `block(domain)` | `Promise<void>` | Add a domain to the blocklist at runtime. |
| `allow(domain)` | `Promise<void>` | Add a domain to the allowlist at runtime. |

### Sync methods

| Method | Returns | Description |
|--------|---------|-------------|
| `extractDomain(email)` | `string \| null` | Extract the domain portion from an email address. |
| `isValidEmail(email)` | `boolean` | Check whether a string is a valid email address (syntax only). |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `blocklistSize` | `number` | Number of domains currently in the blocklist. |
| `allowlistSize` | `number` | Number of domains currently in the allowlist. |

### `VerifyResult`

Returned by `verify()` in static mode.

```typescript
{
    isMatch: boolean;        // true if the domain matched the blocklist
    domain: string | null;   // the extracted domain, or null for invalid input
    matchedOn: string | null; // the signal that triggered the match (e.g., "blocklist"), or null
    isAllowlisted: boolean;  // true if the allowlist overrode a potential match
}
```

### `EnrichedVerifyResult`

Returned by `verify()` in service mode (coming soon). Extends `VerifyResult` with additional fields.

```typescript
{
    // ... all VerifyResult fields, plus:
    verdict: 'allow' | 'block' | 'suspect';
    riskScore: number;    // 0.0 (safe) to 1.0 (certain threat)
    signals: RiskSignals; // detailed signal breakdown
}
```

### `FilterResult`

Returned by `filter()`.

```typescript
{
    matched: string[];  // inputs that matched the blocklist
    clean: string[];    // inputs that did not match (or were allowlisted)
}
```

---

## Bundled data and updates

BurnerGuard ships with a pre-processed copy of the [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) community blocklist and allowlist. It works offline out of the box — no network calls needed.

The bundled data is updated automatically and published as new patch versions. Just run `npm update` to pick up new domains. No manual list management required.

To update the bundled data manually:

```bash
npm run update-blocklist
npm run build
```

---

## Acknowledgements

- Domain data sourced from the [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) community blocklist.
- Email validation regex derived from [Angular's form validation](https://github.com/angular/angular/blob/6dd8cce155d36daad11fa07d9732d6079cd3646a/packages/forms/src/validators.ts#L146-L147).

## License

MIT — see [LICENSE](https://github.com/quargtools/burnerguard/blob/main/LICENSE).
