# Code Style Guide — FloraCodex

> **Auto-trigger:** Apply this skill whenever writing, reviewing, or refactoring TypeScript code in this library. Also trigger when the user asks about naming conventions, import ordering, formatting, code organization, or "how should I write this?"

---

## 1. Language & Targets

| Area | Language | Target |
|------|----------|--------|
| Library | Pure TypeScript — no framework imports | ES2020 |

Full `strict` mode is enabled. Prefer explicit types even where the compiler doesn't require them.

---

## 2. Formatting Baseline

Formatting is enforced by **`@stylistic/eslint-plugin`** rules in `eslint.config.mjs` and by **EditorConfig**.

| Rule | Value |
|------|-------|
| Indent | 2 spaces (JSON, other files), 4 spaces (TypeScript) |
| Quotes | Single quotes |
| Semicolons | Always |
| Trailing commas | Never |
| Max line length | 120 characters (code), no limit (markdown) |
| End of file | Single newline |
| Charset | UTF-8 |
| Brace style | 1TBS (`} else {` on same line) |
| Arrow parens | Always: `(x) => x` not `x => x` |

---

## 3. Naming Conventions

### Files

| Artifact | Pattern | Example |
|----------|---------|---------|
| Service | `kebab-case.ts` | `services.ts` |
| Client/Class | `kebab-case.ts` | `client.ts` |
| Interface/Type | `kebab-case.ts` or `kebab-case.interface.ts` | `interfaces.ts` |
| Enum | `kebab-case.enum.ts` | `member-status.enum.ts` |
| Spec | `kebab-case.spec.ts` in `test/` | `disposable-email-checker.spec.ts` |
| Barrel | `index.ts` | `index.ts` |

### Identifiers

| Kind | Convention | Example |
|------|-----------|---------|
| Class | PascalCase | `DisposableEmailChecker`, `DomainListService` |
| Interface | PascalCase, no `I` prefix | `CheckerOptions`, `DomainListResult` |
| Type alias | PascalCase | `DomainListSource` |
| Enum | PascalCase name, PascalCase members | `MemberStatus.Active` |
| Enum values (stored in DB/JSON) | camelCase string | `PendingActivation = 'pendingActivation'` |
| Function | camelCase | `processDomainList()`, `fetchDomainList()` |
| Variable | camelCase | `rawKey`, `domainSet` |
| Constant | UPPER_SNAKE_CASE | `KEY_PREFIX`, `CACHE_TTL_MS` |

### Acronym casing

Treat acronyms as words — capitalize only the first letter:

```typescript
// Correct
taxonId, apiUrl, htmlParser, jsonResponse

// Wrong
taxonID, apiURL, HTMLParser, JSONResponse
```

Exception: two-letter acronyms that are universally uppercase (`IO`, `ID` in isolation) are fine when they stand alone, but inside a compound name they follow the rule: `userId` not `userID`.

### Verbosity and abbreviation

- Write out what the variable is: `scientificName` not `sciName`; `totalRecords` not `total` (unless in a scope so narrow it can't be confused).
- Common short forms that are universally understood are fine: `id`, `url`, `dto`, `ctx`, `req`, `res` — but these are the exception, not the pattern to expand from.
- When full verbosity produces genuinely long names, use judgement: `updateProjectMemberRoleRequest` is fine; adding more nesting is a signal the abstraction is wrong.

### Boolean naming

Prefix booleans with `is`, `has`, `can`, `should`, or `was`:

```typescript
const isActive = member.status === MemberStatus.Active;
const hasPermission = hasAction(Action.Read, abilities);
const canDelete = hasAnyAction([Action.Delete, Action.Admin], abilities);
```

### Private members and unused parameters

- No underscore prefix for private class members: `private active` not `private _active`.
- No leading underscore on unused parameters to silence linters — fix the lint rule or the code instead. If a parameter is genuinely required by an interface but unused, use a `// eslint-disable-next-line` comment with justification.

---

## 4. Import Ordering

Imports are grouped in this order, separated by blank lines:

1. **Third-party imports** — external npm packages
2. **Relative imports** — `./`, `../`

Within each group, sort alphabetically by module path.

```typescript
// 1. Third-party
import { someHelper } from 'some-package';

// 2. Relative
import { DomainListService } from './services';
```

### Type-only imports

Use `import type` for imports used only in type positions. This ensures they are erased at compile time:

```typescript
import type { CheckerOptions } from './interfaces';
```

---

## 5. Class Organization

Organize class members in this order:

1. **Static fields** (constants, factory methods)
2. **Instance fields** (state)
3. **Constructor**
4. **Public methods**
5. **Private methods** (grouped with `// region Private` / `// endregion` for files with 3+ private methods)

```typescript
export class DomainListService {
    // Static factory
    static async create(options: CheckerOptions): Promise<DomainListService> { ... }

    // Instance fields
    private readonly domains: Set<string>;

    // Constructor
    private constructor(domains: Set<string>) {
        this.domains = domains;
    }

    // Public methods
    isDomainDisposable(domain: string): boolean { ... }

    // region Private
    private normalizeDomain(domain: string): string { ... }
    private validateDomain(domain: string): boolean { ... }
    // endregion
}
```

---

## 6. Access Modifiers

| Context | Pattern |
|---------|---------|
| Internal helper methods | `private` |
| Public methods | Omit `public` (it is the default) |
| Constants | `private static readonly` for class-scoped; module-level `const` for file-scoped |

Never use `protected` unless designing for inheritance (which is rare in this codebase).

---

## 7. Functions & Methods

- Prefer `async/await` over raw Promises or `.then()` chains.
- Use arrow functions for callbacks and pure utility functions.
- Use method syntax for class members.
- Keep functions focused — a function should do one thing. If a method exceeds ~40 lines, consider extracting helpers.
- Return early to reduce nesting:

```typescript
// Prefer
if (!member) {
    throw new NotFoundException();
}
return this.processRequest(member);

// Avoid
if (member) {
    return this.processRequest(member);
} else {
    throw new NotFoundException();
}
```

---

## 8. Error Handling

- Services propagate errors upward — they do **not** catch and swallow. Let exceptions bubble to the caller.
- Only catch when you need to transform or enrich the error with additional context before re-throwing.

---

## 9. Exports & Module Boundaries

### Barrel files

Every directory that constitutes a module boundary should have an `index.ts` barrel:

```typescript
// Re-export everything
export * from './client';
export * from './services';

// Or use selective named exports for tighter API control
export { DisposableEmailChecker } from './client';
export type { CheckerOptions } from './interfaces';
```

---

## 10. Comments & Documentation

- Use **JSDoc** (`/** ... */`) for exported functions, public methods, and type definitions.
- Use **inline comments** (`//`) sparingly — only when the *why* isn't obvious from the code.
- Use **region comments** (`// region Name` / `// endregion`) to group private methods in large service files.
- Do not add `@author`, `@date`, or changelog comments — git history serves that purpose.
- Do not add obvious comments like `// Constructor` above a constructor.

---

## 11. Constants & Configuration

- File-scoped constants at the top of the file, before the class:

```typescript
const KEY_PREFIX = 'fc_';
const KEY_LENGTH = 32;
const CACHE_TTL_MS = 5 * 60 * 1000;

export class AppKeysService { ... }
```

- Use `as const` for literal type narrowing:

```typescript
const VALID_STATUSES = ['active', 'suspended', 'deactivated'] as const;
type Status = (typeof VALID_STATUSES)[number];
```

---

## 12. TypeScript Idioms

- Prefer `unknown` over `any`. If `any` is truly needed, the ESLint config permits it — but reach for `unknown` first.
- Use `Record<K, V>` over index signatures: `Record<string, Action[]>` not `{ [key: string]: Action[] }`.
- Use optional chaining and nullish coalescing: `member?.email ?? 'unknown'`.
- Prefer union types over enums for small, fixed sets — unless the enum is already established. Exception: namespaced string identifiers stay as string unions — their value IS the identifier.
- Use `satisfies` for type-safe object literals that should be inferred precisely:

```typescript
const config = {
    retries: 3,
    timeout: 5000,
} satisfies Partial<ClientConfig>;
```

### Null vs undefined

Use `null` for deliberate absence; use `undefined` for "not applicable / not set":

- Methods that perform a lookup and find no record return `null`: `getDomainFromEmail(email): string | null`.
- `undefined` is reserved for optional fields that were never provided.
- At the call site: `if (result === null)` means "looked it up, not found"; `if (result === undefined)` means "wasn't asked for".

---

## 13. Testing Conventions

| Area | Framework | File pattern |
|------|-----------|-------------|
| Library | Jest | `test/*.spec.ts` |

- Test files live in the `test/` directory.
- Use `describe` blocks matching the class/function name.
- Use `it` or `test` with behavior-focused descriptions: `it('should return null when domain not found')`.
- Prefer `toBe` for primitives, `toEqual` for objects, `toContain` for arrays.
- Mock at the boundary — mock external services, not internal methods.

---

## 14. Things to Avoid

- **`var`** — always `const`, then `let` if reassignment is needed.
- **Non-null assertion (`!`)** — prefer proper null checks or optional chaining.
- **Nested ternaries** — use `if/else` or extract a function.
- **Magic numbers/strings** — extract to named constants.
- **`console.log`** — remove from production code.
- **Default exports** — always use named exports.
- **Circular dependencies** — barrel files and library boundaries exist to prevent these.
- **`any` casts without justification** — the linter allows `any` but code review will question it.

---

## 15. ESLint Enforcement

`eslint.config.mjs` enforces the following rules:

| Category | Rules |
|----------|-------|
| **Style** | `@stylistic/indent`, `@stylistic/quotes`, `@stylistic/semi`, `@stylistic/comma-dangle`, `@stylistic/brace-style`, `@stylistic/arrow-parens`, `@stylistic/comma-spacing`, `@stylistic/key-spacing`, `@stylistic/keyword-spacing`, `@stylistic/space-before-blocks`, `@stylistic/space-infix-ops`, `@stylistic/object-curly-spacing`, `@stylistic/array-bracket-spacing`, `@stylistic/space-before-function-paren`, `@stylistic/type-annotation-spacing`, `@stylistic/block-spacing`, `@stylistic/no-multiple-empty-lines`, `@stylistic/eol-last`, `@stylistic/no-trailing-spaces`, `@stylistic/member-delimiter-style` |
| **TypeScript** | `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-unsafe-argument`, `@typescript-eslint/no-unsafe-assignment`, `@typescript-eslint/no-unsafe-member-access`, `@typescript-eslint/no-unsafe-return`, `@typescript-eslint/no-unsafe-call`, `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/naming-convention`, `@typescript-eslint/only-throw-error`, `@typescript-eslint/no-useless-constructor` |
| **Best practices** | `eqeqeq`, `prefer-const`, `no-var`, `curly`, `no-console`, `no-duplicate-imports`, `prefer-template`, `prefer-rest-params`, `prefer-spread`, `no-restricted-exports` |

| Command | Description |
|---------|-------------|
| `npm run lint` | Lint `src/` and `test/`, auto-fix where possible |
