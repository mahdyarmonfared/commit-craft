# CommitCraft ✍️⚡

> **Interactive CLI and real-time Web companion for authoring standardized Conventional Commits, git hook automation, and changelog drafting.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Tests Passing](https://img.shields.io/badge/tests-19%2F19%20passed-success.svg)](tests/)
[![Port](https://img.shields.io/badge/local%20port-3009-cyan.svg)](http://localhost:3009)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://www.conventionalcommits.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/mahdyarmonfared/commit-craft/pulls)

---

## 🎯 The Problem

Messy git commit histories create friction across engineering teams:
- Uninformative commit messages like `"update"`, `"fix"`, `"wip"`, or `"done"` make code review, git bisect, and rollback forensics impossible.
- Automating changelogs, SemVer releases (via Semantic Release or Release Please), and issue tracking requires strict compliance with the **Conventional Commits v1.0.0** specification (`feat:`, `fix:`, `docs:`, `refactor:`), yet remembering exact formatting rules and scope conventions under pressure is annoying.
- Setting up commit linters often demands heavy dependencies (`@commitlint/cli`, `@commitlint/config-conventional`, Husky) adding hundreds of node_modules packages to lightweight projects.

**CommitCraft solves this cleanly.** It gives you a zero-dependency interactive terminal wizard (`craft`), automated commit linter, native git hook installer, and an interactive dual-pane visual Web Studio on port 3009.

---

## ✨ Features

- 🧙 **Interactive Terminal Wizard (`craft`):** Guided step-by-step prompts for commit type, scope (with auto-suggested scopes based on staged files), imperative subject, breaking changes, body, issue references, and co-authors.
- ⚡ **Zero-Dependency Native Architecture:** Built using native Node.js APIs (`node:readline`, `node:http`, `node:child_process`, `node:fs/promises`) with 0 third-party runtime dependencies.
- 🎨 **Visual Web Commit Studio (Port 3009):**
  - Live split-pane visual composer with real-time formatted preview.
  - Interactive type grid with descriptions and SemVer impact indicators.
  - Staged files explorer with live status badges.
  - One-click direct commit execution or clipboard copy.
  - Gitmoji integration toggle (`✨ feat`, `🐛 fix`, `⚡ perf`, etc.).
- 🔍 **Strict Conventional Commits Linter:**
  - Validates type against standard specification.
  - Enforces header length limits (recommends $\le 72$ chars, flags $> 100$).
  - Detects past tense verbs (`"fixed"`, `"added"`) and prompts for imperative mood (`"fix"`, `"add"`).
  - Prohibits trailing periods in subjects.
  - Verifies clean blank line separation before body and footers.
- 🪝 **Native Git Hook Automation (`craft hook install`):** Sets up a `.git/hooks/commit-msg` hook to validate all standard `git commit` commands automatically across your team.
- 📜 **Automated Changelog Generator (`craft changelog`):** Scans git log and drafts structured Keep-a-Changelog Markdown grouped by Breaking Changes, Features, Fixes, and Refactoring.

---

## 🚀 Quick Start

### 1. Launch Visual Web Studio (Port 3009)

```bash
# Clone the repository
git clone https://github.com/mahdyarmonfared/commit-craft.git
cd commit-craft

# Start the Visual Studio on http://localhost:3009
node bin/commit-craft.js ui
# or
npm start
```

Open [http://localhost:3009](http://localhost:3009) in your browser.

---

### 2. Command-Line (CLI) Utilities

You can run `node bin/commit-craft.js` or link it locally via `npm link`:

```bash
# 1. Launch interactive terminal wizard
node bin/commit-craft.js

# 2. Non-interactive quick commit
node bin/commit-craft.js -t feat -s auth -m "support oauth2 login flow"

# 3. Commit with breaking change indicator
node bin/commit-craft.js -t feat -s api -m "change response envelope" --breaking "v1 schema deprecated"

# 4. Preview formatted message without committing (--dry-run)
node bin/commit-craft.js -t fix -s cache -m "evict stale tokens" --dry-run

# 5. Lint a commit message string or file
node bin/commit-craft.js lint "feat(ui): add dark mode switch"
node bin/commit-craft.js lint -f .git/COMMIT_EDITMSG

# 6. Install native Git commit-msg hook
node bin/commit-craft.js hook install

# 7. Generate release changelog from git history
node bin/commit-craft.js changelog
node bin/commit-craft.js changelog -o CHANGELOG.md
```

---

## 📋 Conventional Commit Specification Reference

CommitCraft adheres to the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/) schema:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

| Type | SemVer Impact | Description |
| :--- | :--- | :--- |
| **`feat`** | Minor (`0.x.0`) | A new user-facing feature or API capability |
| **`fix`** | Patch (`0.0.x`) | A bug fix or error resolution |
| **`docs`** | None | Documentation changes or README updates |
| **`style`** | None | Formatting, whitespace, or punctuation changes |
| **`refactor`**| None | Code change that neither fixes a bug nor adds a feature |
| **`perf`** | Patch (`0.0.x`) | Code optimization improving speed or memory |
| **`test`** | None | Adding missing tests or correcting existing tests |
| **`build`** | None | Changes to build systems or external dependencies |
| **`ci`** | None | CI/CD workflows and automated script changes |
| **`chore`** | None | Tooling, configuration, or maintenance tasks |
| **`revert`**| Varies | Reverts a previous commit |

---

## 🏗️ Architecture

```
commit-craft/
├── bin/
│   └── commit-craft.js    # Interactive CLI executable & command dispatcher
├── src/
│   ├── index.js           # Core module exports
│   ├── formatter.js       # Conventional Commits builder & parser
│   ├── linter.js          # Specification validator & heuristic checks
│   ├── git.js             # Native git status, scope auto-discovery, & commit runner
│   ├── changelog.js       # Markdown changelog generator
│   └── server.js          # REST API & static server on port 3009
├── web/
│   ├── index.html         # Split-screen visual studio workspace
│   ├── style.css          # Design tokens, dark/light theme, & responsive layout
│   └── app.js             # Reactive state, live preview, & git commit handler
├── tests/
│   ├── formatter.test.js  # Formatter and parser unit tests
│   ├── linter.test.js     # Specification linting and edge-case tests
│   ├── changelog.test.js  # Changelog generator tests
│   └── server.test.js     # REST API & security tests
└── package.json
```

---

## 🧪 Testing

CommitCraft uses the native Node.js test runner (`node:test`) with 0 external testing libraries:

```bash
npm test
```

```text
▶ CommitCraft Changelog Tests (1 test) - OK
▶ CommitCraft Formatter Tests (6 tests) - OK
▶ CommitCraft Linter Tests (7 tests) - OK
▶ CommitCraft Server API Tests (5 tests) - OK

ℹ tests 19
ℹ suites 4
ℹ pass 19
ℹ fail 0
```

---

## 📜 License

Released under the [MIT License](LICENSE).  
Copyright (c) 2026 **Mahdyar Monfared**.
