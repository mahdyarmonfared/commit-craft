/**
 * CommitCraft Formatter
 * Conventional Commits 1.0.0 specification formatter with optional Gitmoji integration.
 */

export const COMMIT_TYPES = [
  {
    type: 'feat',
    emoji: '✨',
    title: 'Features',
    description: 'A new user-facing feature or functionality',
    semver: 'minor'
  },
  {
    type: 'fix',
    emoji: '🐛',
    title: 'Bug Fixes',
    description: 'A bug fix or error resolution',
    semver: 'patch'
  },
  {
    type: 'docs',
    emoji: '📝',
    title: 'Documentation',
    description: 'Documentation changes or README improvements'
  },
  {
    type: 'style',
    emoji: '💄',
    title: 'Styles & Formatting',
    description: 'Code formatting, whitespace, semicolons (no logic change)'
  },
  {
    type: 'refactor',
    emoji: '♻️',
    title: 'Code Refactoring',
    description: 'Code restructuring that neither fixes a bug nor adds a feature'
  },
  {
    type: 'perf',
    emoji: '⚡',
    title: 'Performance Improvements',
    description: 'A code change that improves execution speed or memory footprint',
    semver: 'patch'
  },
  {
    type: 'test',
    emoji: '🧪',
    title: 'Tests',
    description: 'Adding missing unit/integration tests or updating tests'
  },
  {
    type: 'build',
    emoji: '🏗️',
    title: 'Build System',
    description: 'Changes that affect build tools or external dependencies (npm, vite)'
  },
  {
    type: 'ci',
    emoji: '👷',
    title: 'Continuous Integration',
    description: 'CI/CD pipeline and GitHub Actions configuration changes'
  },
  {
    type: 'chore',
    emoji: '🔧',
    title: 'Chores',
    description: 'Routine maintenance, configs, or tooling updates'
  },
  {
    type: 'revert',
    emoji: '⏪',
    title: 'Reverts',
    description: 'Reverts a previous git commit'
  }
];

export const TYPE_MAP = new Map(COMMIT_TYPES.map(t => [t.type, t]));

/**
 * Formats structured commit options into a standardized Conventional Commit string.
 * @param {object} options
 * @param {string} options.type
 * @param {string} [options.scope]
 * @param {string} options.description
 * @param {string} [options.body]
 * @param {boolean} [options.isBreaking=false]
 * @param {string} [options.breakingDescription]
 * @param {string|string[]} [options.issues]
 * @param {string|string[]} [options.coAuthors]
 * @param {boolean} [options.useGitmoji=false]
 * @returns {string}
 */
export function formatCommit(options = {}) {
  const {
    type = 'feat',
    scope = '',
    description = '',
    body = '',
    isBreaking = false,
    breakingDescription = '',
    issues = [],
    coAuthors = [],
    useGitmoji = false
  } = options;

  const cleanType = String(type).trim().toLowerCase();
  const cleanScope = String(scope).trim().toLowerCase();
  let cleanDesc = String(description).trim();

  // Remove leading type if user repeated it in description (e.g. user typed "feat: add login")
  cleanDesc = cleanDesc.replace(/^[a-z]+(\([a-z0-9_-]+\))?!?:\s*/i, '');

  const typeMeta = TYPE_MAP.get(cleanType);
  const emojiPrefix = (useGitmoji && typeMeta) ? `${typeMeta.emoji} ` : '';

  // 1. Header: <type>[optional scope][!]: [emoji ]<description>
  const scopePart = cleanScope ? `(${cleanScope})` : '';
  const breakingBang = isBreaking ? '!' : '';
  const header = `${cleanType}${scopePart}${breakingBang}: ${emojiPrefix}${cleanDesc}`;

  const sections = [header];

  // 2. Body (optional)
  const cleanBody = String(body).trim();
  if (cleanBody) {
    sections.push(cleanBody);
  }

  // 3. Footers
  const footers = [];

  // Breaking Change footer
  if (isBreaking) {
    const breakMsg = String(breakingDescription).trim() || cleanDesc;
    footers.push(`BREAKING CHANGE: ${breakMsg}`);
  }

  // Issue references (e.g. Closes #123, Fixes #456)
  const issueList = Array.isArray(issues) ? issues : [issues].filter(Boolean);
  for (const iss of issueList) {
    const raw = String(iss).trim();
    if (!raw) continue;
    if (/^(closes|fixes|resolves|refs)/i.test(raw)) {
      footers.push(raw);
    } else if (raw.startsWith('#') || /^\d+$/.test(raw)) {
      footers.push(`Closes ${raw.startsWith('#') ? raw : `#${raw}`}`);
    } else {
      footers.push(`Refs ${raw}`);
    }
  }

  // Co-authors (e.g. Co-authored-by: Name <email>)
  const coAuthorList = Array.isArray(coAuthors) ? coAuthors : [coAuthors].filter(Boolean);
  for (const ca of coAuthorList) {
    const raw = String(ca).trim();
    if (!raw) continue;
    if (raw.toLowerCase().startsWith('co-authored-by:')) {
      footers.push(raw);
    } else {
      footers.push(`Co-authored-by: ${raw}`);
    }
  }

  if (footers.length > 0) {
    sections.push(footers.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Parses an existing commit message into structured components.
 * @param {string} message
 * @returns {object}
 */
export function parseCommit(message = '') {
  if (!message || typeof message !== 'string') {
    return {
      type: '',
      scope: '',
      isBreaking: false,
      description: '',
      body: '',
      breakingDescription: '',
      issues: [],
      coAuthors: [],
      raw: ''
    };
  }

  const raw = message.trim();
  const lines = raw.split(/\r?\n/);
  const header = lines[0] || '';

  // Conventional commit regex: type(scope)!: description
  const headerMatch = header.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);

  if (!headerMatch) {
    return {
      type: '',
      scope: '',
      isBreaking: false,
      description: header,
      body: lines.slice(1).join('\n').trim(),
      breakingDescription: '',
      issues: [],
      coAuthors: [],
      raw
    };
  }

  const type = headerMatch[1].toLowerCase();
  const scope = (headerMatch[2] || '').toLowerCase();
  const hasBang = Boolean(headerMatch[3]);
  let description = headerMatch[4].trim();

  // Strip gitmoji if present in parsed description
  for (const t of COMMIT_TYPES) {
    if (description.startsWith(t.emoji)) {
      description = description.slice(t.emoji.length).trim();
      break;
    }
  }

  const remainingBlocks = lines.slice(1).join('\n').trim().split(/\n\s*\n/);
  const bodyBlocks = [];
  let breakingDescription = '';
  const issues = [];
  const coAuthors = [];
  let isBreaking = hasBang;

  for (const block of remainingBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const blockLines = trimmed.split(/\r?\n/);
    const nonFooterLines = [];

    for (let li = 0; li < blockLines.length; li++) {
      const line = blockLines[li].trim();
      if (!line) continue;

      if (line.startsWith('BREAKING CHANGE:') || line.startsWith('BREAKING-CHANGE:')) {
        isBreaking = true;
        breakingDescription = line.replace(/^BREAKING[- ]CHANGE:\s*/, '').trim();
      } else if (line.toLowerCase().startsWith('co-authored-by:')) {
        coAuthors.push(line.replace(/^co-authored-by:\s*/i, '').trim());
      } else if (/^(closes|fixes|resolves|refs)\s+[#a-zA-Z0-9_-]+/i.test(line)) {
        issues.push(line);
      } else {
        nonFooterLines.push(line);
      }
    }

    if (nonFooterLines.length > 0) {
      bodyBlocks.push(nonFooterLines.join('\n'));
    }
  }

  return {
    type,
    scope,
    isBreaking,
    description,
    body: bodyBlocks.join('\n\n'),
    breakingDescription,
    issues,
    coAuthors,
    raw
  };
}
