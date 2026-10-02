/* diagprint site — page content builders + effects. No dependencies.
 *   neural    hero canvas: drifting neural mesh, synapse pulses, nodes that
 *             fault and get diagnosed (caret + code) then recover
 *   liveCase  typed terminal scenes: scan / why / fix
 *   uplink    install console: method tabs, platform detection, copy + decode
 *   content   lifecycle, surfaces, gates, crates, feature flags, ticker
 *   nav       mega menus, mobile menu, ⌘K command palette, shortcuts
 * Everything animated pauses offscreen and respects prefers-reduced-motion.
 */
(() => {
  const root = document.documentElement;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const css = v => getComputedStyle(root).getPropertyValue(v).trim();
  let C = {};
  const readC = () => { C = { bg: css('--bg'), white: css('--white'), acid: css('--acid'), pink: css('--pink'), cyan: css('--cyan'), orange: css('--orange'), red: css('--red'), line: css('--line'), muted: css('--muted') }; };
  readC(); document.addEventListener('cc:theme', () => requestAnimationFrame(readC));
  const rgba = (hex, a) => { const n = parseInt((hex || '#888888').replace('#', ''), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const toast = m => window.DP?.toast(m);
  const copy = async (text, msg = 'COPIED') => { try { await navigator.clipboard.writeText(text); toast(msg); return true; } catch { toast('SELECT + COPY'); return false; } };

  /* ═════════ hero: neural mesh ═════════ */
  (function neural() {
    const cv = $('#heroFx'); if (!cv) return;
    const ctx = cv.getContext('2d');
    let w, h, on = true, nodes = [], pulses = [], faults = [], mx = -999, my = -999;
    const CODES = ['E-0042', 'CFG-001', 'NET-001', 'W-SEC-004', 'E-TYPE', 'CFG-005', 'HIST-CHAIN'];
    function size() {
      const r = cv.getBoundingClientRect(); w = r.width; h = r.height; cv.width = w * DPR; cv.height = h * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.round(Math.min(90, w * h / 16000));
      nodes = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: 1 + Math.random() * 1.8 }));
    }
    size(); addEventListener('resize', size);
    if (fine) cv.parentElement.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) requestAnimationFrame(loop); }).observe(cv);
    const D = 140;
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach(n => { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1; });
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d < D) {
          const near = Math.hypot((a.x + b.x) / 2 - mx, (a.y + b.y) / 2 - my) < 160;
          ctx.strokeStyle = rgba(near ? C.acid : C.cyan, (1 - d / D) * (near ? .55 : .18));
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (!still && Math.random() < .0009) pulses.push({ a, b, t: 0, c: Math.random() < .7 ? C.acid : C.pink });
        }
      }
      pulses = pulses.filter(p => (p.t += .02) < 1);
      pulses.forEach(p => { const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t; ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); ctx.shadowBlur = 0; });
      nodes.forEach(n => { ctx.fillStyle = rgba(C.white, .55); ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill(); });
      // faults: a node goes red, gets a span + caret + code, then recovers green
      if (!still && Math.random() < .006 && faults.length < 2 && nodes.length) faults.push({ n: nodes[(Math.random() * nodes.length) | 0], t: 0, code: CODES[(Math.random() * CODES.length) | 0] });
      faults = faults.filter(f => (f.t += .006) < 1);
      faults.forEach(f => {
        const { x, y } = f.n, fixed = f.t > .62, col = fixed ? C.acid : C.red, a = f.t < .1 ? f.t * 10 : f.t > .85 ? (1 - f.t) / .15 : 1;
        ctx.globalAlpha = a;
        ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 8 + (f.t * 30) % 10, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = '11px "Share Tech Mono", monospace'; ctx.fillStyle = col;
        const label = fixed ? `✓ ${f.code} resolved` : `${f.code}`;
        ctx.fillText(label, x + 14, y - 10);
        ctx.fillStyle = fixed ? C.acid : C.pink; ctx.fillText('^'.repeat(Math.min(label.length, 9)), x + 14, y + 4);
        ctx.globalAlpha = 1; ctx.lineWidth = 1;
      });
    }
    function loop(t) { if (!on) return; frame(t); if (!still) requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  })();

  /* ═════════ hero: live case terminal ═════════ */
  (function liveCase() {
    const body = $('#htBody'); if (!body) return;
    const S = [
      { mode: 'scan', lines: [
        '<span class="t-p">❯</span> diagprint scan . --history .diagprint/history',
        '<span class="t-dim">scanning 214 files · profile=standard · rev r42</span>',
        '',
        '<span class="t-err">error[NET-001]</span><span class="t-b">: uplink rejected</span>',
        ' <span class="t-dim">--&gt;</span> <span class="t-path">src/gateway.rs:42:17</span>',
        '  <span class="t-dim">|</span>',
        '<span class="t-num">42</span> <span class="t-dim">|</span>     connect(node, signature)?;',
        '  <span class="t-dim">|</span>             <span class="t-car">^^^^^^^^^^^^^^^ signature mismatch</span>',
        '<span class="t-num">17</span> <span class="t-dim">|</span> let signature = sign(&amp;key_v1);',
        '  <span class="t-dim">|</span>                 <span class="t-car2">----------- signed with a rotated key</span>',
        '  <span class="t-dim">=</span> <span class="t-cause">cause:</span> authentication signature mismatch',
        '  <span class="t-dim">=</span> <span class="t-note">note:</span> case fingerprint 7f23a9d5c120 retained',
        '  <span class="t-dim">=</span> <span class="t-help">help:</span> re-sign with the active node key',
        '',
        '<span class="t-ok">✓</span> report persisted <span class="t-dim">// run 000011 · chain verified</span>'
      ] },
      { mode: 'why', lines: [
        '<span class="t-p">❯</span> diagprint why .diagprint/history 7f23a9d5c120',
        '',
        '<span class="t-b">DIAGNOSTIC CASE FILE</span>',
        'schema: diagprint.forensics.case-file/v1',
        'status: <span class="t-err">active</span>      chain-verified: <span class="t-ok">true</span>',
        'first-seen: run=000001 label="baseline"',
        'last-seen:  run=000011 label="nightly"',
        'episodes: 2   reappearances: 1   severity-increases: 2',
        '',
        '<span class="t-b">TRACK</span>  <span class="t-help">· ● ▲ ◆ ● ○ · · ↻ ● ▲ ●</span>',
        '',
        '<span class="t-dim">evidence-based: no guessed root cause, no blame</span>'
      ] },
      { mode: 'fix', lines: [
        '<span class="t-p">❯</span> Fixer::new().backups(true).apply(&amp;diagnostic)',
        '',
        '<span class="t-ok">✓</span> applicability     machine_applicable',
        '<span class="t-ok">✓</span> expected source   matches r42',
        '<span class="t-ok">✓</span> utf-8 boundaries  ok',
        '<span class="t-ok">✓</span> overlapping edits none',
        '<span class="t-ok">✓</span> recovery state    .diagprint/recovery/0011',
        '<span class="t-ok">✓</span> transaction write 2 files',
        '<span class="t-ok">✓</span> post-fix verify   NET-001 resolved',
        '',
        '<span class="t-b">receipt</span> <span class="t-dim">sha256:9e1c…b07a → sha256:41fd…c2e9</span>',
        '<span class="t-dim">suggested commands are never executed</span>'
      ] }
    ];
    const tabs = $$('#htTabs button'), auto = $('.ht-auto');
    let scene = 0, timer, autoOn = !still, token = 0;
    async function play(i) {
      const my = ++token; scene = i;
      tabs.forEach(b => b.setAttribute('aria-selected', String(+b.dataset.scene === i)));
      $('#htMode').textContent = `MODE ${S[i].mode}`;
      body.innerHTML = '';
      for (const line of S[i].lines) {
        if (my !== token) return;
        if (still) { body.innerHTML += line + '\n'; continue; }
        const isCmd = line.startsWith('<span class="t-p">❯');
        if (isCmd) {
          const plain = line.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/^❯ /, '');
          const pre = body.innerHTML;
          for (let k = 0; k <= plain.length; k += 2) { if (my !== token) return; body.innerHTML = pre + `<span class="t-p">❯</span> ${esc(plain.slice(0, k))}<span class="cur"></span>`; await new Promise(r => setTimeout(r, 14)); }
          body.innerHTML = pre + line + '\n';
        } else { body.innerHTML += line + '\n'; await new Promise(r => setTimeout(r, 70)); }
      }
      if (my !== token) return;
      body.innerHTML += '<span class="t-p">❯</span> <span class="cur"></span>';
      clearTimeout(timer);
      if (autoOn) timer = setTimeout(() => play((scene + 1) % S.length), 4200);
    }
    tabs.forEach(b => b.addEventListener('click', () => { autoOn = false; auto.classList.add('off'); auto.textContent = 'MANUAL'; clearTimeout(timer); play(+b.dataset.scene); }));
    let started = false;
    new IntersectionObserver(es => { if (es[0].isIntersecting && !started) { started = true; play(0); } }).observe(body);
    const clock = $('#htClock'); if (clock) { const tick = () => { clock.textContent = new Date().toTimeString().slice(0, 8); }; tick(); setInterval(tick, 1000); }
  })();

  /* ═════════ uplink install console ═════════ */
  (function uplink() {
    const btn = $('#upCmd'); if (!btn) return;
    const CMD = {
      curl: { text: 'curl -fsSL https://raw.githubusercontent.com/cybercore-tech/diagprint/main/install.sh | sh', meta: null },
      cargo: { text: 'cargo install diagprint', meta: ['BUILDS FROM CRATES.IO', 'RUST 1.85+', '→ ~/.cargo/bin'] },
      lib: { text: 'cargo add diagprint', meta: ['LIBRARY CRATE', 'RUST 2024', 'ALL FEATURES OFF BY DEFAULT'] }
    };
    let mode = 'curl', platformLine = 'detecting platform…';
    const meta = $('#upMeta'), text = $('#upText');
    const metaHtml = items => items.map(s => `<span><b class="ok">◆</b> ${s}</span>`).join('');
    function show() {
      text.textContent = CMD[mode].text;
      meta.innerHTML = mode === 'curl' ? metaHtml([platformLine, 'SHA-256 VERIFIED', '→ ~/.local/bin']) : metaHtml(CMD[mode].meta);
    }
    $$('.up-tabs button').forEach(b => b.addEventListener('click', () => { mode = b.dataset.cmd; $$('.up-tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b))); show(); }));
    async function detect() {
      let os = '', arch = '';
      try { if (navigator.userAgentData?.getHighEntropyValues) { const v = await navigator.userAgentData.getHighEntropyValues(['platform', 'architecture']); os = v.platform || ''; arch = v.architecture || ''; } } catch {}
      const ua = navigator.userAgent;
      if (!os) os = /Mac/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : /Windows/.test(ua) ? 'Windows' : '';
      if (!arch) arch = /aarch64|arm64/i.test(ua) ? 'arm' : 'x86';
      const a = /arm/i.test(arch) ? 'aarch64' : 'x86_64';
      if (/mac/i.test(os)) platformLine = `MACOS · ${a.toUpperCase()} → diagprint-${a}-apple-darwin`;
      else if (/linux|chrome os/i.test(os)) platformLine = `LINUX · ${a.toUpperCase()} → diagprint-${a}-unknown-linux-gnu`;
      else if (/win/i.test(os)) platformLine = 'WINDOWS · USE CARGO INSTALL';
      else platformLine = 'LINUX + MACOS · X86_64 + AARCH64';
      show();
    }
    detect(); show();
    const GL = '!<>-_\\/[]{}=+*^?#01ABCDEF';
    btn.addEventListener('click', async e => {
      const full = CMD[mode].text;
      await copy(full, 'UPLINK ARMED · PASTE IN YOUR SHELL');
      btn.classList.add('done'); $('#upLabel').textContent = 'COPIED';
      burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
      if (!still) { let f = 0; const step = () => { text.textContent = [...full].map((c, i) => (i < f * 3 || c === ' ' ? c : GL[(Math.random() * GL.length) | 0])).join(''); if (++f * 3 <= full.length) requestAnimationFrame(step); else text.textContent = full; }; step(); }
      setTimeout(() => { btn.classList.remove('done'); $('#upLabel').textContent = 'COPY'; }, 2000);
    });
  })();

  /* ═════════ live version ═════════ */
  fetch('https://api.github.com/repos/cybercore-tech/diagprint/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(r => (r.ok ? r.json() : null)).then(rel => {
      if (!rel || !rel.tag_name) return;
      const v = rel.tag_name.replace(/^(cli-)?v/, '');
      $('#verText').textContent = `v${v}`; $('#eyebrowVer').textContent = `v${v}`;
    }).catch(() => {});

  /* ═════════ content ═════════ */
  const STAGES = [
    { k: 'DEFINE', s: 'reporter · derive', ic: 'pen', t: 'Define it once', p: 'A diagnostic is data: severity, code, message, primary and secondary labels, cause chain, notes, help and suggestions. Derive macros give you typed diagnostics.', li: ['primary + secondary source labels', 'virtual and in-memory sources', 'immutable source snapshots', '#[derive] with diagprint-derive'], code: `reporter.error("Invalid configuration value")\n    .code("CFG-001")\n    .label("config.toml", 12, Some(9), Some(5),\n           Some("unsupported value"))\n    .secondary_label("defaults.toml", 4, Some(1),\n           Some(7), Some("default declared here"))` },
    { k: 'RENDER', s: '7 built-in formats', ic: 'term', t: 'Render anywhere', p: 'Terminal, JSON, Markdown, plain text, HTML, GitHub Actions and SARIF from the same structure. The terminal keeps related context visually distinct from the failure.', li: ['terminal with source context', 'JSON / Markdown / plain / HTML', 'gzip + zstd report compression', 'themes, including Cybercore'], code: `reporter.emit(&diagnostic)?;\nreporter.emit_github_actions(&diagnostic)?;\nSarifRenderer.write_many(\n    "target/diagprint.sarif", [&first, &second])?;` },
    { k: 'GATE', s: 'CI · SARIF · deltas', ic: 'gate', t: 'Gate the pipeline', p: 'Native workflow annotations, SARIF 2.1.0 for code scanning, canonical fingerprints and semantic report deltas for baseline-aware CI.', li: ['GitHub Actions annotations', 'SARIF with deterministic rule ids', 'canonical fingerprints + report digests', 'baseline-aware delta evaluation'], code: `# CI step: scan and keep a readable report\ndiagprint scan . --static --format markdown \\\n    -o diagprint-report.md\n\n// in your Rust tooling\nreporter.emit_github_actions(&diagnostic)?;\nSarifRenderer.write_many("target/diagprint.sarif",\n    [&first, &second])?;` },
    { k: 'EDIT', s: 'LSP · code actions', ic: 'lsp', t: 'Meet developers in the editor', p: 'diagprint-lsp publishes diagnostics and code actions over the Language Server Protocol, using the same labels and suggestions.', li: ['publishDiagnostics', 'quick-fix code actions', 'revision-bound to editor buffers', 'stale-source detection'], code: `// diagprint-lsp\nlet adapter = LspAdapter::utf16(documents);\nlet publish = adapter.publish_report(&report, &snapshot)?;\nlet actions = adapter.code_actions_report(&report, &snapshot)?;` },
    { k: 'REMEDIATE', s: 'Fixer · FixPlan', ic: 'wrench', t: 'Fix under guard', p: 'Only machine-applicable, still-matching, non-overlapping edits on valid UTF-8 boundaries are applied. Multi-file plans run as transactions with recovery state.', li: ['stale edits rejected', 'transactional multi-file fixes', 'backups + interactive mode', 'rollback on observed failure'], code: `let check = Fixer::new().check(&diagnostic)?;\nlet report = Fixer::new()\n    .backups(true)\n    .apply(&diagnostic)?;` },
    { k: 'VERIFY', s: 'post-fix · receipts', ic: 'shield', t: 'Prove it worked', p: 'Fix plans declare structured verification. Failed verification rolls back. Exact-byte artifact receipts record what was written.', li: ['declarative verification', 'verification rollback', 'exact-byte artifact receipts', 'transactional artifact persistence'], code: `let report = FixPlan::new("repair uplink config")\n    .edits(edits)\n    .verify(FileCheck::Contains {\n        file: "config.toml".into(),\n        text: "port = 8080".into(),\n    })\n    .backups(true)\n    .apply()?;  // rolls back if verification fails` },
    { k: 'OBSERVE', s: 'OTel · async · capsules', ic: 'otel', t: 'Ship telemetry, keep privacy', p: 'Privacy-aware OpenTelemetry export, bounded async delivery, diagnostic capsules and redaction policies decide what leaves the machine.', li: ['diagprint-otel', 'diagprint-async bounded delivery', 'capsules + privacy-aware export', 'tracing subscriber integration'], code: `diagprint scan . --capsule out/capsule.json\n# export policy controls hostname, pid,\n# attributes and remediation payloads` },
    { k: 'INVESTIGATE', s: 'forensics', ic: 'why', t: 'Ask why it came back', p: 'Hash-chained history, lineage, case files, timelines, Git provenance, relationship graphs and remediation replay. Evidence, never guesses.', li: ['diagprint why / timeline', 'blame with Git provenance', 'typed relationship graph', 'read-only remediation replay'], code: `diagprint why .diagprint/history 7f23a9d5c120\ndiagprint timeline .diagprint/history 7f23a9d5c120\ndiagprint blame .diagprint/history 7f23a9d5c120` }
  ];
  (function lifecycle() {
    const el = $('#lcStages'); if (!el) return;
    el.innerHTML = STAGES.map((s, i) => `<button class="stage" type="button" data-i="${i}" aria-selected="${i === 0}"><span class="node"><svg><use href="#i-${s.ic}"/></svg></span><b>${s.k}</b><small>${s.s}</small></button>`).join('');
    let cur = 0, t;
    const show = i => {
      cur = i; const s = STAGES[i];
      el.querySelectorAll('.stage').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.i === i)));
      $('#lcDetail').innerHTML = `<div><h3><small>STAGE ${String(i + 1).padStart(2, '0')} / ${s.k}</small>${s.t}</h3><p>${s.p}</p><ul>${s.li.map(x => `<li>${x}</li>`).join('')}</ul></div><pre class="code"><code>${esc(s.code)}</code></pre>`;
    };
    el.querySelectorAll('.stage').forEach(b => { b.addEventListener('click', () => { clearInterval(t); show(+b.dataset.i); }); b.addEventListener('mouseenter', () => { clearInterval(t); show(+b.dataset.i); }); });
    show(0);
    if (!still) new IntersectionObserver(es => { clearInterval(t); if (es[0].isIntersecting) t = setInterval(() => show((cur + 1) % STAGES.length), 3800); }).observe(el);
  })();

  const SURF = [
    { n: 'Terminal', ic: 'term', c: 'var(--acid)', tag: 'HUMANS', p: 'Rich source context, carets for primary spans and dashes for related ones.', code: 'reporter.emit(&diagnostic)', fmt: 'terminal' },
    { n: 'JSON', ic: 'json', c: 'var(--cyan)', tag: 'MACHINES', p: 'Export diagnostics under an explicit privacy policy, one or many per document.', code: 'JsonRenderer.render_with_policy(..)', fmt: 'json' },
    { n: 'SARIF 2.1.0', ic: 'sarif', c: 'var(--pink)', tag: 'CODE SCANNING', p: 'Deterministic rule ids and indices, related locations, exclusive end columns.', code: 'SarifRenderer.write_many(..)', fmt: 'sarif' },
    { n: 'GitHub Actions', ic: 'gha', c: 'var(--orange)', tag: 'CI', p: 'Workflow-command annotations. Secondary labels become notices, not extra failures.', code: 'reporter.emit_github_actions(..)', fmt: 'gha' },
    { n: 'Markdown', ic: 'md', c: 'var(--cyan)', tag: 'REPORTS', p: 'PR comments, issue bodies and run summaries with locations and suggestions.', code: 'MarkdownRenderer', fmt: 'markdown' },
    { n: 'Language Server', ic: 'lsp', c: 'var(--acid)', tag: 'EDITORS', p: 'diagprint-lsp: publishDiagnostics plus quick-fix code actions.', code: 'diagprint-lsp', fmt: 'lsp' },
    { n: 'HTML', ic: 'html', c: 'var(--pink)', tag: 'FEATURE: html', p: 'Standalone diagnostic and report pages for dashboards and archives.', code: 'features = ["html"]' },
    { n: 'Plain text', ic: 'plain', c: 'var(--muted)', tag: 'LOGS', p: 'No colour, no escapes. For log files and tools that hate ANSI.', code: 'PlainRenderer' },
    { n: 'OpenTelemetry', ic: 'otel', c: 'var(--orange)', tag: 'TELEMETRY', p: 'diagprint-otel exports with privacy-aware attribute handling.', code: 'diagprint-otel' }
  ];
  (function surfaces() {
    const el = $('#surfaceGrid'); if (!el) return;
    el.innerHTML = SURF.map(s => `<button type="button" class="surf reveal" style="--c:${s.c}" ${s.fmt ? `data-fmt="${s.fmt}"` : ''}><span class="s-tag">${s.tag}</span><span class="s-ic"><svg><use href="#i-${s.ic}"/></svg></span><h3>${s.n}</h3><p>${s.p}</p><code>${esc(s.code)}${s.fmt ? '  → try it in the lab' : ''}</code></button>`).join('');
    el.querySelectorAll('.surf').forEach(b => b.addEventListener('click', () => {
      if (!b.dataset.fmt) return;
      $(`#fmtTabs [data-fmt="${b.dataset.fmt}"]`)?.click(); $('#lab').scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
    }));
  })();
  $$('[data-surface]').forEach(a => a.addEventListener('click', () => $(`#fmtTabs [data-fmt="${a.dataset.surface}"]`)?.click()));

  (function gates() {
    const el = $('#gates'); if (!el) return;
    const G = [['MachineApplicable', 'Only edits marked machine_applicable are ever applied.'], ['Expected contents', 'Edits must still match the source they were made for.'], ['UTF-8 boundaries', 'No edit may split a character.'], ['No overlaps', 'Overlapping edits and duplicate insertions are rejected.'], ['Preconditions', 'Declared preconditions and trusted roots must hold.'], ['Recover + verify', 'Recovery state first, rollback on failure or failed verification.']];
    el.innerHTML = G.map((g, i) => `<div class="gate"><span class="g-n">GATE ${String(i + 1).padStart(2, '0')}</span><b>${g[0]}</b><p>${g[1]}</p></div>`).join('');
    if (still) return;
    new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      const gs = [...el.children]; gs.forEach((g, i) => setTimeout(() => { g.classList.add('lit'); setTimeout(() => g.classList.remove('lit'), 900); }, i * 220));
    }, { threshold: .5 }).observe(el);
  })();

  const CRATES = [
    { n: 'diagprint', ic: 'print', c: 'var(--acid)', p: 'The lifecycle framework: diagnostics, renderers, remediation, history and forensics.', core: true },
    { n: 'diagprint-derive', ic: 'pen', c: 'var(--cyan)', p: 'Derive macros for structured, typed diagnostics.' },
    { n: 'diagprint-async', ic: 'bolt', c: 'var(--orange)', p: 'Bounded asynchronous diagnostic delivery.' },
    { n: 'diagprint-lsp', ic: 'lsp', c: 'var(--pink)', p: 'Language Server Protocol diagnostics and code actions.' },
    { n: 'diagprint-otel', ic: 'otel', c: 'var(--orange)', p: 'Privacy-aware OpenTelemetry integration.' },
    { n: 'diagprint-bridge', ic: 'chain', c: 'var(--cyan)', p: 'Reusable SDK for building structured ecosystem adapters.' },
    { n: 'diagprint-error-stack', ic: 'graph', c: 'var(--pink)', p: 'Structured error-stack interop with private-by-default attachments.' },
    { n: 'diagprint-test', ic: 'flask', c: 'var(--acid)', p: 'Testing assertions and snapshot helpers.' }
  ];
  (function crates() {
    const el = $('#crates');
    if (el) el.innerHTML = CRATES.map(c => `<a class="crate reveal${c.core ? ' core' : ''}" style="--c:${c.c}" href="https://crates.io/crates/${c.n}"><svg class="go"><use href="#i-ext"/></svg><span class="s-ic"><svg><use href="#i-${c.ic}"/></svg></span><b>${c.n}</b><p>${c.p}</p></a>`).join('');
    const mega = $('#megaCrates');
    if (mega) mega.innerHTML = CRATES.map(c => `<a href="https://crates.io/crates/${c.n}"><svg><use href="#i-${c.ic}"/></svg><b>${c.n}</b><span>${c.p.split('.')[0].toLowerCase()}</span></a>`).join('');
  })();

  (function flags() {
    const el = $('#flags'); if (!el) return;
    const F = [['artifact-store', 'append-only artifact generations with filesystem locking'], ['derive', 'typed diagnostic derive support'], ['compression', 'gzip and Zstandard report compression'], ['html', 'HTML diagnostic and report rendering'], ['cybercore', 'Cybercore theme integration'], ['terminal-docs', 'terminal documentation retrieval and highlighting'], ['anyhow', 'anyhow diagnostic integration'], ['tracing', 'tracing subscriber integration'], ['miette', 'miette interoperability'], ['codespan-reporting', 'codespan-reporting interoperability'], ['ariadne', 'Ariadne structured bridge'], ['annotate-snippets', 'annotate-snippets structured bridge']];
    const on = new Set(['derive', 'cybercore']);
    el.insertAdjacentHTML('afterend', '<p class="flag-tip" id="flagTip"></p>');
    el.innerHTML = F.map(([f, d]) => `<button type="button" class="flag" data-f="${f}" title="${d}" aria-pressed="${on.has(f)}">${f}</button>`).join('');
    const out = () => {
      const list = F.map(x => x[0]).filter(f => on.has(f));
      $('#cargoToml code').innerHTML = `<span class="c"># Cargo.toml</span>\n[dependencies]\n` + (list.length
        ? `diagprint = { version = <span class="s">"0.8"</span>, features = [\n${list.map(f => `    <span class="s">"${f}"</span>,`).join('\n')}\n] }`
        : `diagprint = <span class="s">"0.8"</span>`);
      $('#flagCount').textContent = `${list.length} feature${list.length === 1 ? '' : 's'}`;
    };
    el.querySelectorAll('.flag').forEach(b => {
      b.addEventListener('click', () => { const f = b.dataset.f; on.has(f) ? on.delete(f) : on.add(f); b.setAttribute('aria-pressed', String(on.has(f))); out(); });
      b.addEventListener('mouseenter', () => { $('#flagTip').textContent = `${b.dataset.f}: ${b.title}`; });
    });
    out();
  })();

  (function ticker() {
    const el = $('#ticker'); if (!el) return;
    const T = [['◆', 'SARIF 2.1.0'], ['▲', 'GITHUB ACTIONS ANNOTATIONS'], ['●', 'HASH-CHAINED HISTORY'], ['✗', 'STALE EDITS REJECTED'], ['◆', 'RUST 2024 · MSRV 1.85'], ['●', 'LSP CODE ACTIONS'], ['▲', 'PRIVACY-AWARE OTEL'], ['◆', 'CANONICAL FINGERPRINTS'], ['↻', 'REMEDIATION REPLAY'], ['●', 'GZIP + ZSTD'], ['◆', 'MIT OR APACHE-2.0']];
    const cols = ['var(--acid)', 'var(--pink)', 'var(--cyan)', 'var(--orange)'];
    const html = T.map((t, i) => `<span><b style="color:${cols[i % 4]}">${t[0]}</b>${t[1]}</span>`).join('');
    el.innerHTML = html + html;
  })();

  /* ═════════ nav ═════════ */
  $$('.mi-btn').forEach(b => b.addEventListener('click', () => {
    const mi = b.parentElement, open = !mi.classList.contains('open');
    $$('.mi').forEach(m => { m.classList.remove('open'); m.querySelector('.mi-btn').setAttribute('aria-expanded', 'false'); });
    mi.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  }));
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.mi')) $$('.mi').forEach(m => { m.classList.remove('open'); m.querySelector('.mi-btn').setAttribute('aria-expanded', 'false'); }); });
  $$('.mega a, .menu > a').forEach(a => a.addEventListener('click', () => { $$('.mi').forEach(m => m.classList.remove('open')); $('.menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.mi').forEach(m => { m.classList.remove('open'); m.querySelector('.mi-btn').setAttribute('aria-expanded', 'false'); }); });
  $('#burger')?.addEventListener('click', () => { const o = $('.menu').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', String(o)); });

  /* ═════════ ⌘K palette ═════════ */
  (function palette() {
    const pal = $('#palette'), input = $('#palInput'), list = $('#palList');
    const SECTIONS = [['Lifecycle', '#lifecycle', 'timeline'], ['Diagnostic Lab', '#lab', 'flask'], ['Surfaces', '#surfaces', 'term'], ['Safety model', '#safety', 'shield'], ['Forensics', '#forensics', 'why'], ['Ecosystem', '#ecosystem', 'crate'], ['Quick start', '#start', 'bolt']];
    const go = h => () => $(h).scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
    const items = () => [
      ...SECTIONS.map(([n, h, ic]) => ({ g: 'JUMP TO', n, ic, hint: h.slice(1), run: go(h) })),
      { g: 'ACTIONS', n: 'Copy the install command', ic: 'copy', hint: 'curl | sh', run: () => copy('curl -fsSL https://raw.githubusercontent.com/cybercore-tech/diagprint/main/install.sh | sh', 'INSTALL COMMAND COPIED') },
      { g: 'ACTIONS', n: 'Copy cargo add diagprint', ic: 'copy', hint: 'library', run: () => copy('cargo add diagprint') },
      { g: 'ACTIONS', n: 'Run a FixPlan in the lab', ic: 'wrench', hint: 'lab', run: () => { go('#lab')(); setTimeout(() => $('#labFix').click(), 500); } },
      { g: 'ACTIONS', n: 'Tamper with diagnostic history', ic: 'chain', hint: 'forensics', run: () => { go('#forensics')(); setTimeout(() => $('#tamper').click(), 500); } },
      { g: 'ACTIONS', n: 'Random theme', ic: 'palette', hint: 'R', run: randomTheme },
      ...['why', 'timeline', 'blame', 'graph', 'replay'].map(c => ({ g: 'CLI', n: `diagprint ${c} .diagprint/history <FP>`, ic: c === 'why' ? 'why' : c === 'timeline' ? 'timeline' : c === 'blame' ? 'blame' : c === 'graph' ? 'graph' : 'replay', hint: 'copy', run: () => copy(`diagprint ${c} .diagprint/history <FINGERPRINT>`) })),
      { g: 'CLI', n: 'diagprint scan . --static --history .diagprint/history --git-provenance', ic: 'term', hint: 'copy', run: () => copy('diagprint scan . --static --history .diagprint/history --git-provenance') },
      ...[['docs.rs', 'https://docs.rs/diagprint', 'crate'], ['GitHub', 'https://github.com/cybercore-tech/diagprint', 'github'], ['crates.io', 'https://crates.io/crates/diagprint', 'crate'], ['Releases', 'https://github.com/cybercore-tech/diagprint/releases', 'timeline'], ['Discord', 'https://discord.gg/vBMcK5wAx', 'discord'], ['Cybercore theme system', 'https://cybercore-tech.github.io/cybercore/', 'palette']].map(([n, u, ic]) => ({ g: 'LINKS', n, ic: ic, hint: '↗', run: () => { location.href = u; } })),
      ...(window.DP ? window.DP.all().map(t => ({ g: 'THEMES', n: window.DP.labelOf(t), ic: 'palette', hint: 'theme', run: () => window.DP.apply(t) })) : [])
    ];
    let all = [], shown = [], sel = 0;
    function render() {
      const q = input.value.trim().toLowerCase();
      shown = all.filter(i => !q || (i.n + ' ' + i.g + ' ' + i.hint).toLowerCase().includes(q)).slice(0, q ? 40 : 18);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      let g = '';
      list.innerHTML = shown.map((it, i) => { const head = it.g !== g ? `<div class="pal-g">${(g = it.g)}</div>` : ''; return `${head}<button class="pal-i${i === sel ? ' on' : ''}" data-i="${i}" role="option"><svg><use href="#i-${it.ic}"/></svg>${esc(it.n)}<small>${esc(it.hint)}</small></button>`; }).join('') || '<div class="pal-g">NO MATCH</div>';
      list.querySelectorAll('.pal-i').forEach(b => { b.addEventListener('click', () => run(+b.dataset.i)); b.addEventListener('mousemove', () => { if (sel !== +b.dataset.i) { sel = +b.dataset.i; mark(); } }); });
    }
    const mark = () => list.querySelectorAll('.pal-i').forEach(b => b.classList.toggle('on', +b.dataset.i === sel));
    function run(i) { const it = shown[i]; if (!it) return; close(); it.run(); }
    function open() { all = items(); pal.hidden = false; input.value = ''; sel = 0; render(); input.focus(); }
    function close() { pal.hidden = true; }
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % shown.length; mark(); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; mark(); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      else if (e.key === 'Escape') close();
    });
    pal.addEventListener('pointerdown', e => { if (e.target === pal) close(); });
    $('#openPalette').addEventListener('click', open);
    let gPressed = 0;
    document.addEventListener('keydown', e => {
      const typing = e.target.closest('input, textarea, [contenteditable]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? open() : close(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); open(); }
      else if (e.key.toLowerCase() === 'r' && pal.hidden) randomTheme();
      else if (e.key.toLowerCase() === 'g') gPressed = Date.now();
      else if (e.key.toLowerCase() === 'l' && Date.now() - gPressed < 800) go('#lab')();
    });
  })();
  function randomTheme() { if (!window.DP) return; const a = window.DP.all().filter(t => t !== window.DP.id); window.DP.apply(a[(Math.random() * a.length) | 0], { origin: { x: innerWidth / 2, y: 80 } }); }

  /* ═════════ generic effects ═════════ */
  function burst(x, y, n = 24) {
    if (still) return;
    const cols = [C.acid, C.pink, C.cyan, C.orange];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'spark'; s.style.setProperty('--c', cols[i % 4]); s.style.left = `${x}px`; s.style.top = `${y}px`; document.body.append(s);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 100;
      s.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }], { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
    }
  }
  $('#labFix')?.addEventListener('click', e => burst(e.clientX, e.clientY, 16));

  const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } }), { threshold: .12 });
  const watchReveal = () => $$('.reveal:not(.in)').forEach(el => still ? el.classList.add('in') : ro.observe(el));
  watchReveal();

  const prog = $('#progress');
  addEventListener('scroll', () => { const m = document.documentElement.scrollHeight - innerHeight; prog?.style.setProperty('--p', m > 0 ? scrollY / m : 0); }, { passive: true });

  if (fine) document.addEventListener('pointermove', e => {
    const t = e.target.closest('.surf'); if (!t) return;
    const r = t.getBoundingClientRect(); t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  $$('pre[data-copy]').forEach(pre => {
    const b = document.createElement('button'); b.className = 'copy'; b.type = 'button'; b.innerHTML = '<svg><use href="#i-copy"/></svg>COPY';
    b.addEventListener('click', () => copy(pre.querySelector('code').innerText));
    pre.append(b);
  });
})();
