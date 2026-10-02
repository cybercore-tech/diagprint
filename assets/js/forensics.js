/* Forensics demo: a hash-chained diagnostic history, hashed live with
 * SHA-256 (WebCrypto). Each run's digest covers the previous digest plus the
 * run record, so editing any run breaks verification from that point on.
 * Output tabs mirror the README's `why`, `timeline`, `blame`, `graph`, `replay`.
 */
(() => {
  const $ = s => document.querySelector(s);
  if (!$('#runs')) return;
  const FP = '7f23a9d5c120';
  const GLYPH = { unseen: '·', active: '●', sev: '▲', chg: '◆', res: '○', absent: '·', re: '↻' };
  const BASE = [
    { k: 'unseen', label: 'prehistory', ep: '-', sev: '-', ev: '-' },
    { k: 'active', label: 'baseline', ep: 1, sev: 'warning=1', ev: 'first_seen' },
    { k: 'sev', label: 'regression', ep: 1, sev: 'error=1', ev: 'changed,severity_increased' },
    { k: 'chg', label: 'refactor-net', ep: 1, sev: 'error=1', ev: 'changed' },
    { k: 'active', label: 'nightly', ep: 1, sev: 'error=1', ev: '-' },
    { k: 'res', label: 'fixed', ep: '-', sev: '-', ev: 'resolved' },
    { k: 'absent', label: 'still-clean', ep: '-', sev: '-', ev: '-' },
    { k: 'absent', label: 'release-0.7', ep: '-', sev: '-', ev: '-' },
    { k: 're', label: 'regressed', ep: 2, sev: 'warning=1', ev: 'reappeared' },
    { k: 'active', label: 'hotfix-attempt', ep: 2, sev: 'warning=1', ev: '-' },
    { k: 'sev', label: 'load-test', ep: 2, sev: 'error=1', ev: 'severity_increased' },
    { k: 'active', label: 'nightly', ep: 2, sev: 'error=1', ev: '-' }
  ];
  let runs = [], sealed = [], selected = 11, tab = 'why', brokenAt = -1;
  const id = i => String(i).padStart(6, '0');
  const record = r => JSON.stringify({ run: r.run, label: r.label, state: r.k, episode: r.ep, severity: r.sev, events: r.ev, fingerprint: FP });
  async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  async function seal(list) { let prev = '0'.repeat(64); const out = []; for (const r of list) { const h = await sha(prev + record(r)); out.push({ prev, hash: h }); prev = h; } return out; }
  async function verify() {
    let prev = '0'.repeat(64);
    for (let i = 0; i < runs.length; i++) { const h = await sha(prev + record(runs[i])); if (h !== sealed[i].hash || prev !== sealed[i].prev) return i; prev = sealed[i].hash; }
    return -1;
  }

  function renderRuns() {
    $('#runs').innerHTML = runs.map((r, i) => `<button class="run${i >= brokenAt && brokenAt >= 0 && i === brokenAt ? ' broken' : ''}" role="option" data-i="${i}" data-k="${r.k}" aria-selected="${i === selected}" title="run ${id(i)} · ${r.label}"><span class="g">${GLYPH[r.k]}</span><small>${String(i).padStart(2, '0')}</small></button>`).join('');
    $('#runs').querySelectorAll('.run').forEach(b => b.addEventListener('click', () => { selected = +b.dataset.i; renderRuns(); setTab('timeline'); }));
  }
  function renderChain(checking = -1) {
    $('#chain').innerHTML = sealed.map((s, i) => {
      const bad = brokenAt >= 0 && i >= brokenAt;
      return `<div class="blk ${bad ? 'bad' : 'ok'}${i === checking ? ' check' : ''}"><b>RUN ${id(i)}</b><span class="prev">↳ ${s.prev.slice(0, 12)}</span><span>${s.hash.slice(0, 16)}</span></div>`;
    }).join('');
  }
  const pad = (s, n) => String(s).padEnd(n);

  function out() {
    const ok = brokenAt < 0, r = runs[selected];
    const verified = ok ? '<span class="t-ok">true</span>' : `<span class="t-err">false</span> <span class="t-dim">(digest mismatch at run ${id(brokenAt)})</span>`;
    const active = runs.filter(x => ['active', 'sev', 'chg', 're'].includes(x.k));
    const head = `<span class="t-dim">$ diagprint ${tab} .diagprint/history ${FP}</span>\n\n`;
    if (!ok && tab !== 'timeline') return head + `<span class="t-err">error[HIST-CHAIN]: history chain verification failed</span>\n <span class="t-dim">--&gt;</span> <span class="t-path">.diagprint/history/run-${id(brokenAt)}.json</span>\n  <span class="t-dim">|</span>\n  <span class="t-dim">=</span> <span class="t-cause">cause:</span> recomputed digest does not match the sealed digest\n  <span class="t-dim">=</span> <span class="t-note">note:</span> every later run inherits the broken link\n  <span class="t-dim">=</span> <span class="t-help">help:</span> restore the original record; evidence is never repaired in place\n\n<span class="t-dim">case file withheld: evidence cannot be proven</span>`;
    if (tab === 'why') {
      return head + `<span class="t-b">DIAGNOSTIC CASE FILE</span>
schema: diagprint.forensics.case-file/v1
fingerprint: diagprint.canonical/v1:sha256:${sealed[11].hash.slice(0, 12)}…
status: <span class="t-err">active</span>
chain-verified: ${verified}
first-seen: run=${id(1)} label="baseline"
last-seen: run=${id(11)} label="nightly"
history-runs: ${runs.length}
observed-runs: ${active.length}
episodes: 2
reappearances: 1
changed-instances: 2
severity-increases: 2

<span class="t-b">EPISODES</span>
  #01 start=${id(1)} last-active=${id(4)} resolved=${id(5)} runs=4 peak=1
  #02 start=${id(8)} last-active=${id(11)} resolved=<span class="t-err">active</span> runs=4 peak=1

<span class="t-b">EVIDENCE</span>
${runs.filter(x => x.k !== 'unseen' && x.k !== 'absent').slice(-3).map(x => `  RUN ${id(x.run)} label="${x.label}" severity=[${x.sev}]\n    run-digest: sha256:${sealed[x.run].hash.slice(0, 24)}…`).join('\n')}`;
    }
    if (tab === 'timeline') {
      const track = runs.map(x => GLYPH[x.k]).join(' ');
      return head + `<span class="t-b">DIAGNOSTIC TIMELINE</span>
status: active
chain-verified: ${verified}

TRACK  <span class="t-help">${track}</span>

<span class="t-b">RUNS</span>
${runs.map((x, i) => `${i === selected ? '<span class="t-p">▸</span>' : ' '} ${x.k === 'sev' ? '<span class="t-err">▲</span>' : x.k === 're' ? '<span class="t-p">↻</span>' : x.k === 'res' ? '<span class="t-note">○</span>' : x.k === 'chg' ? '<span class="t-warn">◆</span>' : x.k === 'active' ? '<span class="t-ok">●</span>' : '<span class="t-dim">·</span>'} ${id(i)} ${pad(x.k === 'unseen' ? 'unseen' : ['res', 'absent'].includes(x.k) ? 'absent' : 'active', 7)} ep=${x.ep} severity=[${x.sev}] events=[${x.ev}] label="${x.label}"${brokenAt >= 0 && i >= brokenAt ? ' <span class="t-err">✗ unverified</span>' : ''}`).join('\n')}

<span class="t-b">SELECTED</span>  run ${id(selected)} · digest sha256:${sealed[selected].hash.slice(0, 32)}…
           prev   sha256:${sealed[selected].prev.slice(0, 32)}…`;
    }
    if (tab === 'blame') {
      return head + `<span class="t-b">DIAGNOSTIC GIT PROVENANCE</span>
history-run: ${id(8)}
binding: captured_clean
history-binding-verified: <span class="t-ok">true</span>
git-object-verified: <span class="t-ok">true</span>

<span class="t-b">TRANSITION</span>
  phase: active
  events: reappeared

<span class="t-b">COMMIT</span>
  commit: 7d19fa2…
  tree: 3c81b44…
  subject: refactor config loader

<span class="t-b">REPOSITORY DIFF</span>
  files-changed: 12   insertions: 84   deletions: 39
  <span class="t-warn">M</span>       src/config.rs

<span class="t-b">ASSESSMENT</span>
  provenance: commit/tree captured from a clean worktree surrounding this scan
  association: temporally associated with this history run
  causation: <span class="t-err">NOT ESTABLISHED</span>`;
    }
    if (tab === 'graph') {
      return head + `<span class="t-b">DIAGNOSTIC RELATIONSHIP GRAPH</span>
root: ${FP}  depth: 2  evidence: explicit

  <span class="t-err">●</span> ${FP}  CFG-001 port out of range
  ├─<span class="t-note">caused_by</span>──▶ <span class="t-warn">●</span> 4be0d1a93f27  NET-004 bind failed
  │                 <span class="t-dim">evidence: producer_declared</span>
  └─<span class="t-note">related_to</span>─▶ <span class="t-warn">●</span> 9c1e77b0a5d2  W-SEC-004 endpoint not encrypted
                    <span class="t-dim">evidence: structural</span>

<span class="t-dim">inferred correlations hidden · pass --evidence all</span>
<span class="t-dim">cycle-safe · depth-bounded · --format dot for Graphviz</span>

<span class="t-b">CASCADE</span>
  topology of recorded explicit causal edges only
  root cause: <span class="t-err">NOT CLAIMED</span>`;
    }
    return head + `<span class="t-b">REMEDIATION EVIDENCE REPLAY</span>
receipt: diagprint.remediation-receipt/v1
receipt-verified: <span class="t-ok">true</span>
bound-transition: run ${id(4)} → ${id(5)}  (active → resolved)

<span class="t-b">OBSERVED</span>
  ${id(5)}  <span class="t-note">○</span> resolved after verified remediation
  ${id(8)}  <span class="t-p">↻</span> reappeared  label="regressed"

<span class="t-b">ASSESSMENT</span>
  remediation causation: <span class="t-err">NOT ESTABLISHED</span>
  recurrence root cause: <span class="t-err">NOT ESTABLISHED</span>
  git causation:         <span class="t-err">NOT ESTABLISHED</span>

<span class="t-dim">read-only: FixPlan::apply is never invoked, no shell commands run</span>`;
  }
  function setTab(t) {
    tab = t;
    document.querySelectorAll('#fxTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $('#fxOut').innerHTML = out();
  }
  document.querySelectorAll('#fxTabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  document.querySelectorAll('[data-ftab]').forEach(a => a.addEventListener('click', () => setTab(a.dataset.ftab)));

  async function recheck(animate) {
    const st = $('#chainStatus');
    st.className = ''; st.textContent = 'VERIFYING…';
    if (animate) for (let i = 0; i < sealed.length; i++) { renderChain(i); await new Promise(r => setTimeout(r, 70)); }
    brokenAt = await verify();
    st.className = brokenAt < 0 ? 'ok' : 'bad';
    st.textContent = brokenAt < 0 ? `CHAIN VERIFIED · ${runs.length} RUNS` : `CHAIN BROKEN AT RUN ${id(brokenAt)}`;
    renderRuns(); renderChain(); setTab(tab);
  }
  $('#tamper').addEventListener('click', async () => {
    const i = 2 + Math.floor(Math.random() * 8);
    runs[i] = { ...runs[i], label: runs[i].label + '-edited', sev: runs[i].sev === 'error=1' ? 'warning=1' : runs[i].sev };
    selected = i; window.DP?.toast(`RUN ${id(i)} EDITED IN PLACE`);
    await recheck(true);
  });
  $('#heal').addEventListener('click', async () => { runs = BASE.map((r, i) => ({ ...r, run: i })); await recheck(true); });

  (async () => {
    runs = BASE.map((r, i) => ({ ...r, run: i }));
    sealed = await seal(runs);
    renderRuns(); renderChain(); setTab('why'); recheck(false);
  })();
})();
