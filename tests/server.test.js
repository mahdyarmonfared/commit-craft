import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.js';

describe('CommitCraft Server API Tests', () => {
  let server;
  let baseUrl;
  const testPort = 3693;

  before(async () => {
    server = createServer({ port: testPort, cwd: process.cwd() });
    await new Promise(resolve => server.listen(testPort, resolve));
    baseUrl = `http://localhost:${testPort}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  const request = (pathUrl, method = 'GET', body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(pathUrl, baseUrl);
      const req = http.request(url, {
        method,
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  test('GET /api/health responds with 200 OK', async () => {
    const res = await request('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'commit-craft');
  });

  test('GET /api/status returns commit types and git status', async () => {
    const res = await request('/api/status');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.types));
    assert.ok(res.body.types.length >= 10);
    assert.equal(typeof res.body.status, 'object');
  });

  test('POST /api/format returns formatted commit and linter report', async () => {
    const res = await request('/api/format', 'POST', {
      type: 'feat',
      scope: 'auth',
      description: 'add token rotation'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.formatted, 'feat(auth): add token rotation');
    assert.equal(res.body.lint.valid, true);
  });

  test('POST /api/lint checks commit validity', async () => {
    const res = await request('/api/lint', 'POST', {
      message: 'bad commit message'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, false);
    assert.ok(res.body.errors.length > 0);
  });

  test('static file serving rejects path traversal with 403', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port: testPort,
        path: '/../etc/passwd',
        method: 'GET'
      }, (r) => {
        resolve({ status: r.statusCode });
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 403);
  });
});
