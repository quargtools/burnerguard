# Disposable Email Checker

A batteries-included Node.js library for detecting disposable (burner) email domains. Powered by the community-maintained [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) blocklist, this library gives you production-ready email validation with zero runtime dependencies — no DNS lookups, no SMTP connections, no external API calls.

---

## Why this library?

Disposable email detection sounds simple — just check a domain against a list. In practice, you end up solving the same problems every time:

- **Raw domain lists** leave you to handle parsing, deduplication, lookup optimization, email validation, and keeping the list current. Every project rebuilds this from scratch.
- **Minimal wrappers** give you an `isDisposable()` function but stop there — no allowlists to handle false positives, no batch operations, no way to bring your own data sources.
- **Full email verification platforms** pull in DNS and SMTP dependencies, add latency, and introduce complexity you may not need when all you want is a fast domain check.

This library fills the gap: a fast, flexible, self-updating disposable email checker that works offline, supports allowlists, handles batch operations, and ships with zero runtime dependencies.

---

## Features

- **O(1) lookups** — Domains are stored in a `Set` for constant-time checks. After async initialization, all operations are synchronous.
- **Subdomain detection** — If `yopmail.com` is blocked, `mail.yopmail.com` is automatically caught too. Works at any depth.
- **Allowlist support** — Explicitly permit domains that would otherwise be flagged, preventing false positives. The allowlist takes priority over the blocklist at every level of the domain hierarchy.
- **Flexible input** — Pass an email address or a bare domain to any check method. The library detects which one you gave it.
- **Batch operations** — Filter a list of emails into disposable and clean buckets in a single call.
- **Detailed results** — Get the matched blocklist rule, allowlist status, and extracted domain for logging and debugging.
- **Flexible data loading** — Use the bundled blocklist (works offline), load from a local file, fetch from a URL, pass an inline array, or combine multiple sources.
- **Stays current automatically** — A GitHub Actions pipeline fetches the latest upstream blocklist daily, opens a PR, runs tests, merges, bumps the version, and publishes to npm. Consumers just run `npm update`.
- **Zero runtime dependencies** — Nothing beyond Node.js built-ins. Suitable for serverless functions, edge runtimes, and resource-constrained environments.
- **TypeScript-first** — Full type definitions, discriminated union configuration, and a private-constructor pattern that guarantees a fully initialized instance.

---

## Installation

```bash
npm install @floracodex/disposable-email-checker
# or
yarn add @floracodex/disposable-email-checker
```

## Usage

Create an instance with the async `create()` factory, then use synchronous methods for fast checks.

### Basic check

```typescript
import {EmailChecker} from '@floracodex/disposable-email-checker';

const checker = await EmailChecker.create();

checker.isDisposable('user@yopmail.com');      // true
checker.isDisposable('user@gmail.com');         // false
checker.isDisposable('yopmail.com');            // true (bare domain)
checker.isDisposable('mail.yopmail.com');       // true (subdomain)
```

### Detailed check

```typescript
const result = checker.check('user@sub.yopmail.com');
// {
//   isDisposable: true,
//   domain: 'sub.yopmail.com',
//   matchedRule: 'yopmail.com',
//   isAllowlisted: false
// }
```

### Filtering a list

```typescript
const {disposable, clean} = checker.filter([
    'alice@gmail.com',
    'bob@yopmail.com',
    'carol@outlook.com'
]);
// disposable: ['bob@yopmail.com']
// clean: ['alice@gmail.com', 'carol@outlook.com']

checker.hasDisposable(emails); // true if any are disposable
```

### Blocking and allowing at runtime

```typescript
checker.block('sketchy-domain.io');
checker.isDisposable('user@sketchy-domain.io'); // true

checker.allow('false-positive.com');
checker.isDisposable('user@false-positive.com'); // false
```

### Adding domains at creation

```typescript
const checker = await EmailChecker.create({
    additionalBlockedDomains: ['sketchy.com'],
    additionalAllowedDomains: ['legit-but-flagged.com']
});
```

### Loading from custom sources

```typescript
const checker = await EmailChecker.create({
    sources: [
        {type: 'block', filePath: '/path/to/my-blocklist.txt'},
        {type: 'allow', filePath: '/path/to/my-allowlist.txt'}
    ]
});
```

```typescript
const checker = await EmailChecker.create({
    sources: [{
        type: 'block',
        url: 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf'
    }]
});
```

---

## API Reference

### `EmailChecker.create(options?)`

Creates a fully initialized instance. Returns `Promise<EmailChecker>`.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sources` | `DomainListSource[]` | — | Full-power domain list sources (file, URL, or inline array) |
| `additionalBlockedDomains` | `string[]` | — | Shorthand: extra domains to block |
| `additionalAllowedDomains` | `string[]` | — | Shorthand: extra domains to allow |
| `useBundledBlocklist` | `boolean` | `true` | Load the bundled blocklist |
| `useBundledAllowlist` | `boolean` | `false` | Load the bundled allowlist |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `isDisposable(emailOrDomain)` | `boolean` | Check if an email or domain is disposable |
| `check(emailOrDomain)` | `CheckResult` | Detailed check with matched rule and allowlist status |
| `filter(emails)` | `FilterResult` | Split emails into `{disposable, clean}` |
| `hasDisposable(emails)` | `boolean` | True if any email is disposable |
| `block(domain)` | `void` | Add a domain to the blocklist at runtime |
| `allow(domain)` | `void` | Add a domain to the allowlist at runtime |
| `extractDomain(email)` | `string \| null` | Extract the domain from an email |
| `isValidEmail(email)` | `boolean` | Validate email syntax |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `blocklistSize` | `number` | Number of domains in the blocklist |
| `allowlistSize` | `number` | Number of domains in the allowlist |

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

This project is licensed under the [MIT License](https://github.com/floracodex/disposable-email-checker/blob/main/LICENSE).
