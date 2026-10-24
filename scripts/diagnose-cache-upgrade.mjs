/**
 * Bounded SW upgrade mechanism diagnosis, not a deployment/visual acceptance test.
 * Run: node scripts/diagnose-cache-upgrade.mjs [--prior <failed-result.json>]
 * One combined bounded scenario; optional prior failed attempt is retained and
 * total browser scenario attempts must be <=2. No downloads/user browser profile.
 * Only writes this report and its own .tmp/cover-cache-upgrade-* evidence directory.
 * Uses the actual release SW generator and the actual old production registration
 * branch; HTML/App/music are deliberately tiny fixtures (see report boundaries).
 */
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {resolve, join, relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import config from '../playwright.config.ts';

const reportPath = resolve('docs/metrics/cover-cache-upgrade-diagnosis.json');
const root = resolve(`.tmp/cover-cache-upgrade-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
const scope = '/cover-cache-upgrade/';
const oldCommit = '7c8b31c';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, {encoding: 'utf8', timeout: 5000}).trimEnd();
const json = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const cases = [{name: 'combined-music-query-and-old-dom-upgrade', holdMusic: true}];
const priorArg = process.argv.indexOf('--prior');
const priorPath = priorArg < 0 ? null : process.argv[priorArg + 1];
if (priorArg >= 0 && !priorPath) throw new Error('--prior requires a retained result.json path');
const priorBytes = priorPath ? await readFile(priorPath) : null;
const priorReport = priorBytes ? JSON.parse(priorBytes.toString()) : null;
const priorCaseCount = priorReport?.cases?.length ?? 0;
if (priorCaseCount + cases.length > 2) throw new Error('At most two total browser scenario attempts allowed');
const upgradeQuery = '?v=cover-7cab52f';
const bounds = {launchMs: 12000, contextMs: 5000, navigationMs: 7000, transitionMs: 9000, gateMaxMs: 12000, heldObservationMs: 1000, perCaseMs: 30000, overallMs: 75000, cleanupMs: 4000, responseBytesMax: 65536};
const bounded = (promise, ms, label) => {
 let timer;
 return Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error(`${label}: exceeded ${ms}ms`)), ms);})]).finally(() => clearTimeout(timer));
};
function check(condition, message) {if (!condition) throw new Error(message);}
async function pollTrue(read, label) {
 const end = Date.now() + bounds.transitionMs;
 for (let i = 0; i < 180 && Date.now() < end; i++) {
  if (await bounded(read(), Math.max(1, end - Date.now()), `${label} read`)) return;
  await delay(50);
 }
 throw new Error(`${label}: awaited condition never became true within ${bounds.transitionMs}ms`);
}
function gate(label) {
 let open, enter;
 const g = {label, released: false, enteredAt: null, promise: new Promise(r => {open = r;}), entered: new Promise(r => {enter = r;})};
 g.markEntered = () => {if (g.enteredAt === null) {g.enteredAt = Date.now(); enter();}};
 g.release = () => {if (!g.released) {g.released = true; clearTimeout(g.timer); open();}};
 // Safety release is recorded as failure, never silently accepted as a result.
 g.timer = setTimeout(() => {g.safetyReleased = true; g.release();}, bounds.gateMaxMs);
 return g;
}

const oldMain = git('show', `${oldCommit}:src/main.ts`);
const currentMain = await readFile('src/main.ts', 'utf8');
function registrationBranch(source) {
 const marker = "}else if('serviceWorker' in navigator){";
 check(source.split(marker).length === 2, 'Registration fixture extraction no longer matches source');
 const branch = source.slice(source.indexOf(marker) + '}else '.length).trimEnd();
 check(branch.includes('if(reg.active) return;'), 'Expected inspected active-registration early return');
 check(!branch.includes('controllerchange'), 'Source changed: reassess fixture and expectations');
 return branch;
}
const oldRegistration = registrationBranch(oldMain);
check(oldRegistration === registrationBranch(currentMain), 'Old/current production registration branches differ');
const sources = {};
for (const path of ['src/main.ts', 'scripts/generate-sw.mjs', 'scripts/sw-cache.mjs', 'playwright.config.ts']) {
 sources[path] = {sha256: sha256(await readFile(path))};
}
for (const path of ['scripts/generate-sw.mjs', 'scripts/sw-cache.mjs']) {
 sources[path].sameAsOldCommit = git('show', `${oldCommit}:${path}`) === (await readFile(path, 'utf8')).trimEnd();
 check(sources[path].sameAsOldCommit, `Old/current ${path} differ; reassess fixture`);
}
await mkdir(root, {recursive: true});
const report = {
 generatedAt: new Date().toISOString(), agent: 'debugger', command: [process.execPath, ...process.argv.slice(1)].join(' '),
 executionHistory: {totalBrowserScenarioAttempts: priorCaseCount + cases.length, currentScenarioCount: cases.length, prior: priorReport ? {path: priorPath, sha256: sha256(priorBytes), status: priorReport.status, evidenceDirectory: priorReport.evidenceDirectory, runnerSha256: priorReport.runnerSha256, cases: priorReport.cases.map(c => ({name: c.name, status: c.status, failure: c.failure})), invalidation: 'Diagnostic harness error: this installed Playwright waitForFunction treats a returned Promise as truthy before its boolean resolution; seed snapshot active=null/installing=installing proves the old SW was NOT ready. No product upgrade conclusion from this attempt. Fixed using bounded Node-side polling that awaits each page.evaluate result; not rerun as a separate normal scenario.', implementationEvidence: 'node_modules/playwright-core/lib/coreBundle.js waitForFunctionExpression: const success=predicate(); if(success) fulfill(success) without awaiting predicate.'} : null},
 localHead: git('rev-parse', 'HEAD'), oldCommit: git('rev-parse', oldCommit), newCoverCommit: git('rev-parse', '7cab52f'),
 deployment: {suppliedHead: 'e166642', suppliedSuccessfulActionsRun: '40058184203', independentlyVerifiedHere: false, parentReport: 'docs/metrics/cover-live-recheck.json', parentResult: 'Network/fresh browser passed; deployed index-BExlH8Ov.js matches dist. No public requests in this runner.'},
 evidenceDirectory: relative(process.cwd(), root).replaceAll('\\', '/'), sources,
 registration: {source: `${oldCommit}:src/main.ts production branch`, sha256: sha256(oldRegistration), matchesCurrent: true, file: 'production-registration.js'},
 bounds, status: 'running', cases: [],
 method: {
  faithful: ['Real browser ServiceWorker/CacheStorage, not mocked APIs.', 'Exact current scripts/generate-sw.mjs, run twice in owned temporary cwd with tiny old/new dist trees; generator and sw-cache.mjs equal old commit.', 'Exact extracted old production registration branch; only import.meta.env.BASE_URL substituted with fixture scope.', 'Cache-first exact URLs, directory alias, whole-release addAll including five music files, skipWaiting, old-cache deletion and clients.claim are unmodified generated code.', 'Same SW URL and scope across releases, hashed main/CSS names, fresh isolated context per case; no user browser caches touched.'],
  boundaries: ['HTML and App are marker-only substitutes: DOM/main/CSS versions and toast calls, not real cover rendering or gameplay.', 'Five music payloads are tiny invalid placeholder bytes; they are precached but never played. No real transfer-size/codec/performance claims.', 'A bounded server-side gate delays sw.js until first-reload snapshot, to make update timing deterministic; explicit registration.update() then requests discovery. This does not measure automatic browser update-check latency.', 'The combined scenario delays one new music response, opens a second tab at the query upgrade entry under the old worker, then releases music. The original tab is preserved to measure old DOM after activation and a subsequent reload. This proves a dependency/bypass, not actual user installation duration.', 'All HTTP responses are Cache-Control: no-store. This rules HTTP cache out of this local reproduction; it does not test or exonerate GitHub/CDN/user HTTP caches.', 'Old hashed fixture assets remain available as fallback on the local server. GitHub release artifact retention is not simulated; no multi-tab/update-during-battle compatibility claim.'],
  expected: 'After new SW activates/claims, the already loaded document remains old. A later navigation/reload after activation should load new cached HTML/main/CSS.',
  resources: 'One ephemeral loopback server only, closed in finally; no interaction with existing 4199 or other servers; no build of repository dist.'
 }
};
await writeFile(join(root, 'production-registration.js'), oldRegistration);

async function buildFixture(version) {
 const cwd = join(root, version), dist = join(cwd, 'dist');
 await mkdir(join(dist, 'assets'), {recursive: true});
 await mkdir(join(dist, 'audio'), {recursive: true});
 const mainFile = `assets/main-${version}.js`, cssFile = `assets/cover-${version}.css`;
 const main = `const app={toast(message){window.__coverDiag.toasts.push(message);}};\nwindow.__coverDiag.mainVersion=${JSON.stringify(version)};\n` + oldRegistration.replaceAll('${import.meta.env.BASE_URL}', scope);
 const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="fixture-release" content="${version}"><link rel="stylesheet" href="./${cssFile}"><script type="module" src="./${mainFile}"></script></head><body data-release="${version}"><h1>${version} cover fixture</h1><div id="app">${version}</div></body></html>`;
 await writeFile(join(dist, 'index.html'), html);
 await writeFile(join(dist, mainFile), main);
 await writeFile(join(dist, cssFile), `:root{--fixture-release:${version}} body{color:${version === 'old' ? '#300' : '#030'}}`);
 const audioNames = (await readdir('public/audio')).filter(n => /\.(mp3|ogg|wav)$/.test(n)).sort();
 check(audioNames.length === 5, 'Expected five inspected music files');
 for (const file of audioNames) await writeFile(join(dist, 'audio', file), `diagnostic placeholder; version=${version}; file=${file}\n`);
 const stdout = execFileSync(process.execPath, [resolve('scripts/generate-sw.mjs')], {cwd, encoding: 'utf8', timeout: 5000});
 const sw = await readFile(join(dist, 'sw.js'), 'utf8');
 const cacheName = /const CACHE='([^']+)'/.exec(sw)?.[1];
 check(cacheName, 'Generated fixture SW has no release cache name');
 const files = new Map();
 for (const file of ['index.html', mainFile, cssFile, 'sw.js', ...audioNames.map(n => `audio/${n}`)]) {
  const bytes = await readFile(join(dist, file));
  check(bytes.length <= bounds.responseBytesMax, 'Fixture unexpectedly large');
  files.set(file, bytes);
 }
 return {version, cacheName, files, mainFile, cssFile, generation: stdout.trim(), swSha256: sha256(sw)};
}

let browser, context, server, state;
let overallTimer;
const serverRequests = [];
try {
 const fixtures = {old: await buildFixture('old'), new: await buildFixture('new')};
 report.fixtures = Object.fromEntries(Object.entries(fixtures).map(([key, f]) => [key, {cacheName: f.cacheName, swSha256: f.swSha256, generation: f.generation, fileCount: f.files.size, byteCount: [...f.files.values()].reduce((n, b) => n + b.length, 0)}]));
 server = createServer(async (req, res) => {
  const row = {at: new Date().toISOString(), scenario: state?.name, deployment: state?.version, method: req.method, path: req.url, headers: req.headers};
  serverRequests.push(row);
  try {
   const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
   if (!state || !pathname.startsWith(scope)) {res.writeHead(404); res.end(); return;}
   const file = pathname.slice(scope.length) || 'index.html';
   const version = state.version;
   if (version === 'new' && file === 'sw.js') {state.workerGate.markEntered(); await state.workerGate.promise;}
   if (version === 'new' && state.musicGate && file === 'audio/war_theme.ogg') {state.musicGate.markEntered(); await state.musicGate.promise;}
   const bytes = fixtures[version].files.get(file) ?? fixtures.old.files.get(file);
   if (!bytes) {res.writeHead(404, {'Cache-Control': 'no-store'}); res.end(); return;}
   const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream';
   const headers = {'Cache-Control': 'no-store', 'Content-Type': type, 'Content-Length': bytes.length};
   if (file === 'sw.js') headers['Service-Worker-Allowed'] = scope;
   row.responseAt = new Date().toISOString(); row.status = 200; row.bytes = bytes.length; row.responseHeaders = headers;
   res.writeHead(200, headers); res.end(bytes);
  } catch (error) {row.error = String(error); res.destroy(error);}
 });
 server.requestTimeout = 15000; server.headersTimeout = 16000;
 await bounded(new Promise((r, j) => {server.once('error', j); server.listen(0, '127.0.0.1', r);}), 3000, 'server listen');
 const address = server.address();
 check(address.port !== 4199, 'Do not use existing 4199 port');
 const url = `http://127.0.0.1:${address.port}${scope}`;
 const launchOptions = {...config.use.launchOptions, headless: config.use.headless, timeout: bounds.launchMs};
 report.browser = {configuredBy: 'playwright.config.ts use.launchOptions/headless/viewport (actual local selection, no download)', launchOptions, viewport: config.use.viewport, executablePath: launchOptions.executablePath ?? chromium.executablePath()};
 report.url = url;
 browser = await chromium.launch(launchOptions);
 report.browser.version = browser.version();
 overallTimer = setTimeout(() => {report.overallDeadlineExpired = true; state?.workerGate?.release(); state?.musicGate?.release(); void browser.close(); server.closeAllConnections();}, bounds.overallMs);

 for (const spec of cases) {
  const item = {name: spec.name, startedAt: new Date().toISOString(), snapshots: [], workerVersions: [], responses: [], cdpResponses: [], errors: []};
  report.cases.push(item);
  state = {name: spec.name, version: 'old'};
  context = await bounded(browser.newContext({viewport: config.use.viewport, serviceWorkers: 'allow'}), bounds.contextMs, 'context creation');
  const thisContext = context;
  const caseTimer = setTimeout(() => {item.deadlineExpired = true; state.workerGate?.release(); state.musicGate?.release(); void thisContext.close();}, bounds.perCaseMs);
  try {
   await context.addInitScript(() => {
    window.__coverDiag = {documentId: crypto.randomUUID(), mainVersion: null, toasts: [], events: []};
    const log = (type, extra = {}) => window.__coverDiag.events.push({type, atMs: performance.now(), domVersion: document.body?.dataset.release ?? null, ...extra});
    log('document-start');
    navigator.serviceWorker.addEventListener('controllerchange', () => log('controllerchange', {controllerURL: navigator.serviceWorker.controller?.scriptURL}));
    window.addEventListener('load', () => {
     log('load');
     void navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      const watch = worker => {if (!worker) return; log('worker-observed', {state: worker.state}); worker.addEventListener('statechange', () => log('worker-statechange', {state: worker.state}));};
      reg.addEventListener('updatefound', () => {log('updatefound'); watch(reg.installing);});
      watch(reg.installing);
     });
    });
   });
   const page = await context.newPage();
   page.setDefaultTimeout(bounds.transitionMs); page.setDefaultNavigationTimeout(bounds.navigationMs);
   page.on('pageerror', error => item.errors.push(error.message));
   page.on('response', response => item.responses.push({at: new Date().toISOString(), url: response.url(), status: response.status(), fromServiceWorker: response.fromServiceWorker()}));
   const cdp = await context.newCDPSession(page);
   cdp.on('ServiceWorker.workerVersionUpdated', ({versions}) => item.workerVersions.push({at: new Date().toISOString(), versions}));
   cdp.on('Network.responseReceived', ({response, type}) => item.cdpResponses.push({url: response.url, type, fromDiskCache: !!response.fromDiskCache, fromServiceWorker: !!response.fromServiceWorker, status: response.status, cacheControl: response.headers['Cache-Control'] ?? response.headers['cache-control']}));
   await cdp.send('ServiceWorker.enable'); await cdp.send('Network.enable');
   const waitActive = cacheName => pollTrue(() => page.evaluate(async ({expected, retired}) => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    return reg?.active?.state === 'activated' && !!navigator.serviceWorker.controller && reg.active === navigator.serviceWorker.controller && !reg.installing && !reg.waiting && keys.includes(expected) && !keys.includes(retired);
   }, {expected: cacheName, retired: cacheName === fixtures.old.cacheName ? fixtures.new.cacheName : fixtures.old.cacheName}), `activate ${cacheName}`);
   const snapshot = async (label, target = page) => {
    const value = await target.evaluate(async () => {
     const reg = await navigator.serviceWorker.getRegistration();
     const cacheNames = await caches.keys(), cacheContents = {};
     for (const name of cacheNames) cacheContents[name] = (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname);
     return {
      ...structuredClone(window.__coverDiag), domVersion: document.body.dataset.release,
      cssVersion: getComputedStyle(document.documentElement).getPropertyValue('--fixture-release').trim(),
      htmlVersion: document.querySelector('meta[name="fixture-release"]')?.content,
      registration: reg ? {active: reg.active?.state ?? null, installing: reg.installing?.state ?? null, waiting: reg.waiting?.state ?? null, activeIsController: !!reg.active && !!navigator.serviceWorker.controller && reg.active === navigator.serviceWorker.controller, controllerURL: navigator.serviceWorker.controller?.scriptURL ?? null, updateViaCache: reg.updateViaCache} : null,
      cacheNames, cacheContents
     };
    });
    const row = {label, at: new Date().toISOString(), ...value}; item.snapshots.push(row); return row;
   };
   await page.goto(url, {waitUntil: 'load'}); await waitActive(fixtures.old.cacheName);
   const seed = await snapshot('old-release-seeded-and-controlled');
   check(seed.domVersion === 'old' && seed.mainVersion === 'old' && seed.registration.active === 'activated' && seed.registration.activeIsController && seed.cacheContents[fixtures.old.cacheName].length === 8, 'Seed is not a fully precached/active/controlling old release');
   // Gate only discovery, never change the old worker/cache-first response.
   state.workerGate = gate(`${spec.name}:sw-discovery`);
   if (spec.holdMusic) state.musicGate = gate(`${spec.name}:one-music-file`);
   state.version = 'new'; item.deployedNewAt = new Date().toISOString();
   const firstResponse = await page.reload({waitUntil: 'load'});
   item.firstReload = {fromServiceWorker: firstResponse.fromServiceWorker(), status: firstResponse.status()};
   const first = await snapshot('first-reload-before-update-completes');
   check(first.domVersion === 'old' && first.mainVersion === 'old' && first.cssVersion === 'old', 'First reload did not retain old release');
   check(item.firstReload.fromServiceWorker, 'First reload not served by old SW');
   state.workerGate.release();
   await page.evaluate(() => {
    // Explicit scheduling only; source registration branch remains untouched.
    void navigator.serviceWorker.getRegistration().then(reg => reg.update()).then(
     () => window.__coverDiag.events.push({type: 'explicit-update-resolved', atMs: performance.now()}),
     error => window.__coverDiag.events.push({type: 'explicit-update-rejected', message: String(error), atMs: performance.now()})
    );
   });
   if (spec.holdMusic) {
    await bounded(state.musicGate.entered, bounds.transitionMs, 'new music request reached gate');
    await pollTrue(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then(reg => reg?.installing?.state === 'installing')), 'new worker installing');
    await delay(bounds.heldObservationMs);
    const held = await snapshot('one-new-music-response-still-held');
    check(!state.musicGate.released, 'Music hold expired before observation');
    check(held.registration.installing === 'installing' && held.registration.waiting === null, 'Music gate is not holding install');
    check(held.registration.activeIsController && held.cacheNames.includes(fixtures.old.cacheName), 'Old worker/cache not retained during installation');
    check(held.documentId === first.documentId && held.domVersion === 'old', 'Document changed during held install');
    item.musicHold = {file: 'audio/war_theme.ogg', enteredAt: new Date(state.musicGate.enteredAt).toISOString(), observedMs: Date.now() - state.musicGate.enteredAt};
    // Keep the original old document intact; same-context second tab tests the entry.
    const queryTab = await context.newPage(); queryTab.setDefaultNavigationTimeout(bounds.navigationMs);
    item.queryResponses = [];
    queryTab.on('pageerror', error => item.errors.push(error.message));
    queryTab.on('response', response => item.queryResponses.push({url: response.url(), status: response.status(), fromServiceWorker: response.fromServiceWorker()}));
    const queryResponse = await queryTab.goto(url + upgradeQuery, {waitUntil: 'load'});
    item.queryNavigation = {query: upgradeQuery, status: queryResponse.status(), fromServiceWorker: queryResponse.fromServiceWorker()};
    const queryPage = await snapshot('query-entry-new-page-while-old-worker-still-controls', queryTab);
    check(!state.musicGate.released && queryPage.registration.installing === 'installing', 'New install finished before query bypass observation');
    check(queryPage.registration.activeIsController && queryPage.cacheNames.includes(fixtures.old.cacheName), 'Expected old controller during query bypass');
    check(!item.queryNavigation.fromServiceWorker && queryPage.domVersion === 'new' && queryPage.mainVersion === 'new' && queryPage.cssVersion === 'new', 'Query entry did not bypass old SW for a coherent new page');
    check(queryPage.documentId !== first.documentId, 'Query upgrade did not create a new document');
    state.musicGate.release(); item.musicHold.releasedAt = new Date().toISOString();
   }
   await waitActive(fixtures.new.cacheName);
   const activated = await snapshot('new-worker-active-and-controller-without-navigation');
   const expectedVersion = 'old';
   check(activated.documentId === first.documentId && activated.domVersion === expectedVersion && activated.mainVersion === expectedVersion && activated.cssVersion === expectedVersion, 'Activation unexpectedly replaced the original old document/DOM/main/CSS');
   check(activated.registration.activeIsController && activated.cacheNames.length === 1 && activated.cacheNames[0] === fixtures.new.cacheName, 'New worker/cache not confirmed');
   check(activated.events.some(e => e.type === 'controllerchange'), 'New controller transition not observed');
   check(activated.toasts.length === 0, 'Unexpected update toast from old production registration');
   item.fetchAfterActivation = await page.evaluate(async () => {
    const response = await fetch('./index.html'); const text = await response.text();
    return {status: response.status, fetchedHtmlVersion: /name="fixture-release" content="([^"]+)"/.exec(text)?.[1], loadedDomVersion: document.body.dataset.release};
   });
   check(item.fetchAfterActivation.fetchedHtmlVersion === 'new' && item.fetchAfterActivation.loadedDomVersion === expectedVersion, 'Unexpected fetched/loaded release after activation');
   const secondResponse = await page.reload({waitUntil: 'load'});
   item.secondReload = {fromServiceWorker: secondResponse.fromServiceWorker(), status: secondResponse.status()};
   const second = await snapshot('second-reload-after-new-worker-activation');
   check(second.documentId !== first.documentId && second.domVersion === 'new' && second.mainVersion === 'new' && second.cssVersion === 'new', 'Second reload did not load coherent new release');
   check(item.secondReload.fromServiceWorker, 'Second reload not served by new SW');
   check(item.errors.length === 0, 'Fixture page reported runtime errors');
   check(!state.workerGate.safetyReleased && !state.musicGate?.safetyReleased && !item.deadlineExpired, 'Safety deadline reached; cannot accept result');
   item.observed = {firstReloadOldFromSW: true, installHeldByMusic: true, newWorkerControlsOldDocument: true, documentReplacedByActivation: false, autoRefreshObserved: false, updateToastObserved: false, secondReloadAfterActivationLoadsNew: true, queryEntryLoadsNewUnderOldController: true};
   item.status = 'reproduced';
  } catch (error) {
   item.status = 'failed'; item.failure = {message: error.message, stack: error.stack}; throw error;
  } finally {
   clearTimeout(caseTimer); state.workerGate?.release(); state.musicGate?.release();
   await bounded(context.close(), bounds.cleanupMs, 'context cleanup'); context = undefined;
   item.finishedAt = new Date().toISOString();
  }
 }
 check(!report.overallDeadlineExpired, 'Overall safety deadline reached');
 report.status = 'reproduced';
 report.conclusion = {
  confirmedByLocalReproduction: ['One valid combined scenario after one retained invalid harness attempt; no separate normal-install rerun.', 'First reload under old controller was served old HTML/main/CSS from SW despite HTTP no-store.', 'After complete new install, skipWaiting/claim switched the controller and deleted the old release cache; the same old document/main/CSS remained, with no update toast or reload.', 'A diagnostic fetch returned new HTML while that same document remained old, separating current resource serving from already executed/rendered content.', 'A second reload performed after activation loaded new HTML/main/CSS from the new SW.', 'Holding one music response kept the new worker installing (not waiting) and the old worker active.', 'While music was still held and old worker still controlled, a second tab at ?v=cover-7cab52f was NOT served by SW and loaded new HTML/main/CSS. Releasing music activated the new worker; original tab remained old until the explicit second reload.'],
  rootCause: 'Confirmed mechanism: cache-first navigation gives the first reload the old page; the production registration returns early when reg.active exists, does not handle upgrade notification/controllerchange, and skipWaiting/claim do not reload an existing document. Full addAll music is an independent pre-activation gate.',
  liveAttribution: 'Not confirmed for the user browser: no controller/version/install/HTTP evidence from that browser. This mechanism can explain a successful deployment still showing the old cover; deployment failure cannot be inferred from that DOM alone.',
  httpCache: 'Not needed for either reproduced symptom and excluded locally by no-store plus SW-served old navigations. A live stale HTTP/CDN response remains unmeasured; parent report independently confirms currently deployed bytes. If a later fresh navigation still receives old bytes after activation, compare its actual response bytes/cache headers and manifest.',
  immediateUpgradeEntry: {query: upgradeQuery, reproduced: true, reason: 'Old worker only aliases an exact scope-root navigation to index.html; query-bearing root URL is not in URLS. New hashed main/CSS URLs are also absent from the old manifest and fall through to network.', caveat: 'Verified on a faithful local fixture, not in the user browser. Requires online/current server bytes. Loading new code under an old worker temporarily does not establish full offline readiness; wait for the new install to finish. Use at home/safe screen, not mid-battle; it does not erase saves or caches.'},
  smallestRobustFollowUp: ['Observe updatefound/installing state and controllerchange even when registration already has an active worker; distinguish first offline-ready toast from update-available notice.', 'Offer an explicit reload-to-update action on the home/menu or safe paused boundary. Never force location.reload during battle; a controller change is not proof the current DOM updated.', 'Expose bounded downloading/install failure status so waiting for all music is not mistaken for deployment failure. Preserve existing full-offline behavior unless separately approving a shell/music split.'],
  discriminatingLiveCheck: 'Record current DOM/asset version, reg.installing/waiting/active/controller, current cache name and fetched index bytes. Installing+music outstanding differs from new cache+new fetched HTML+old DOM. Only after activation test one more user-approved navigation from a safe screen.',
  notAnAcceptance: 'No claim of automatic new-page update, actual cover visual acceptance, user-browser root-cause proof, production deployment verification or gameplay-safe release compatibility.'
 };
} catch (error) {
 report.status = 'failed'; report.failure = {message: error.message, stack: error.stack}; process.exitCode = 1;
} finally {
 clearTimeout(overallTimer);
 state?.workerGate?.release(); state?.musicGate?.release();
 report.cleanup = {};
 if (context) {try {await bounded(context.close(), bounds.cleanupMs, 'final context close');} catch (error) {report.cleanup.contextError = String(error);}}
 if (browser) {try {await bounded(browser.close(), bounds.cleanupMs, 'browser close'); report.cleanup.browserClosed = true;} catch (error) {report.cleanup.browserError = String(error);}}
 if (server) {
  try {
   await bounded(new Promise((r, j) => {server.close(error => error ? j(error) : r()); server.closeAllConnections();}), bounds.cleanupMs, 'server close');
   report.cleanup.serverClosed = true;
  } catch (error) {report.cleanup.serverError = String(error);}
 }
 report.finishedAt = new Date().toISOString(); report.runnerSha256 = sha256(await readFile('scripts/diagnose-cache-upgrade.mjs'));
 await json(join(root, 'server-requests.json'), serverRequests);
 await json(join(root, 'result.json'), report);
 await mkdir(resolve('docs/metrics'), {recursive: true}); await json(reportPath, report);
}
console.log(JSON.stringify({report: relative(process.cwd(), reportPath), evidenceDirectory: report.evidenceDirectory, status: report.status, browser: report.browser, cases: report.cases.map(c => ({name: c.name, status: c.status, observed: c.observed, failure: c.failure})), failure: report.failure, cleanup: report.cleanup}, null, 2));
