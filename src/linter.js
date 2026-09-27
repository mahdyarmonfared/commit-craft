/**
 * CommitCraft Linter
 * Validates commit messages against Conventional Commits specification rules and engineering best practices.
 */

import { parseCommit, TYPE_MAP } from './formatter.js';

const PAST_TENSE_VERBS = new Set([
  'added', 'fixed', 'updated', 'changed', 'removed', 'deleted',
  'refactored', 'cleaned', 'created', 'implemented', 'improved',
  'modified', 'moved', 'corrected', 'adjusted', 'disabled', 'enabled'
]);

/**
 * Lints a commit message string.
 * @param {string} message
 * @param {object} [options={}]
 * @param {number} [options.maxHeaderLength=72]
 * @param {number} [options.minDescriptionLength=3]
 * @returns {{ valid: boolean, errors: string[], warnings: string[], parsed: object }}
 */
export function lintCommit(message = '', options = {}) {
  const maxHeaderLength = options.maxHeaderLength || 72;
  const minDescriptionLength = options.minDescriptionLength || 3;

  const errors = [];
  const warnings = [];

  const raw = String(message).trim();
  if (!raw) {
    return {
      valid: false,
      errors: ['Commit message cannot be empty'],
      warnings: [],
      parsed: parseCommit('')
    };
  }

  const lines = raw.split(/\r?\n/);
  const header = lines[0] || '';

  // 1. Header length check
  if (header.length > 100) {
    errors.push(`Header length (${header.length}) exceeds hard limit of 100 characters.`);
  } else if (header.length > maxHeaderLength) {
    warnings.push(`Header length (${header.length}) exceeds recommended limit of ${maxHeaderLength} characters.`);
  }

  // 2. Parse commit
  const parsed = parseCommit(raw);

  // 3. Type check
  if (!parsed.type) {
    errors.push('Commit message does not match Conventional Commit format: <type>(<scope>)?: <description>');
    return { valid: false, errors, warnings, parsed };
  }

  if (!TYPE_MAP.has(parsed.type)) {
    const validTypes = Array.from(TYPE_MAP.keys()).join(', ');
    errors.push(`Invalid commit type '${parsed.type}'. Valid types are: ${validTypes}`);
  }

  // 4. Scope check
  if (parsed.scope) {
    if (/\s/.test(parsed.scope)) {
      errors.push(`Scope '(${parsed.scope})' must not contain whitespace.`);
    }
    if (parsed.scope !== parsed.scope.toLowerCase()) {
      warnings.push(`Scope '(${parsed.scope})' should be lowercase.`);
    }
  }

  // 5. Description / Subject check
  if (!parsed.description) {
    errors.push('Commit description is required.');
  } else {
    if (parsed.description.length < minDescriptionLength) {
      errors.push(`Commit description is too short (min ${minDescriptionLength} characters).`);
    }

    if (parsed.description.endsWith('.')) {
      errors.push('Commit description must not end with a period (.)');
    }

    const firstChar = parsed.description.charAt(0);
    if (firstChar >= 'A' && firstChar <= 'Z') {
      warnings.push('Commit description should start with a lowercase letter.');
    }

    const firstWord = parsed.description.split(/\s+/)[0].toLowerCase();
    if (PAST_TENSE_VERBS.has(firstWord)) {
      warnings.push(`Use imperative mood: use '${firstWord.replace(/(ed|d)$/, '')}' instead of past tense '${firstWord}'.`);
    }
  }

  // 6. Blank line between header and body check
  if (lines.length > 1 && lines[1].trim() !== '') {
    warnings.push('Header and body must be separated by a blank line.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed
  };
}
