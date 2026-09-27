/**
 * CommitCraft Git Integration
 * Wrapper for native Git operations: staging inspection, scope auto-detection, and commit execution.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { parseCommit } from './formatter.js';

const execAsync = promisify(exec);

/**
 * Checks if the target directory is inside a valid git repository.
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<boolean>}
 */
export async function isInsideGitRepo(cwd = process.cwd()) {
  try {
    const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', { cwd });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Gets active git staging status.
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<{ isRepo: boolean, branch: string, staged: Array<{ path: string, status: string }>, unstaged: Array<{ path: string, status: string }>, untracked: string[] }>}
 */
export async function getGitStatus(cwd = process.cwd()) {
  const isRepo = await isInsideGitRepo(cwd);
  if (!isRepo) {
    return {
      isRepo: false,
      branch: '',
      staged: [],
      unstaged: [],
      untracked: []
    };
  }

  let branch = 'unknown';
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd });
    branch = stdout.trim() || 'HEAD (detached)';
  } catch {}

  const staged = [];
  const unstaged = [];
  const untracked = [];

  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd });
    const lines = stdout.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const x = line[0]; // staged status
      const y = line[1]; // unstaged status
      const filePath = line.slice(3).trim();

      if (x === '?' && y === '?') {
        untracked.push(filePath);
      } else {
        if (x && x !== ' ' && x !== '?') {
          staged.push({ path: filePath, status: getStatusLabel(x) });
        }
        if (y && y !== ' ' && y !== '?') {
          unstaged.push({ path: filePath, status: getStatusLabel(y) });
        }
      }
    }
  } catch {}

  return {
    isRepo: true,
    branch,
    staged,
    unstaged,
    untracked
  };
}

function getStatusLabel(code) {
  switch (code) {
    case 'M': return 'modified';
    case 'A': return 'added';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'C': return 'copied';
    case 'U': return 'updated';
    default: return 'changed';
  }
}

/**
 * Suggests commit scopes based on currently staged file paths.
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<string[]>}
 */
export async function getSuggestedScopes(cwd = process.cwd()) {
  const { staged } = await getGitStatus(cwd);
  if (staged.length === 0) return [];

  const suggestions = new Set();

  for (const item of staged) {
    const p = item.path;
    const parts = p.split('/');

    if (parts.length > 1) {
      // e.g. src/auth/login.js -> 'auth' or 'src'
      if (parts[0] === 'src' && parts.length > 2) {
        suggestions.add(parts[1].toLowerCase());
      } else {
        suggestions.add(parts[0].toLowerCase());
      }
    } else {
      // Root files
      if (p.includes('package') || p.includes('pnpm') || p.includes('yarn')) suggestions.add('deps');
      else if (p.toLowerCase().includes('readme') || p.endsWith('.md')) suggestions.add('docs');
      else if (p.startsWith('.')) suggestions.add('config');
    }
  }

  return Array.from(suggestions).filter(s => s && s.length <= 15);
}

/**
 * Fetches recent git commits formatted with parsed metadata.
 * @param {string} [cwd=process.cwd()]
 * @param {number} [limit=15]
 * @returns {Promise<Array<object>>}
 */
export async function getRecentCommits(cwd = process.cwd(), limit = 15) {
  const isRepo = await isInsideGitRepo(cwd);
  if (!isRepo) return [];

  try {
    const delimiter = '---COMMITCRAFT_SEP---';
    const format = `%H%n%an%n%ar%n%B${delimiter}`;
    const { stdout } = await execAsync(`git log -n ${limit} --pretty=format:"${format}"`, { cwd });

    const rawCommits = stdout.split(delimiter).filter(c => c.trim());
    const results = [];

    for (const chunk of rawCommits) {
      const lines = chunk.trim().split(/\r?\n/);
      if (lines.length < 3) continue;

      const hash = lines[0];
      const author = lines[1];
      const timeAgo = lines[2];
      const message = lines.slice(3).join('\n').trim();

      const parsed = parseCommit(message);
      results.push({
        hash,
        shortHash: hash.slice(0, 7),
        author,
        timeAgo,
        message,
        ...parsed
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Stages files or all changes.
 * @param {string} [cwd=process.cwd()]
 * @param {string[]} [files]
 * @returns {Promise<{ success: boolean }>}
 */
export async function stageFiles(cwd = process.cwd(), files = []) {
  const target = files.length > 0 ? files.map(f => `"${f}"`).join(' ') : '-A';
  await execAsync(`git add ${target}`, { cwd });
  return { success: true };
}

/**
 * Executes a git commit with the given message safely using a temp file.
 * @param {string} message
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<{ success: boolean, hash: string, summary: string }>}
 */
export async function executeCommit(message, cwd = process.cwd()) {
  const tmpFile = path.join(os.tmpdir(), `commit-craft-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  try {
    await fs.writeFile(tmpFile, message, 'utf-8');
    const { stdout } = await execAsync(`git commit -F "${tmpFile}"`, { cwd });

    // Extract short hash and summary from stdout (e.g. "[main a1b2c3d] feat: message")
    let hash = '';
    let summary = '';
    const match = stdout.match(/\[([^\s]+)\s+([a-f0-9]+)\]\s*(.*)/i);
    if (match) {
      hash = match[2];
      summary = match[3];
    }

    return {
      success: true,
      hash,
      summary: summary || message.split('\n')[0],
      raw: stdout
    };
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}
