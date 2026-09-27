import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lintCommit } from '../src/linter.js';

describe('CommitCraft Linter Tests', () => {
  test('valid conventional commit passes with no errors', () => {
    const res = lintCommit('feat(auth): add google oauth2 login provider');
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  test('detects missing type or unformatted header', () => {
    const res = lintCommit('fixed bug in checkout');
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('does not match Conventional Commit format')));
  });

  test('detects invalid commit type', () => {
    const res = lintCommit('foo(core): do something');
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("Invalid commit type 'foo'")));
  });

  test('rejects whitespace in scope', () => {
    const res = lintCommit('feat(my cool scope): add something');
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('must not contain whitespace')));
  });

  test('detects trailing period in description', () => {
    const res = lintCommit('fix: resolve memory leak on exit.');
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('must not end with a period')));
  });

  test('warns when description starts with past tense verb', () => {
    const res = lintCommit('refactor: cleaned up legacy database helper');
    assert.equal(res.valid, true); // Still valid, but flags warning
    assert.ok(res.warnings.some(w => w.includes('Use imperative mood')));
  });

  test('flags hard limit error when header exceeds 100 characters', () => {
    const longHeader = 'feat(analytics): ' + 'a'.repeat(95);
    const res = lintCommit(longHeader);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('exceeds hard limit')));
  });
});
