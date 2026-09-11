const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { getTemplateHtml, getAppScript, INDEX_PATH } = require('./extract');

test('index.html: bundler template script is valid JSON', () => {
  const html = getTemplateHtml();
  assert.ok(html.length > 1000, 'decoded template should be substantial');
});

test('index.html: sc-if / sc-for / style tags are balanced', () => {
  const html = getTemplateHtml();
  const count = (re) => (html.match(re) || []).length;
  assert.equal(count(/<sc-if\b/g), count(/<\/sc-if>/g), 'sc-if open/close mismatch');
  assert.equal(count(/<sc-for\b/g), count(/<\/sc-for>/g), 'sc-for open/close mismatch');
  assert.equal(count(/<style/g), count(/<\/style>/g), 'style open/close mismatch');
});

test('index.html: no leftover references to removed identifiers', () => {
  const html = getTemplateHtml();
  for (const dead of ['studentTabs', 'hasActive', 'view.isSummary', 'view.isLog', 'onOpenExisting', 'onChooseNew', 'onGrantPermission', 'fileUI.']) {
    assert.ok(!html.includes(dead), `found leftover reference to "${dead}"`);
  }
});

test('index.html: required UI markers are present', () => {
  const html = getTemplateHtml();
  const markers = [
    'Danh sách học sinh',
    '+ Thêm học sinh',
    'onSave',
    'onBackToList',
    'data-screen-label="summary"',
    'data-screen-label="log"',
    'onFooterNote',
  ];
  for (const m of markers) {
    assert.ok(html.includes(m), `missing expected marker: ${m}`);
  }
});

test('index.html: session log renders before the footer note (log moved above footer)', () => {
  const html = getTemplateHtml();
  const logIdx = html.indexOf('data-screen-label="log"');
  const footerIdx = html.indexOf('onFooterNote');
  assert.ok(logIdx !== -1 && footerIdx !== -1, 'both markers must exist');
  assert.ok(logIdx < footerIdx, 'log block must appear before the footer note in source order');
});

test('index.html: restyle tokens are present, old flat-blueprint override is gone', () => {
  const html = getTemplateHtml();
  assert.ok(html.includes('--color-card'), 'missing new --color-card token');
  assert.ok(html.includes('--radius-lg: 16px'), 'missing updated radius scale');
  assert.ok(!html.includes('.card, .btn, .input, .tag, .seg, .dialog { border-radius: 0; }'), 'old zero-radius override should be removed');
});

test('index.html: app script has valid JS syntax (node --check)', () => {
  const js = getAppScript();
  const tmp = path.join(require('node:os').tmpdir(), `hocphi-app-script-${Date.now()}.js`);
  fs.writeFileSync(tmp, js, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('server.js has valid JS syntax (node --check)', () => {
  const serverPath = path.join(path.dirname(INDEX_PATH), 'server.js');
  execFileSync(process.execPath, ['--check', serverPath], { stdio: 'pipe' });
});
