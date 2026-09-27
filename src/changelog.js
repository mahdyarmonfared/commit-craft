/**
 * CommitCraft Changelog Generator
 * Generates formatted Markdown changelogs from Conventional Commits history.
 */

import { getRecentCommits } from './git.js';
import { TYPE_MAP } from './formatter.js';

/**
 * Generates Markdown changelog from git history.
 * @param {object} [options={}]
 * @param {string} [options.cwd=process.cwd()]
 * @param {string} [options.version='Unreleased']
 * @param {number} [options.limit=100]
 * @returns {Promise<string>}
 */
export async function generateChangelog(options = {}) {
  const cwd = options.cwd || process.cwd();
  const version = options.version || 'Unreleased';
  const limit = options.limit || 100;

  const commits = await getRecentCommits(cwd, limit);
  if (commits.length === 0) {
    return `## [${version}] - ${new Date().toISOString().split('T')[0]}\n\nNo commits found.`;
  }

  const breaking = [];
  const groups = {
    feat: [],
    fix: [],
    perf: [],
    refactor: [],
    docs: [],
    other: []
  };

  for (const c of commits) {
    const scopePart = c.scope ? `**${c.scope}:** ` : '';
    const desc = c.description || c.message.split('\n')[0];
    const item = `- ${scopePart}${desc} ([${c.shortHash}](commit/${c.hash}))`;

    if (c.isBreaking) {
      const reason = c.breakingDescription || desc;
      breaking.push(`- **${c.scope || 'general'}:** ${reason} ([${c.shortHash}](commit/${c.hash}))`);
    }

    if (groups[c.type]) {
      groups[c.type].push(item);
    } else {
      groups.other.push(item);
    }
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const lines = [`## [${version}] - ${dateStr}\n`];

  if (breaking.length > 0) {
    lines.push('### 💥 Breaking Changes\n');
    lines.push(breaking.join('\n') + '\n');
  }

  if (groups.feat.length > 0) {
    lines.push('### ✨ Features\n');
    lines.push(groups.feat.join('\n') + '\n');
  }

  if (groups.fix.length > 0) {
    lines.push('### 🐛 Bug Fixes\n');
    lines.push(groups.fix.join('\n') + '\n');
  }

  if (groups.perf.length > 0) {
    lines.push('### ⚡ Performance Improvements\n');
    lines.push(groups.perf.join('\n') + '\n');
  }

  if (groups.refactor.length > 0) {
    lines.push('### ♻️ Code Refactoring\n');
    lines.push(groups.refactor.join('\n') + '\n');
  }

  if (groups.docs.length > 0) {
    lines.push('### 📝 Documentation\n');
    lines.push(groups.docs.join('\n') + '\n');
  }

  return lines.join('\n').trim();
}
