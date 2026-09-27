#!/usr/bin/env node

/**
 * CommitCraft CLI
 * Interactive and automated Conventional Commits builder, linter, git hook manager, and visual studio launcher.
 */

import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import { COMMIT_TYPES, TYPE_MAP, formatCommit } from '../src/formatter.js';
import { lintCommit } from '../src/linter.js';
import { isInsideGitRepo, getGitStatus, getSuggestedScopes, executeCommit, stageFiles } from '../src/git.js';
import { generateChangelog } from '../src/changelog.js';
import { startServer } from '../src/server.js';

const VERSION = '1.0.0';
const args = process.argv.slice(2);
const command = args[0] || '';

function printBanner() {
  console.log(`\x1b[36m╔════════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[1mCommitCraft v${VERSION}\x1b[0m — Conventional Commits Companion  \x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m╚════════════════════════════════════════════════════════╝\x1b[0m\n`);
}

function printHelp() {
  printBanner();
  console.log(`\x1b[1mUSAGE:\x1b[0m`);
  console.log(`  craft [command] [options]`);
  console.log(`  commit-craft [command] [options]\n`);
  console.log(`\x1b[1mCOMMANDS:\x1b[0m`);
  console.log(`  \x1b[32m(default)\x1b[0m               Launch interactive commit wizard`);
  console.log(`  \x1b[32mlint [message]\x1b[0m          Lint commit message string or file (-f)`);
  console.log(`  \x1b[32mchangelog [options]\x1b[0m     Generate formatted Markdown release changelog`);
  console.log(`  \x1b[32mhook <install|uninstall>\x1b[0m Manage git commit-msg hook`);
  console.log(`  \x1b[32mui [options]\x1b[0m            Launch visual Commit Studio (port 3009)\n`);
  console.log(`\x1b[1mOPTIONS:\x1b[0m`);
  console.log(`  \x1b[33m-t, --type <type>\x1b[0m       Commit type (feat, fix, docs, refactor, etc.)`);
  console.log(`  \x1b[33m-s, --scope <scope>\x1b[0m     Commit scope (e.g. auth, api, ui)`);
  console.log(`  \x1b[33m-m, --message <desc>\x1b[0m    Short imperative subject`);
  console.log(`  \x1b[33m-b, --body <text>\x1b[0m       Detailed description body`);
  console.log(`  \x1b[33m--breaking [desc]\x1b[0m       Mark as breaking change (!)`);
  console.log(`  \x1b[33m-i, --issues <ref>\x1b[0m      Issue tracker reference (e.g. 123, Closes #42)`);
  console.log(`  \x1b[33m--co-author <entry>\x1b[0m     Add Co-authored-by footer`);
  console.log(`  \x1b[33m--emoji\x1b[0m                 Prefix subject with Gitmoji icon`);
  console.log(`  \x1b[33m--dry-run\x1b[0m               Print formatted message without committing`);
  console.log(`  \x1b[33m-p, --port <number>\x1b[0m     Port for Web UI (default: 3009)`);
  console.log(`  \x1b[33m-v, --version\x1b[0m           Show current version`);
  console.log(`  \x1b[33m-h, --help\x1b[0m              Display this help message\n`);
  console.log(`\x1b[1mEXAMPLES:\x1b[0m`);
  console.log(`  $ craft`);
  console.log(`  $ craft -t feat -s auth -m "support oauth2 flow" --emoji`);
  console.log(`  $ craft lint "fix: resolve memory leak on exit"`);
  console.log(`  $ craft changelog -o CHANGELOG.md`);
  console.log(`  $ craft ui --port 3009\n`);
}

function ask(rl, question, defaultValue = '') {
  return new Promise(resolve => {
    const promptText = defaultValue ? `${question} \x1b[90m(${defaultValue})\x1b[0m: ` : `${question}: `;
    rl.question(promptText, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function main() {
  if (args.includes('-h') || args.includes('--help') || command === 'help') {
    printHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version') || command === 'version') {
    console.log(`commit-craft v${VERSION}`);
    process.exit(0);
  }

  // 1. Launch Web UI
  if (command === 'ui') {
    let port = 3009;
    const portIdx = args.findIndex(a => a === '-p' || a === '--port');
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10) || 3009;
    }

    printBanner();
    try {
      const { port: actualPort } = await startServer(port);
      console.log(`\x1b[32m✔\x1b[0m CommitCraft Studio running at: \x1b[1m\x1b[36mhttp://localhost:${actualPort}\x1b[0m`);
      console.log(`\x1b[90m  Press Ctrl+C to stop the studio.\x1b[0m\n`);
    } catch (err) {
      console.error(`\x1b[31m✖ Error starting studio:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2. Lint Command
  if (command === 'lint') {
    let messageToLint = '';
    const fileIdx = args.findIndex(a => a === '-f' || a === '--file');

    if (fileIdx !== -1 && args[fileIdx + 1]) {
      try {
        messageToLint = await fs.readFile(args[fileIdx + 1], 'utf-8');
      } catch (err) {
        console.error(`\x1b[31m✖ Failed to read commit message file:\x1b[0m ${err.message}`);
        process.exit(1);
      }
    } else if (args[1] && !args[1].startsWith('-')) {
      messageToLint = args.slice(1).join(' ');
    } else {
      // Check stdin if piped
      if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        messageToLint = Buffer.concat(chunks).toString('utf-8');
      }
    }

    if (!messageToLint) {
      console.error('\x1b[31m✖ Error: Missing commit message to lint.\x1b[0m');
      console.log('Usage: craft lint "feat: add user login" or craft lint -f .git/COMMIT_EDITMSG');
      process.exit(1);
    }

    const result = lintCommit(messageToLint);
    if (result.valid) {
      console.log(`\x1b[32m✔ Commit message passes Conventional Commits standard!\x1b[0m`);
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.log(`  \x1b[33m⚠ Warning:\x1b[0m ${w}`);
        }
      }
      process.exit(0);
    } else {
      console.error(`\x1b[31m✖ Commit message does not comply with Conventional Commits:\x1b[0m`);
      for (const e of result.errors) {
        console.error(`  \x1b[31m• Error:\x1b[0m ${e}`);
      }
      for (const w of result.warnings) {
        console.error(`  \x1b[33m• Warning:\x1b[0m ${w}`);
      }
      process.exit(1);
    }
  }

  // 3. Changelog Command
  if (command === 'changelog') {
    const versionIdx = args.findIndex(a => a === '--ver' || a === '--version-tag');
    const version = versionIdx !== -1 && args[versionIdx + 1] ? args[versionIdx + 1] : 'Unreleased';
    const outIdx = args.findIndex(a => a === '-o' || a === '--output');
    const outFile = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : null;

    try {
      const changelog = await generateChangelog({ version });
      if (outFile) {
        await fs.writeFile(path.resolve(process.cwd(), outFile), changelog, 'utf-8');
        console.log(`\x1b[32m✔ Changelog saved to ${outFile}\x1b[0m`);
      } else {
        console.log(changelog);
      }
    } catch (err) {
      console.error(`\x1b[31m✖ Changelog generation failed:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 4. Git Hook Manager
  if (command === 'hook') {
    const subAction = args[1] || 'install';
    const isRepo = await isInsideGitRepo();
    if (!isRepo) {
      console.error('\x1b[31m✖ Current directory is not a git repository.\x1b[0m');
      process.exit(1);
    }

    const hookDir = path.resolve(process.cwd(), '.git/hooks');
    const hookFile = path.join(hookDir, 'commit-msg');

    if (subAction === 'install') {
      const hookScript = `#!/bin/sh\n# CommitCraft Conventional Commits Hook\nnpx commit-craft lint -f "$1"\n`;
      try {
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookFile, hookScript, { mode: 0o755 });
        console.log(`\x1b[32m✔ Git commit-msg hook successfully installed at ${hookFile}\x1b[0m`);
      } catch (err) {
        console.error(`\x1b[31m✖ Hook installation failed:\x1b[0m ${err.message}`);
        process.exit(1);
      }
      return;
    }

    if (subAction === 'uninstall') {
      try {
        await fs.unlink(hookFile);
        console.log(`\x1b[32m✔ Git commit-msg hook removed.\x1b[0m`);
      } catch {
        console.log(`Hook does not exist.`);
      }
      return;
    }
  }

  // 5. Non-interactive CLI flag mode
  const typeIdx = args.findIndex(a => a === '-t' || a === '--type');
  const msgIdx = args.findIndex(a => a === '-m' || a === '--message' || a === '--desc');

  if (typeIdx !== -1 || msgIdx !== -1) {
    const type = typeIdx !== -1 ? args[typeIdx + 1] : 'feat';
    const scopeIdx = args.findIndex(a => a === '-s' || a === '--scope');
    const scope = scopeIdx !== -1 ? args[scopeIdx + 1] : '';
    const description = msgIdx !== -1 ? args[msgIdx + 1] : '';
    const bodyIdx = args.findIndex(a => a === '-b' || a === '--body');
    const body = bodyIdx !== -1 ? args[bodyIdx + 1] : '';
    const isBreaking = args.includes('--breaking');
    const issueIdx = args.findIndex(a => a === '-i' || a === '--issues');
    const issues = issueIdx !== -1 ? [args[issueIdx + 1]] : [];
    const coAuthorIdx = args.findIndex(a => a === '--co-author');
    const coAuthors = coAuthorIdx !== -1 ? [args[coAuthorIdx + 1]] : [];
    const useGitmoji = args.includes('--emoji');
    const dryRun = args.includes('--dry-run');

    const formatted = formatCommit({
      type,
      scope,
      description,
      body,
      isBreaking,
      issues,
      coAuthors,
      useGitmoji
    });

    const lint = lintCommit(formatted);
    if (!lint.valid) {
      console.error('\x1b[31m✖ Invalid commit message:\x1b[0m');
      for (const e of lint.errors) console.error(`  • ${e}`);
      process.exit(1);
    }

    if (dryRun) {
      console.log(formatted);
      return;
    }

    try {
      const res = await executeCommit(formatted);
      console.log(`\x1b[32m✔ Committed successfully!\x1b[0m [${res.hash}] ${res.summary}`);
    } catch (err) {
      console.error(`\x1b[31m✖ Git commit failed:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 6. Interactive Wizard Mode
  printBanner();

  const isRepo = await isInsideGitRepo();
  if (isRepo) {
    const { staged, unstaged, untracked } = await getGitStatus();
    console.log(`Git Working Tree: \x1b[32m${staged.length} staged\x1b[0m | \x1b[33m${unstaged.length} unstaged\x1b[0m | \x1b[90m${untracked.length} untracked\x1b[0m`);

    if (staged.length === 0) {
      console.log('\x1b[33mNotice:\x1b[0m No files are currently staged for commit.');
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('\n\x1b[1mSelect Commit Type:\x1b[0m');
    COMMIT_TYPES.slice(0, 7).forEach((t, i) => {
      console.log(`  \x1b[36m${i + 1})\x1b[0m \x1b[1m${t.type.padEnd(8)}\x1b[0m ${t.emoji}  \x1b[90m${t.description}\x1b[0m`);
    });
    console.log(`  \x1b[90mOther types: build, ci, chore, revert\x1b[0m\n`);

    const typeAnswer = await ask(rl, 'Choose type (1-7 or type name)', 'feat');
    let chosenType = 'feat';
    const numIdx = parseInt(typeAnswer, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= COMMIT_TYPES.length) {
      chosenType = COMMIT_TYPES[numIdx - 1].type;
    } else if (TYPE_MAP.has(typeAnswer.toLowerCase())) {
      chosenType = typeAnswer.toLowerCase();
    }

    // Suggested scopes
    const suggestedScopes = isRepo ? await getSuggestedScopes() : [];
    const scopePrompt = suggestedScopes.length > 0
      ? `Scope (suggested: ${suggestedScopes.join(', ')}) [optional]`
      : 'Scope (component, module, or package) [optional]';
    const chosenScope = await ask(rl, scopePrompt, '');

    const chosenDesc = await ask(rl, 'Short imperative description (e.g. add user profile page)');
    if (!chosenDesc) {
      console.error('\x1b[31m✖ Description is required.\x1b[0m');
      rl.close();
      process.exit(1);
    }

    const isBreakingAnswer = await ask(rl, 'Is this a BREAKING CHANGE? (y/N)', 'N');
    const isBreaking = isBreakingAnswer.toLowerCase().startsWith('y');
    let breakingDesc = '';
    if (isBreaking) {
      breakingDesc = await ask(rl, 'Describe the breaking change');
    }

    const chosenBody = await ask(rl, 'Longer body / motivation [optional]', '');
    const chosenIssue = await ask(rl, 'Issue reference (e.g. #123) [optional]', '');
    const chosenCoAuthor = await ask(rl, 'Co-author (Name <email>) [optional]', '');
    const useEmojiAnswer = await ask(rl, 'Add Gitmoji icon prefix? (y/N)', 'N');
    const useGitmoji = useEmojiAnswer.toLowerCase().startsWith('y');

    const formatted = formatCommit({
      type: chosenType,
      scope: chosenScope,
      description: chosenDesc,
      body: chosenBody,
      isBreaking,
      breakingDescription: breakingDesc,
      issues: chosenIssue ? [chosenIssue] : [],
      coAuthors: chosenCoAuthor ? [chosenCoAuthor] : [],
      useGitmoji
    });

    console.log(`\n\x1b[1m════════════════ Preview ════════════════\x1b[0m`);
    console.log(formatted);
    console.log(`\x1b[1m═════════════════════════════════════════\x1b[0m\n`);

    const lint = lintCommit(formatted);
    if (!lint.valid) {
      console.log('\x1b[31mWarnings / Errors:\x1b[0m');
      for (const e of lint.errors) console.log(`  • \x1b[31m${e}\x1b[0m`);
    }

    const confirmAnswer = await ask(rl, 'Execute git commit now? (Y/n)', 'Y');
    if (confirmAnswer.toLowerCase() === 'y') {
      try {
        const res = await executeCommit(formatted);
        console.log(`\x1b[32m✔ Committed successfully!\x1b[0m [${res.hash}] ${res.summary}\n`);
      } catch (err) {
        console.error(`\x1b[31m✖ Commit failed:\x1b[0m ${err.message}\n`);
      }
    } else {
      console.log(`Commit cancelled. Message formatted and ready.`);
    }
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
