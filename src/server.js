/**
 * CommitCraft Web Server & REST API
 * Provides HTTP endpoints and serves the visual Commit Studio on port 3009.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMIT_TYPES, formatCommit } from './formatter.js';
import { lintCommit } from './linter.js';
import { getGitStatus, getSuggestedScopes, getRecentCommits, stageFiles, executeCommit, isInsideGitRepo } from './git.js';
import { generateChangelog } from './changelog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.resolve(__dirname, '../web');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/**
 * Creates and configures the CommitCraft HTTP server.
 * @param {object} [options]
 * @returns {http.Server}
 */
export function createServer(options = {}) {
  const cwd = options.cwd || process.cwd();

  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify(data));
    };

    const readBody = async () => {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        return { raw };
      }
    };

    try {
      // 1. Health check
      if (pathname === '/api/health') {
        return sendJson(200, {
          status: 'ok',
          service: 'commit-craft',
          port: options.port || 3009,
          cwd,
          timestamp: new Date().toISOString()
        });
      }

      // 2. Git Status & Types Metadata
      if (pathname === '/api/status' && req.method === 'GET') {
        const status = await getGitStatus(cwd);
        const scopes = await getSuggestedScopes(cwd);
        return sendJson(200, {
          types: COMMIT_TYPES,
          scopes,
          status
        });
      }

      // 3. Format Commit
      if (pathname === '/api/format' && req.method === 'POST') {
        const body = await readBody();
        const formatted = formatCommit(body);
        const lint = lintCommit(formatted);
        return sendJson(200, {
          formatted,
          lint
        });
      }

      // 4. Lint Commit
      if (pathname === '/api/lint' && req.method === 'POST') {
        const body = await readBody();
        const result = lintCommit(body.message || '');
        return sendJson(200, result);
      }

      // 5. Stage Files
      if (pathname === '/api/stage' && req.method === 'POST') {
        const body = await readBody();
        await stageFiles(cwd, body.files || []);
        const status = await getGitStatus(cwd);
        return sendJson(200, { success: true, status });
      }

      // 6. Execute Commit
      if (pathname === '/api/commit' && req.method === 'POST') {
        const body = await readBody();
        const message = body.message;

        if (!message || !message.trim()) {
          return sendJson(400, { error: 'Commit message cannot be empty' });
        }

        const isRepo = await isInsideGitRepo(cwd);
        if (!isRepo) {
          return sendJson(400, { error: 'Current directory is not a git repository' });
        }

        if (body.stageAll) {
          await stageFiles(cwd);
        }

        const gitStatus = await getGitStatus(cwd);
        if (gitStatus.staged.length === 0) {
          return sendJson(400, { error: 'No staged changes to commit. Stage files first or check "Stage all changes".' });
        }

        const result = await executeCommit(message, cwd);
        return sendJson(200, result);
      }

      // 7. Recent Commits History
      if (pathname === '/api/history' && req.method === 'GET') {
        const commits = await getRecentCommits(cwd, 25);
        return sendJson(200, { commits });
      }

      // 8. Generate Changelog
      if (pathname === '/api/changelog' && req.method === 'GET') {
        const changelog = await generateChangelog({ cwd });
        return sendJson(200, { changelog });
      }

      // 9. Static File Serving with Path Traversal Protection
      if (req.url.includes('..') || /%2e/i.test(req.url)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Access Denied');
      }

      let decodedPath = '';
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Bad Request');
      }

      const safePath = path.resolve(WEB_DIR, '.' + decodedPath);
      if (!safePath.startsWith(WEB_DIR + path.sep) && safePath !== path.join(WEB_DIR, 'index.html')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Access Denied');
      }

      try {
        const stat = await fs.stat(safePath);
        let targetFile = safePath;
        if (stat.isDirectory()) {
          targetFile = path.join(safePath, 'index.html');
        }
        const data = await fs.readFile(targetFile);
        const ext = path.extname(targetFile).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      }
    } catch (err) {
      sendJson(500, { error: err.message || 'Internal server error' });
    }
  });
}

/**
 * Starts the CommitCraft server on the specified port.
 * @param {number} [port=3009]
 * @param {object} [options={}]
 * @returns {Promise<{ server: http.Server, port: number }>}
 */
export function startServer(port = 3009, options = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer({ port, ...options });
    server.listen(port, () => {
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}
