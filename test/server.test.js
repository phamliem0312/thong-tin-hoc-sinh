const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const STORAGE_FILE = path.join(__dirname, '..', 'storage', 'students.json');
const PORT = 8791; // fixed test port, distinct from the app's default 8080

let child;
let baseUrl;

// Captured synchronously at module load, before any hook or test body runs,
// so the restore-on-after below always has the real pre-test content.
const PRE_TEST_BACKUP = fs.existsSync(STORAGE_FILE) ? fs.readFileSync(STORAGE_FILE, 'utf8') : null;

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(url).then(() => resolve()).catch((err) => {
        if (Date.now() > deadline) return reject(err);
        setTimeout(poll, 100);
      });
    })();
  });
}

test.after(() => {
  if (child) child.kill();
  if (PRE_TEST_BACKUP !== null) fs.writeFileSync(STORAGE_FILE, PRE_TEST_BACKUP, 'utf8');
  else fs.rmSync(STORAGE_FILE, { force: true });
});

test.before(async () => {
  child = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });
  baseUrl = `http://localhost:${PORT}`;
  await waitForServer(baseUrl + '/api/students', 5000);
});

test('GET / serves the app shell with 200', async () => {
  const res = await fetch(baseUrl + '/');
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('__bundler'), 'expected the bundler page shell');
});

test('GET /api/students returns an array (auto-creates storage on first run)', async () => {
  const res = await fetch(baseUrl + '/api/students');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});

test('GET /api/students tolerates a UTF-8 BOM in the storage file (e.g. hand-edited in Notepad)', async () => {
  fs.writeFileSync(STORAGE_FILE, '﻿' + JSON.stringify([{ id: 's1', name: 'BOM Test', sessions: [] }]), 'utf8');
  const res = await fetch(baseUrl + '/api/students');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data[0].name, 'BOM Test');
});

function resetStudents(list) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
}

test('POST /api/students creates one student without touching existing records', async () => {
  resetStudents([{ id: 's1', name: 'Existing', sessions: [] }]);

  const newStudent = { id: 's2', name: 'Test Nguyen', className: 'Lop 9', sessions: [] };
  const postRes = await fetch(baseUrl + '/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newStudent),
  });
  assert.equal(postRes.status, 200);
  assert.deepEqual(await postRes.json(), { ok: true });

  const data = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(data.length, 2);
  assert.deepEqual(data.find((s) => s.id === 's1'), { id: 's1', name: 'Existing', sessions: [] });
  assert.deepEqual(data.find((s) => s.id === 's2'), newStudent);
});

test('POST /api/students upserts: posting an existing id replaces that record instead of duplicating it', async () => {
  resetStudents([{ id: 's1', name: 'Old name', sessions: [] }]);

  await fetch(baseUrl + '/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 's1', name: 'New name', sessions: [] }),
  });

  const data = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(data.length, 1, 'must not create a duplicate record for the same id');
  assert.equal(data[0].name, 'New name');
});

test('POST /api/students rejects a body without an id, and rejects an array (old contract)', async () => {
  const noId = await fetch(baseUrl + '/api/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No id' }),
  });
  assert.equal(noId.status, 400);

  const arrayBody = await fetch(baseUrl + '/api/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ id: 's1' }]),
  });
  assert.equal(arrayBody.status, 400);
});

test('POST /api/students rejects malformed JSON with 400', async () => {
  const res = await fetch(baseUrl + '/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json',
  });
  assert.equal(res.status, 400);
});

test('PUT /api/students/:id merges fields into that one record, leaving other students untouched', async () => {
  resetStudents([
    { id: 's1', name: 'A', className: '9A', sessions: [] },
    { id: 's2', name: 'B', className: '9B', sessions: [] },
  ]);

  const res = await fetch(baseUrl + '/api/students/s1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 's1', name: 'A edited', className: '9A', sessions: [{ id: 'e1', content: 'x' }] }),
  });
  assert.equal(res.status, 200);

  const data = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(data.length, 2, 'PUT must not add or remove records');
  assert.equal(data.find((s) => s.id === 's1').name, 'A edited');
  assert.deepEqual(data.find((s) => s.id === 's1').sessions, [{ id: 'e1', content: 'x' }]);
  assert.deepEqual(data.find((s) => s.id === 's2'), { id: 's2', name: 'B', className: '9B', sessions: [] }, 'other student must be unchanged');
});

test('PUT /api/students/:id ignores an id in the body and always uses the URL id', async () => {
  resetStudents([{ id: 's1', name: 'A', sessions: [] }]);
  await fetch(baseUrl + '/api/students/s1', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'spoofed', name: 'A edited' }),
  });
  const data = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(data.length, 1);
  assert.equal(data[0].id, 's1');
  assert.equal(data[0].name, 'A edited');
});

test('PUT /api/students/:id returns 404 for a non-existent id', async () => {
  resetStudents([]);
  const res = await fetch(baseUrl + '/api/students/does-not-exist', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/students/:id removes only that record', async () => {
  resetStudents([{ id: 's1', name: 'A', sessions: [] }, { id: 's2', name: 'B', sessions: [] }]);
  const res = await fetch(baseUrl + '/api/students/s1', { method: 'DELETE' });
  assert.equal(res.status, 200);
  const data = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(data.length, 1);
  assert.equal(data[0].id, 's2');
});

test('DELETE /api/students/:id is idempotent for a non-existent id (still 200)', async () => {
  resetStudents([{ id: 's1', name: 'A', sessions: [] }]);
  const res = await fetch(baseUrl + '/api/students/does-not-exist', { method: 'DELETE' });
  assert.equal(res.status, 200);
  const data = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(data.length, 1, 'existing record must be untouched');
});

test('unknown route returns 404', async () => {
  const res = await fetch(baseUrl + '/does-not-exist');
  assert.equal(res.status, 404);
});
