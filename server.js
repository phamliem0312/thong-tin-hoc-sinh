const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STORAGE_DIR = path.join(ROOT, 'storage');
const STUDENTS_FILE = path.join(STORAGE_DIR, 'students.json');
const PORT = process.env.PORT || 8080;

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(STUDENTS_FILE)) fs.writeFileSync(STUDENTS_FILE, '[]', 'utf8');
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function readStudents() {
  const text = fs.readFileSync(STUDENTS_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(text || '[]');
  return Array.isArray(data) ? data : [];
}

function writeStudents(list) {
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

const server = http.createServer(async (req, res) => {
  ensureStorage();
  const url = new URL(req.url, 'http://localhost');
  const idMatch = url.pathname.match(/^\/api\/students\/([^/]+)$/);

  if (url.pathname === '/api/students' && req.method === 'GET') {
    try {
      sendJson(res, 200, readStudents());
    } catch (e) {
      sendJson(res, 500, { error: 'read_failed' });
    }
    return;
  }

  // Create one student. Body is a single student object (not the whole list) —
  // upserts by id so a retried/duplicate create can't produce two records.
  if (url.pathname === '/api/students' && req.method === 'POST') {
    try {
      const text = await readBody(req);
      const student = JSON.parse(text);
      if (!student || typeof student !== 'object' || Array.isArray(student) || !student.id) {
        throw new Error('invalid_body');
      }
      const list = readStudents();
      const i = list.findIndex((s) => s.id === student.id);
      if (i === -1) list.push(student);
      else list[i] = student;
      writeStudents(list);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 400, { error: 'create_failed' });
    }
    return;
  }

  // Update one student by id. Body fields are merged into the existing record
  // so a caller only needs to send what it knows/changed; the id in the URL
  // always wins over any id in the body.
  if (idMatch && req.method === 'PUT') {
    const id = decodeURIComponent(idMatch[1]);
    try {
      const text = await readBody(req);
      const patch = JSON.parse(text);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('invalid_body');
      const list = readStudents();
      const i = list.findIndex((s) => s.id === id);
      if (i === -1) {
        sendJson(res, 404, { error: 'not_found' });
        return;
      }
      list[i] = Object.assign({}, list[i], patch, { id });
      writeStudents(list);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 400, { error: 'update_failed' });
    }
    return;
  }

  // Delete one student by id. Idempotent: deleting an id that doesn't exist
  // is still a 200 (the end state the caller wants is already true).
  if (idMatch && req.method === 'DELETE') {
    const id = decodeURIComponent(idMatch[1]);
    try {
      const list = readStudents();
      writeStudents(list.filter((s) => s.id !== id));
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { error: 'delete_failed' });
    }
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end('server error');
    }
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`Sổ học phí đang chạy tại http://localhost:${PORT}`);
});
