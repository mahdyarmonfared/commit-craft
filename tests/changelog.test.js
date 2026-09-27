import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateChangelog } from '../src/changelog.js';

describe('CommitCraft Changelog Tests', () => {
  test('generates markdown changelog header with version', async () => {
    const markdown = await generateChangelog({ version: '1.0.0' });
    assert.ok(markdown.includes('## [1.0.0]'));
  });
});
