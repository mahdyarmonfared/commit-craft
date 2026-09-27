/**
 * CommitCraft Web Studio Application
 * Live interactive Conventional Commits composer, linter, and git execution client.
 */

let typesList = [];
let selectedType = 'feat';
let currentStatus = null;

// DOM Elements
const typeGrid = document.getElementById('typeGrid');
const inputScope = document.getElementById('inputScope');
const scopeSuggestions = document.getElementById('scopeSuggestions');
const chkGitmoji = document.getElementById('chkGitmoji');
const inputDesc = document.getElementById('inputDesc');
const charCount = document.getElementById('charCount');
const chkBreaking = document.getElementById('chkBreaking');
const inputBreakingDesc = document.getElementById('inputBreakingDesc');
const inputBody = document.getElementById('inputBody');
const inputIssues = document.getElementById('inputIssues');
const inputCoAuthor = document.getElementById('inputCoAuthor');

const commitPreview = document.getElementById('commitPreview');
const lintReport = document.getElementById('lintReport');
const btnCopyPreview = document.getElementById('btnCopyPreview');
const chkStageAll = document.getElementById('chkStageAll');
const btnCommit = document.getElementById('btnCommit');

const repoBranch = document.getElementById('repoBranch');
const stagedCountBadge = document.getElementById('stagedCountBadge');
const stagedFilesList = document.getElementById('stagedFilesList');
const historyList = document.getElementById('historyList');

const btnRefresh = document.getElementById('btnRefresh');
const btnChangelogModal = document.getElementById('btnChangelogModal');
const changelogModal = document.getElementById('changelogModal');
const changelogContent = document.getElementById('changelogContent');
const btnCloseChangelogModal = document.getElementById('btnCloseChangelogModal');
const btnCloseChangelog = document.getElementById('btnCloseChangelog');
const btnCopyChangelog = document.getElementById('btnCopyChangelog');

// Theme Elements
const btnThemeToggle = document.getElementById('btnThemeToggle');
const iconSun = document.getElementById('iconSun');
const iconMoon = document.getElementById('iconMoon');

async function init() {
  setupTheme();
  setupEvents();
  setupChangelogModal();

  await fetchStatus();
  await fetchHistory();

  updatePreview();
}

// 1. Theme Management
function setupTheme() {
  const theme = localStorage.getItem('commitcraft_theme') || 'dark';
  applyTheme(theme);

  btnThemeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('commitcraft_theme', newTheme);
  });
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    iconSun.style.display = 'none';
    iconMoon.style.display = 'block';
  } else {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    iconSun.style.display = 'block';
    iconMoon.style.display = 'none';
  }
}

// 2. Event Listeners
function setupEvents() {
  const inputs = [inputScope, inputDesc, inputBreakingDesc, inputBody, inputIssues, inputCoAuthor, chkGitmoji];
  inputs.forEach(el => {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });

  chkBreaking.addEventListener('change', () => {
    inputBreakingDesc.style.display = chkBreaking.checked ? 'block' : 'none';
    updatePreview();
  });

  btnRefresh.addEventListener('click', async () => {
    btnRefresh.classList.add('loading');
    await fetchStatus();
    await fetchHistory();
    btnRefresh.classList.remove('loading');
    showToast('Git status refreshed', 'success');
  });

  btnCopyPreview.addEventListener('click', () => {
    const text = commitPreview.textContent;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Commit message copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
  });

  btnCommit.addEventListener('click', executeCommit);
}

// 3. Data Fetching
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      typesList = data.types || [];
      currentStatus = data.status || {};

      renderTypeGrid();
      renderScopeSuggestions(data.scopes || []);
      renderGitStatus();
    }
  } catch (err) {
    showToast('Failed to connect to CommitCraft server', 'error');
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    if (res.ok) {
      const data = await res.json();
      renderHistory(data.commits || []);
    }
  } catch {}
}

// 4. Render Functions
function renderTypeGrid() {
  typeGrid.innerHTML = '';
  typesList.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `type-btn ${t.type === selectedType ? 'active' : ''}`;
    btn.dataset.type = t.type;

    btn.innerHTML = `
      <div class="type-btn-top">
        <span class="type-emoji">${t.emoji}</span>
        <span class="type-name">${t.type}</span>
      </div>
      <div class="type-desc">${t.description}</div>
    `;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = t.type;
      updatePreview();
    });

    typeGrid.appendChild(btn);
  });
}

function renderScopeSuggestions(scopes) {
  scopeSuggestions.innerHTML = '';
  scopes.forEach(sc => {
    const chip = document.createElement('span');
    chip.className = 'scope-chip';
    chip.textContent = sc;
    chip.title = `Use scope: ${sc}`;
    chip.addEventListener('click', () => {
      inputScope.value = sc;
      updatePreview();
    });
    scopeSuggestions.appendChild(chip);
  });
}

function renderGitStatus() {
  if (!currentStatus || !currentStatus.isRepo) {
    repoBranch.textContent = 'Not a Git Repository';
    stagedCountBadge.textContent = '0 Staged';
    stagedFilesList.innerHTML = `<div class="empty-state">Current directory is not a Git repo.</div>`;
    btnCommit.disabled = true;
    return;
  }

  repoBranch.textContent = `Branch: ${currentStatus.branch}`;
  const staged = currentStatus.staged || [];
  stagedCountBadge.textContent = `${staged.length} Staged`;

  stagedFilesList.innerHTML = '';
  if (staged.length === 0 && (!currentStatus.unstaged || currentStatus.unstaged.length === 0)) {
    stagedFilesList.innerHTML = `<div class="empty-state">Working tree clean (No modified files).</div>`;
    return;
  }

  // List staged files
  staged.forEach(item => {
    const div = document.createElement('div');
    div.className = 'staged-item';
    const statusLetter = item.status.charAt(0).toUpperCase();
    const statusClass = `status-${statusLetter.toLowerCase()}`;

    div.innerHTML = `
      <span>${item.path}</span>
      <span class="file-status-badge ${statusClass}">STAGED (${item.status})</span>
    `;
    stagedFilesList.appendChild(div);
  });

  // List unstaged files
  (currentStatus.unstaged || []).forEach(item => {
    const div = document.createElement('div');
    div.className = 'staged-item';
    div.innerHTML = `
      <span style="color: var(--text-secondary);">${item.path}</span>
      <span class="file-status-badge status-m">UNSTAGED (${item.status})</span>
    `;
    stagedFilesList.appendChild(div);
  });
}

function renderHistory(commits) {
  historyList.innerHTML = '';
  if (commits.length === 0) {
    historyList.innerHTML = `<div class="empty-state">No git commits found in current repository.</div>`;
    return;
  }

  commits.slice(0, 10).forEach(c => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const typeTag = c.type ? `<span class="scope-chip" style="color:var(--primary); font-weight:700;">${c.type}</span>` : '';

    item.innerHTML = `
      <div style="flex:1;">
        <div class="history-desc">${typeTag} ${c.description || c.message.split('\n')[0]}</div>
        <div class="history-meta">
          <span class="history-hash">${c.shortHash}</span>
          <span>•</span>
          <span>${c.author}</span>
          <span>•</span>
          <span>${c.timeAgo}</span>
        </div>
      </div>
    `;
    historyList.appendChild(item);
  });
}

// 5. Live Preview & Linting
async function updatePreview() {
  const desc = inputDesc.value;
  const count = desc.length;
  charCount.textContent = `${count} / 72`;

  if (count > 100) {
    charCount.className = 'char-count error';
  } else if (count > 72) {
    charCount.className = 'char-count warning';
  } else {
    charCount.className = 'char-count';
  }

  const payload = {
    type: selectedType,
    scope: inputScope.value,
    description: desc || 'short imperative description',
    body: inputBody.value,
    isBreaking: chkBreaking.checked,
    breakingDescription: inputBreakingDesc.value,
    issues: inputIssues.value ? [inputIssues.value] : [],
    coAuthors: inputCoAuthor.value ? [inputCoAuthor.value] : [],
    useGitmoji: chkGitmoji.checked
  };

  try {
    const res = await fetch('/api/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      commitPreview.textContent = data.formatted;
      renderLintReport(data.lint);
    }
  } catch {}
}

function renderLintReport(lint) {
  if (!lint) return;

  if (lint.valid && (!lint.warnings || lint.warnings.length === 0)) {
    lintReport.innerHTML = `
      <div class="lint-status status-valid">
        <span class="lint-icon">✔</span>
        <span class="lint-text">Valid Conventional Commit (100% compliant)</span>
      </div>
    `;
    btnCommit.disabled = false;
    return;
  }

  const errors = lint.errors || [];
  const warnings = lint.warnings || [];

  if (errors.length > 0) {
    lintReport.innerHTML = `
      <div class="lint-status status-invalid">
        <div style="font-weight:700;">✖ Non-Compliant Commit Message:</div>
        <ul class="lint-err-list">
          ${errors.map(e => `<li>${e}</li>`).join('')}
          ${warnings.map(w => `<li style="color:var(--warning);">Warning: ${w}</li>`).join('')}
        </ul>
      </div>
    `;
    btnCommit.disabled = true;
  } else {
    lintReport.innerHTML = `
      <div class="lint-status" style="background:var(--warning-subtle); border:1px solid rgba(245,158,11,0.3); color:var(--warning); flex-direction:column; align-items:flex-start;">
        <div style="font-weight:700;">⚠ Minor Warnings:</div>
        <ul class="lint-err-list">
          ${warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      </div>
    `;
    btnCommit.disabled = false;
  }
}

// 6. Commit Execution
async function executeCommit() {
  const message = commitPreview.textContent;
  const stageAll = chkStageAll.checked;

  btnCommit.classList.add('loading');
  btnCommit.disabled = true;

  try {
    const res = await fetch('/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stageAll })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Committed successfully! [${data.hash}]`, 'success');
      inputDesc.value = '';
      inputBody.value = '';
      inputIssues.value = '';
      chkBreaking.checked = false;
      inputBreakingDesc.style.display = 'none';

      await fetchStatus();
      await fetchHistory();
      updatePreview();
    } else {
      showToast(data.error || 'Commit failed', 'error');
    }
  } catch (err) {
    showToast('Failed to execute git commit', 'error');
  } finally {
    btnCommit.classList.remove('loading');
    btnCommit.disabled = false;
  }
}

// 7. Changelog Modal
function setupChangelogModal() {
  btnChangelogModal.addEventListener('click', async () => {
    changelogContent.textContent = 'Generating release changelog…';
    changelogModal.showModal();

    try {
      const res = await fetch('/api/changelog');
      if (res.ok) {
        const data = await res.json();
        changelogContent.textContent = data.changelog;
      } else {
        changelogContent.textContent = 'Failed to generate changelog.';
      }
    } catch {
      changelogContent.textContent = 'Error connecting to changelog API.';
    }
  });

  const closeModal = () => changelogModal.close();
  btnCloseChangelogModal.addEventListener('click', closeModal);
  btnCloseChangelog.addEventListener('click', closeModal);

  btnCopyChangelog.addEventListener('click', () => {
    navigator.clipboard.writeText(changelogContent.textContent).then(() => {
      showToast('Changelog Markdown copied to clipboard!', 'success');
    });
  });
}

// Toast helper
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

document.addEventListener('DOMContentLoaded', init);
