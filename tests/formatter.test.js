import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatCommit, parseCommit, COMMIT_TYPES } from '../src/formatter.js';

describe('CommitCraft Formatter Tests', () => {
  test('formats simple header with type and description', () => {
    const formatted = formatCommit({
      type: 'feat',
      description: 'add user authentication'
    });
    assert.equal(formatted, 'feat: add user authentication');
  });

  test('formats header with scope and clean lowercase handling', () => {
    const formatted = formatCommit({
      type: 'Fix',
      scope: 'AUTH',
      description: 'prevent session hijacking'
    });
    assert.equal(formatted, 'fix(auth): prevent session hijacking');
  });

  test('formats breaking change with bang and BREAKING CHANGE footer', () => {
    const formatted = formatCommit({
      type: 'feat',
      scope: 'api',
      description: 'change response envelope schema',
      isBreaking: true,
      breakingDescription: 'v1 payload shape has been deprecated'
    });

    assert.ok(formatted.startsWith('feat(api)!: change response envelope schema'));
    assert.ok(formatted.includes('BREAKING CHANGE: v1 payload shape has been deprecated'));
  });

  test('formats multi-line body, issue reference, and co-authors', () => {
    const formatted = formatCommit({
      type: 'refactor',
      scope: 'db',
      description: 'optimize query index resolution',
      body: 'Switches sequential table scans to composite index lookups.\nReduces latency by 45%.',
      issues: ['#142', 'Closes #150'],
      coAuthors: ['Sarah Connor <sarah@dev.io>']
    });

    assert.ok(formatted.includes('refactor(db): optimize query index resolution'));
    assert.ok(formatted.includes('Switches sequential table scans'));
    assert.ok(formatted.includes('Closes #142'));
    assert.ok(formatted.includes('Closes #150'));
    assert.ok(formatted.includes('Co-authored-by: Sarah Connor <sarah@dev.io>'));
  });

  test('formats with Gitmoji prefix when enabled', () => {
    const formatted = formatCommit({
      type: 'perf',
      description: 'cache parsed tokens',
      useGitmoji: true
    });
    assert.equal(formatted, 'perf: ⚡ cache parsed tokens');
  });

  test('parseCommit accurately deconstructs raw commit message', () => {
    const raw = `feat(ui)!: ✨ add dark mode toggle

Implemented CSS theme variables and persistent localStorage state.

BREAKING CHANGE: theme class names have changed from .dark-mode to .theme-dark
Closes #88
Co-authored-by: Alex Doe <alex@example.com>`;

    const parsed = parseCommit(raw);
    assert.equal(parsed.type, 'feat');
    assert.equal(parsed.scope, 'ui');
    assert.equal(parsed.isBreaking, true);
    assert.equal(parsed.description, 'add dark mode toggle');
    assert.ok(parsed.body.includes('Implemented CSS theme variables'));
    assert.ok(parsed.breakingDescription.includes('theme class names have changed'));
    assert.equal(parsed.issues.length, 1);
    assert.equal(parsed.coAuthors.length, 1);
    assert.equal(parsed.coAuthors[0], 'Alex Doe <alex@example.com>');
  });
});
