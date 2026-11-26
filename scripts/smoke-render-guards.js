#!/usr/bin/env node
/**
 * Offline smoke for the crash classes that blanked golfrecon.app (#71/#72):
 * - grMemberLabel self-recursion
 * - groupsView with sparse members/missions
 * - ensureSelectedCourse when default Four Oaks id is missing
 *
 * Run: node scripts/smoke-render-guards.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function fail(msg) {
  console.error('FAIL', msg);
  process.exit(1);
}

function makePlatoonCtx(platoon) {
  const ctx = {
    console,
    Date,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    Promise,
    Error,
    URL,
    RegExp,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: {
      _d: {},
      getItem(k) {
        return this._d[k] || null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
      removeItem(k) {
        delete this._d[k];
      },
    },
    document: {
      getElementById: () => null,
      createElement: () => ({
        style: {},
        classList: { add() {}, remove() {} },
        appendChild() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        setAttribute() {},
        removeAttribute() {},
        dataset: {},
        innerHTML: '',
      }),
      body: { appendChild() {}, dataset: {}, addEventListener() {} },
      head: { appendChild() {} },
      documentElement: { dataset: {}, addEventListener() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    MutationObserver: class {
      observe() {}
    },
    matchMedia: () => ({ matches: false }),
    loadPlatoonLocal() {
      return platoon;
    },
    savePlatoonLocal() {},
    writePlatoonLocal() {},
    state: { view: 'groups' },
    render() {},
    callPlatoonFunction: async () => ({}),
    db: { player: { name: 'Mike', username: 'Sween55' }, rounds: [], courses: [], puttingDetails: [] },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  for (const f of [
    'platoon-recap-shared.js',
    'platoon-mission-core.js',
    'platoon-hq-records.js',
    'platoons-v15-real.js',
  ]) {
    vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const baseMembers = [
  { id: 'chief', name: 'Mike Sweeney', displayName: 'Sweeney', role: 'chief', linked: true },
  { id: 'sully', name: 'Ryan', displayName: 'Sully', role: 'cadet' },
];
const platoon = {
  name: 'My Time',
  motto: 'x',
  logoData: '',
  season: 2026,
  visibility: 'Private',
  chief: 'Mike',
  members: [baseMembers[0], undefined, baseMembers[1]],
  missions: [
    null,
    {
      id: 'm1',
      type: 'mission',
      status: 'completed',
      date: '2026-03-10',
      locationName: 'Candia',
      title: 'T',
      results: [],
    },
  ],
  hqMeta: {
    rosterEmails: {},
    rosterProfiles: {},
    constitution: '',
    guestPool: [],
    modes: {},
    records: [],
    eagleBalances: [],
    eagleDetails: [],
    suppressedAuto: [],
  },
};

const ctx = makePlatoonCtx(platoon);
const label = ctx.window.grMemberLabel(baseMembers[0]);
if (label !== 'Sweeney') fail(`grMemberLabel expected Sweeney, got ${label}`);
const html = ctx.groupsView();
if (!html || html.length < 100) fail('groupsView returned empty markup');
if (/Could not open this screen/i.test(html)) fail('groupsView rendered error card');

// ensureSelectedCourse logic (mirrors index.html)
let state = {
  selectedCourseId: 'four-oaks-white-18-holes',
  gameCourseId: 'four-oaks-white-18-holes',
  roundCourseId: 'four-oaks-white-18-holes',
};
const db = { courses: [{ id: 'candia', name: 'Candia' }] };
const course = (id) => db.courses.find((c) => c.id === id);
function ensureSelectedCourse() {
  const list = (db.courses || []).filter((c) => c && c.id != null && c.id !== '');
  if (!list.length) {
    state.selectedCourseId = null;
    return null;
  }
  const has = (id) => list.some((c) => String(c.id) === String(id));
  if (!has(state.selectedCourseId)) state.selectedCourseId = list[0].id;
  if (state.gameCourseId !== 'all' && !has(state.gameCourseId)) state.gameCourseId = state.selectedCourseId;
  if (state.roundCourseId !== 'all' && !has(state.roundCourseId)) state.roundCourseId = state.selectedCourseId;
  return course(state.selectedCourseId);
}
const c = ensureSelectedCourse();
if (!c || c.id !== 'candia') fail(`ensureSelectedCourse expected candia, got ${c && c.id}`);

console.log('OK smoke-render-guards');
