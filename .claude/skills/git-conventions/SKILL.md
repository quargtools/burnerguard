---
name: git-conventions
description: >
  Enforces Conventional Commits naming conventions across all git and GitHub
  artifacts. Use this skill whenever the user asks you to write a commit
  message, name a branch, draft a PR title, write a GitHub issue title, or
  review/suggest any git-related naming. Also trigger when the user says "make
  a commit", "open a PR", "create an issue", "what should I call this branch",
  or anything that involves naming a unit of work in git or GitHub — even if
  they don't say "conventional commits". If there's any chance a git artifact
  needs a name, apply this skill.
---

# Git Naming Conventions

All git and GitHub artifact names — commit messages, branch names, PR titles,
and issue titles — follow **Conventional Commits** format. Applying this
consistently makes history scannable, enables automated tooling (changelogs,
semantic versioning), and signals intent at a glance.

---

## Format

```
type(scope): short description
```

- **type** — what kind of change (required)
- **scope** — the area of the codebase affected (optional, but use it when clear)
- **short description** — imperative-mood summary of the change (required)

### Valid types

| Type       | When to use                                             |
|------------|---------------------------------------------------------|
| `feat`     | New user-facing feature or capability                   |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `refactor` | Code restructuring with no behavior change              |
| `test`     | Adding or updating tests                                |
| `chore`    | Build process, tooling, dependency updates              |
| `perf`     | Performance improvement                                 |
| `ci`       | CI/CD pipeline changes                                  |

When in doubt between `feat` and `refactor`, ask: does it change what the user
can do? If yes → `feat`. If the behavior is identical but internals changed →
`refactor`.

---

## Short description rules

1. **Imperative mood** — write as a command: "add", "fix", "update", not "adds", "fixed", "updating"
2. **Lowercase first letter** — `feat(auth): add OAuth2 support` not `Add OAuth2 support`
3. **No trailing period**
4. **Keep it under ~72 characters total** (including `type(scope): `)
5. **Be specific** — the description should tell someone what changed, not just that something changed

---

## Artifact-specific rules

### Commit messages
```
type(scope): short description
```
Optionally add a blank line followed by a longer body for context. The subject
line (first line) must follow the format above.

### Branch names
```
type/short-hyphenated-description
```
Use hyphens, not underscores or spaces. Keep it short enough to type. The type
prefix uses a slash separator (not a colon).

### PR titles and GitHub issue titles
Same format as commit messages:
```
type(scope): short description
```

---

## Examples

### Commit messages
```
feat(auth): add OAuth2 login support
fix(api): handle null response from payment gateway
docs(readme): update local dev setup instructions
refactor(db): extract connection pool into separate module
test(auth): add unit tests for token refresh logic
chore(deps): upgrade eslint to v9
perf(cache): reduce Redis round trips on session lookup
ci(deploy): add staging environment to release pipeline
```

### Branch names
```
feat/auth-oauth2-support
fix/payment-null-response
docs/update-readme-setup
refactor/db-connection-pool
test/auth-token-refresh
chore/upgrade-eslint-v9
```

### PR and issue titles
```
feat(auth): add OAuth2 login support
fix(api): handle null response from payment gateway
chore(deps): upgrade eslint to v9
```

---

## What NOT to do

These patterns are wrong — never produce them:

| Wrong                              | Problem                                      |
|------------------------------------|----------------------------------------------|
| `[feat] add oauth`                 | Square brackets — non-standard, never use    |
| `Add new feature`                  | Missing type prefix                          |
| `fixed stuff`                      | Vague, no type, past tense                   |
| `feat: Added OAuth2 Login Support.`| Past tense, capitalized, trailing period     |
| `feature/add-oauth2`               | Branch type should be `feat`, not `feature`  |
| `WIP: auth changes`                | Not conventional commits format              |
| `FEAT(AUTH): Add OAuth2`           | Types and scopes should be lowercase         |
| `fix: fix the bug`                 | Description restates the type — be specific  |

---

## Scope guidance

Scope is the module, layer, or area most affected. Good scopes are short,
consistent nouns derived from your codebase structure:

- **Component/module**: `auth`, `api`, `db`, `cache`, `ui`
- **Config/build area**: `deps`, `config`, `ci`, `docker`
- **Tooling/meta directories**: use the name without any leading dot — `claude` not `.claude`, `github` not `.github`
- **Cross-cutting**: omit scope entirely when the change spans many areas

Don't invent a unique scope per commit — scopes should be a small, stable
vocabulary that means something to the whole team.

---

## When the user gives you raw context

If the user describes what they did (e.g. "I added a dark mode toggle to the
settings page"), derive the right format:

- Identify the type (new capability → `feat`)
- Identify the scope from the description (`settings` or `ui`)
- Write a specific, imperative description ("add dark mode toggle to settings")

Result: `feat(settings): add dark mode toggle`
