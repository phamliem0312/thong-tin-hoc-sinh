const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { getAppScript } = require('./extract');

// A minimal React.Component-alike so the app's class body runs unmodified.
const DCLOGIC_SHIM = `
class DCLogic {
  constructor(props) {
    this.props = props || {};
    this.__listeners = [];
  }
  setState(update, callback) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = Object.assign({}, this.state, patch);
    for (const l of this.__listeners) l();
    if (callback) callback();
  }
  onUpdate(fn) { this.__listeners.push(fn); }
}
`;

function loadSandbox({ fetchImpl } = {}) {
  const calls = { fetch: [] };
  const fetchMock = fetchImpl || (async (url, opts) => {
    calls.fetch.push({ url, opts });
    return { ok: true, json: async () => [] };
  });

  const listeners = {};
  const sandbox = {
    console,
    document: { title: 'Bundled Page' },
    window: {
      print: () => { sandbox.__printed = (sandbox.__printed || 0) + 1; },
      addEventListener: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
      removeEventListener: (name, fn) => {
        if (!listeners[name]) return;
        listeners[name] = listeners[name].filter((f) => f !== fn);
      },
      __fireEvent: (name) => { (listeners[name] || []).slice().forEach((fn) => fn()); },
    },
    fetch: (...args) => fetchMock(...args),
    Date, Math, JSON, Array, Object, Number, String, Promise, Set, Map,
  };
  vm.createContext(sandbox);

  const appScript = getAppScript();
  const exporter = `
;globalThis.__exports = { BANKS, fmtVND, dayLabelOf, chipDateOf, scoreEmoji, computeTotal, makeStudent, Component };
`;
  const full = DCLOGIC_SHIM + '\n' + appScript + '\n' + exporter;
  vm.runInContext(full, sandbox, { filename: 'app-script.js' });

  return { sandbox, exports: sandbox.__exports, calls };
}

// ---- pure helper functions ----

test('fmtVND formats VND with thousands separators and currency suffix', () => {
  const { exports: E } = loadSandbox();
  assert.equal(E.fmtVND(120000), '120.000 đ');
  assert.equal(E.fmtVND(0), '0 đ');
  assert.equal(E.fmtVND(null), '0 đ');
  assert.equal(E.fmtVND('abc'), '0 đ');
});

test('scoreEmoji buckets scores into red/yellow/green', () => {
  const { exports: E } = loadSandbox();
  assert.equal(E.scoreEmoji(''), '');
  assert.equal(E.scoreEmoji(null), '');
  assert.equal(E.scoreEmoji(4), '🔴');
  assert.equal(E.scoreEmoji(5), '🟡');
  assert.equal(E.scoreEmoji(7.9), '🟡');
  assert.equal(E.scoreEmoji(8), '🟢');
  assert.equal(E.scoreEmoji(10), '🟢');
});

test('dayLabelOf / chipDateOf handle valid and empty dates', () => {
  const { exports: E } = loadSandbox();
  assert.equal(E.dayLabelOf(''), '');
  assert.equal(E.chipDateOf('2026-09-01'), '01/09');
  assert.equal(typeof E.dayLabelOf('2026-09-01'), 'string');
  assert.notEqual(E.dayLabelOf('2026-09-01'), '');
});

test('computeTotal sums session fees, honoring per-session fee override and free flag', () => {
  const { exports: E } = loadSandbox();
  const student = {
    feePerSession: 100000,
    sessions: [
      { free: false },                    // uses feePerSession -> 100000
      { free: false, fee: 50000 },        // override -> 50000
      { free: true, fee: 999999 },        // free -> 0 regardless of fee
    ],
  };
  assert.equal(E.computeTotal(student), 150000);
  assert.equal(E.computeTotal({ sessions: [] }), 0);
  assert.equal(E.computeTotal({}), 0);
});

test('makeStudent(false) returns a blank, unvalidated student record', () => {
  const { exports: E } = loadSandbox();
  const st = E.makeStudent(false);
  assert.ok(st.id.startsWith('s'));
  assert.equal(st.name, 'Học sinh mới');
  assert.equal(st.sessions.length, 0);
  assert.equal(st.feePerSession, 120000);
});

test('makeStudent(true) returns the seeded demo record', () => {
  const { exports: E } = loadSandbox();
  const st = E.makeStudent(true);
  assert.equal(st.sessions.length, 3);
  assert.ok(st.name.length > 0);
});

// ---- Component class behavior (list/detail screens, persistence) ----

function makeComponent(fetchImpl) {
  const { exports: E, calls, sandbox } = loadSandbox({ fetchImpl });
  const c = new E.Component({});
  c.state = { students: [], activeId: null, screen: 'list', loading: true, saveStatus: 'idle', lastSavedAt: null };
  return { c, calls, sandbox };
}

test('renderVals: list screen with no students shows empty state, not loading', () => {
  const { c } = makeComponent();
  c.state.loading = false;
  const vals = c.renderVals();
  assert.equal(vals.screen.isList, true);
  assert.equal(vals.screen.isDetail, false);
  assert.equal(vals.noStudents, true);
  assert.equal(vals.hasStudents, false);
});

test('renderVals: studentList projects id/name/className/total for the roster table', () => {
  const { c } = makeComponent();
  c.state.loading = false;
  c.state.students = [
    { id: 's1', name: 'An', className: '9A', teacherName: 'GV A', month: '9/2026', feePerSession: 100000, sessions: [{ free: false }] },
  ];
  const vals = c.renderVals();
  assert.equal(vals.studentList.length, 1);
  assert.equal(vals.studentList[0].name, 'An');
  assert.equal(vals.studentList[0].totalLabel, '100.000 đ');
  assert.equal(typeof vals.studentList[0].onClick, 'function');
});

test('addStudent: appends a blank student, switches to detail screen, and POSTs only that one student (not the whole list)', async () => {
  const { c, calls } = makeComponent(async (url, opts) => {
    calls.fetch.push({ url, opts });
    return { ok: true, json: async () => [] };
  });
  c.state.students = [{ id: 'existing', name: 'Existing', sessions: [] }];
  c.addStudent();
  // setState's callback (createStudent) runs synchronously in the shim, but createStudent() itself is async.
  await new Promise((r) => setImmediate(r));
  assert.equal(c.state.students.length, 2);
  assert.equal(c.state.screen, 'detail');
  assert.equal(c.state.activeId, c.state.students[1].id);
  const postCall = calls.fetch.find((x) => x.opts && x.opts.method === 'POST');
  assert.ok(postCall, 'expected a POST to create the new student');
  assert.equal(postCall.url, '/api/students');
  const body = JSON.parse(postCall.opts.body);
  assert.equal(body.id, c.state.students[1].id, 'body must be the single new student object, not an array');
  assert.equal(Array.isArray(body), false);
});

test('removeActive: removes the active student, returns to list, and DELETEs only that student by id', async () => {
  const { c, calls } = makeComponent(async (url, opts) => {
    calls.fetch.push({ url, opts });
    return { ok: true, json: async () => [] };
  });
  c.state.students = [{ id: 's1', name: 'An', sessions: [] }, { id: 's2', name: 'Binh', sessions: [] }];
  c.state.activeId = 's1';
  c.state.screen = 'detail';
  c.removeActive();
  await new Promise((r) => setImmediate(r));
  assert.equal(c.state.students.length, 1);
  assert.equal(c.state.students[0].id, 's2');
  assert.equal(c.state.activeId, null);
  assert.equal(c.state.screen, 'list');
  const delCall = calls.fetch.find((x) => x.opts && x.opts.method === 'DELETE');
  assert.ok(delCall, 'expected a DELETE for the removed student');
  assert.equal(delCall.url, '/api/students/s1');
});

test('patchActive / patchSession edit local state WITHOUT auto-persisting (manual Save button is required)', () => {
  const { c, calls } = makeComponent();
  c.state.students = [{ id: 's1', name: 'An', feePerSession: 100000, sessions: [{ id: 'e1', content: '' }] }];
  c.state.activeId = 's1';
  c.patchActive({ name: 'An Nguyen' });
  c.patchSession('e1', { content: 'Bai 1' });
  assert.equal(c.state.students[0].name, 'An Nguyen');
  assert.equal(c.state.students[0].sessions[0].content, 'Bai 1');
  assert.equal(calls.fetch.length, 0, 'field edits must not trigger a network save by themselves');
});

test('updateStudent (Save button) PUTs only the active student to /api/students/:id and updates saveStatus', async () => {
  const { c, calls } = makeComponent(async (url, opts) => {
    calls.fetch.push({ url, opts });
    return { ok: true, json: async () => [] };
  });
  const active = { id: 's1', name: 'An', sessions: [] };
  c.state.students = [active, { id: 's2', name: 'Binh', sessions: [] }];
  await c.updateStudent(active);
  assert.equal(c.state.saveStatus, 'saved');
  assert.equal(calls.fetch.length, 1);
  assert.equal(calls.fetch[0].url, '/api/students/s1');
  assert.equal(calls.fetch[0].opts.method, 'PUT');
  const body = JSON.parse(calls.fetch[0].opts.body);
  assert.equal(body.id, 's1');
});

test('updateStudent sets saveStatus to error when the server responds not-ok', async () => {
  const { c } = makeComponent(async () => ({ ok: false, json: async () => ({}) }));
  await c.updateStudent({ id: 's1', sessions: [] });
  assert.equal(c.state.saveStatus, 'error');
});

test('renderVals: onSave calls updateStudent with the currently active student', async () => {
  const { c, calls } = makeComponent(async (url, opts) => {
    calls.fetch.push({ url, opts });
    return { ok: true, json: async () => [] };
  });
  c.state.loading = false;
  c.state.students = [{ id: 's1', name: 'An', sessions: [] }];
  c.state.activeId = 's1';
  c.state.screen = 'detail';
  const vals = c.renderVals();
  await vals.onSave();
  assert.equal(calls.fetch[0].url, '/api/students/s1');
  assert.equal(calls.fetch[0].opts.method, 'PUT');
});

test('loadStudents populates students from GET /api/students and clears loading', async () => {
  const { c, calls } = makeComponent(async (url) => {
    calls.fetch.push({ url });
    return { ok: true, json: async () => [{ id: 's1', name: 'An', sessions: [] }] };
  });
  await c.loadStudents();
  assert.equal(c.state.loading, false);
  assert.equal(c.state.students.length, 1);
  assert.equal(calls.fetch[0].url, '/api/students');
});

test('doPrint calls window.print without throwing', () => {
  const { c } = makeComponent();
  assert.doesNotThrow(() => c.doPrint());
});

test('doPrint sets document.title to "<name> - Thang <month>" for the PDF filename, sanitizing unsafe filename characters', () => {
  const { c, sandbox } = makeComponent();
  c.state.students = [{ id: 's1', name: 'Nguyễn Văn A', month: '8/2026', sessions: [] }];
  c.state.activeId = 's1';
  c.doPrint();
  assert.equal(sandbox.document.title, 'Nguyễn Văn A - Thang 8-2026', 'the "/" in the month must be sanitized out of the filename');
});

test('doPrint restores the original document.title after the print dialog closes (afterprint)', () => {
  const { c, sandbox } = makeComponent();
  sandbox.document.title = 'Bundled Page';
  c.state.students = [{ id: 's1', name: 'An', month: '9/2026', sessions: [] }];
  c.state.activeId = 's1';
  c.doPrint();
  assert.notEqual(sandbox.document.title, 'Bundled Page', 'title should be swapped to the print filename during print');
  sandbox.window.__fireEvent('afterprint');
  assert.equal(sandbox.document.title, 'Bundled Page', 'title should be restored once printing is done');
});

test('doPrint leaves document.title untouched when there is no active student', () => {
  const { c, sandbox } = makeComponent();
  sandbox.document.title = 'Bundled Page';
  c.state.students = [];
  c.state.activeId = null;
  c.doPrint();
  assert.equal(sandbox.document.title, 'Bundled Page');
});
