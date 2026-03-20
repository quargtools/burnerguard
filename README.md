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
- **Allowlist support** — Explicitly permit domains that would otherwise be flagged, preventing false positives. The allowlist takes priority over the blocklist.
- **Batch operations** — Check multiple emails at once, filter disposable or non-disposable emails from a list, or test whether any email in a set is disposable.
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
import { DisposableEmailChecker } from '@floracodex/disposable-email-checker';

const checker = await DisposableEmailChecker.create();

checker.isDisposable('user@gmail.com');       // false
checker.isDisposable('user@yopmail.com');      // true
checker.isDisposable('not-an-email');          // false (invalid format)
```

### Batch operations

```typescript
const emails = [
    'alice@example.com',
    'bob@tempmail.com',
    'carol@gmail.com',
];

checker.checkEmails(emails);           // [false, true, false]
checker.containsDisposable(emails);    // true
checker.getDisposableEmails(emails);   // ['bob@tempmail.com']
checker.getNonDisposableEmails(emails); // ['alice@example.com', 'carol@gmail.com']
```

### Allowlisting domains

```typescript
// A domain on the blocklist that you want to permit
checker.isDisposable('user@example.com'); // true

checker.addAllowedDomain('example.com');
checker.isDisposable('user@example.com'); // false
```

### Adding domains at runtime

```typescript
checker.addDisposableDomain('sketchy-domain.io');
checker.isDisposable('user@sketchy-domain.io'); // true
```

### Loading from a custom file

```typescript
import { DisposableEmailChecker } from '@floracodex/disposable-email-checker';

const checker = await DisposableEmailChecker.create({
    domainLists: [
        { type: 'block', filePath: '/path/to/my-blocklist.txt' },
        { type: 'allow', filePath: '/path/to/my-allowlist.txt' },
    ],
});
```

### Loading from a remote URL

```typescript
const checker = await DisposableEmailChecker.create({
    domainLists: [
        {
            type: 'block',
            url: 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf',
        },
    ],
});
```

---

## API Reference

### Static methods

| Method | Returns | Description |
|--------|---------|-------------|
| `DisposableEmailChecker.create(options?)` | `Promise<DisposableEmailChecker>` | Creates a fully initialized instance |

### Instance methods

| Method | Returns | Description |
|--------|---------|-------------|
| `isDisposable(email)` | `boolean` | Check if an email's domain is disposable |
| `isDomainDisposable(domain)` | `boolean` | Check a domain directly |
| `checkEmails(emails)` | `boolean[]` | Check multiple emails, returns parallel array of results |
| `containsDisposable(emails)` | `boolean` | Returns `true` if any email is disposable |
| `getDisposableEmails(emails)` | `string[]` | Filter to only disposable emails |
| `getNonDisposableEmails(emails)` | `string[]` | Filter to only non-disposable emails |
| `isValidEmailSyntax(email)` | `boolean` | Validate email format without checking disposability |
| `getDomainFromEmail(email)` | `string \| null` | Extract the domain from an email address |
| `addAllowedDomain(domain)` | `void` | Add a domain to the allowlist at runtime |
| `addDisposableDomain(domain)` | `void` | Add a domain to the blocklist at runtime |
| `getDomainDisposableDomainCount()` | `number` | Get the number of domains in the blocklist |

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
