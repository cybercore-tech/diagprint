/* Diagnostic Lab — a browser-side model of the diagprint lifecycle.
 *
 * scan()      lints a small TOML-ish config into structured diagnostics
 *             (severity, code, primary + secondary labels, cause, notes, help,
 *             suggestions with diagprint's applicability levels)
 * render*()   the same diagnostics as terminal, JSON (ExportDiagnostic shape),
 *             SARIF 2.1.0, GitHub Actions workflow commands, Markdown, LSP
 * fixPlan()   guarded remediation: only machine_applicable edits, expected
 *             source contents must still match, no overlaps, recovery state,
 *             post-fix verification with rollback. Stale edits are rejected.
 * It is a model for the page, not the crate; the real thing is Rust.
 */
(() => {
  const FILE = 'uplink/config.toml';
  const INITIAL = `# uplink relay — sector 7
[uplink]
node = "sector-7"
port = 80800
retries = -3
tls = "maybe"
timout_ms = 1500

[telemetry]
endpoint = "http://collector.sector7.local:4317"
sample_rate = 1.5
`;
  const SCHEMA = {
    uplink: { node: 'string', port: 'int', retries: 'int', tls: 'bool', timeout_ms: 'int' },
    telemetry: { endpoint: 'string', sample_rate: 'float' }
  };
  const REQUIRED = { uplink: ['node'] };
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const ta = $('#edText'); if (!ta) return;

  let rev = 1, boundRev = 1, diags = [], fmt = 'terminal', busy = false, snapshot = '';

  /* ---------- scanning ---------- */
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const typeOf = v => /^".*"$/.test(v) ? 'string' : /^(true|false)$/.test(v) ? 'bool' : /^[+-]?\d+$/.test(v) ? 'int' : /^[+-]?\d+\.\d+$/.test(v) ? 'float' : 'unknown';
  const fnv = s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

  function scan(text) {
    const out = [], lines = text.split('\n'), seen = {};
    let section = null, sectionLine = 0;
    const sections = {};
    const D = (o) => { o.fingerprint = fnv(`${o.code}|${o.key || ''}|${o.section || ''}`) + fnv(o.code).slice(0, 4); out.push(o); return o; };
    lines.forEach((raw, i) => {
      const ln = i + 1, line = raw.replace(/\s+$/, '');
      if (!line.trim() || /^\s*#/.test(line)) return;
      let m = line.match(/^(\s*)\[([A-Za-z0-9_.-]+)\]\s*(#.*)?$/);
      if (m) {
        section = m[2]; sectionLine = ln; sections[section] = { line: ln, keys: {} };
        if (!SCHEMA[section]) D({ severity: 'warning', code: 'W-CFG-020', message: `unknown section \`[${section}]\``, line: ln, col: m[1].length + 2, len: section.length, label: 'not part of the uplink schema', help: `known sections: ${Object.keys(SCHEMA).map(s => `[${s}]`).join(', ')}`, section });
        return;
      }
      m = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*?)(\s*#.*)?$/);
      if (!m || !m[4]) { D({ severity: 'error', code: 'E-PARSE-001', message: 'expected `key = value`', line: ln, col: 1, len: Math.max(1, line.length), label: 'cannot parse this line', help: 'write a `key = value` pair, a `[section]` header, or a `# comment`' }); return; }
      const [, ind, key, eq, val] = m;
      const kcol = ind.length + 1, vcol = ind.length + key.length + eq.length + 1;
      if (!section) { D({ severity: 'error', code: 'CFG-008', message: `\`${key}\` is outside any section`, line: ln, col: kcol, len: key.length, label: 'top-level key', help: 'move it under `[uplink]` or `[telemetry]`', key }); return; }
      const schema = SCHEMA[section]; if (!schema) return;
      const s = sections[section];
      if (s.keys[key]) {
        D({ severity: 'error', code: 'CFG-007', message: `duplicate key \`${key}\``, line: ln, col: kcol, len: key.length, label: 'defined again here', secondary: { line: s.keys[key].line, col: s.keys[key].col, len: key.length, label: 'first defined here' }, help: 'remove one of the definitions', key, section });
        return;
      }
      s.keys[key] = { line: ln, col: kcol, val, vcol };
      if (!(key in schema)) {
        const best = Object.keys(schema).map(k => [k, lev(key, k)]).sort((a, b) => a[1] - b[1])[0];
        const d = D({ severity: 'warning', code: 'W-CFG-010', message: `unknown key \`${key}\` in \`[${section}]\``, line: ln, col: kcol, len: key.length, label: 'not recognised', key, section });
        if (best && best[1] <= 2 && !s.keys[best[0]]) { d.help = `did you mean \`${best[0]}\`?`; d.fix = { applicability: 'machine_applicable', title: `rename to \`${best[0]}\``, edit: { line: ln, col: kcol, expect: key, replace: best[0] } }; }
        else d.help = `known keys: ${Object.keys(schema).join(', ')}`;
        return;
      }
      const want = schema[key], got = typeOf(val);
      if (got !== want && !(want === 'float' && got === 'int')) {
        const d = D({ severity: 'error', code: 'CFG-003', message: `\`${key}\` expects ${want === 'int' ? 'an' : 'a'} ${want}`, line: ln, col: vcol, len: val.length, label: `found ${got === 'unknown' ? 'an unparsable value' : `a ${got}`}`, key, section });
        if (want === 'bool' && /^"(true|false)"$/.test(val)) { d.help = 'drop the quotes'; d.fix = { applicability: 'machine_applicable', title: `use ${val.slice(1, -1)}`, edit: { line: ln, col: vcol, expect: val, replace: val.slice(1, -1) } }; }
        else if (want === 'bool') { d.help = 'use `true` or `false`'; d.fix = { applicability: 'has_placeholders', title: 'replace with a boolean', edit: { line: ln, col: vcol, expect: val, replace: '<true|false>' } }; d.notes = ['a quoted word is a string, not a boolean']; }
        else d.help = `write a ${want} literal`;
        return;
      }
      const num = parseFloat(val);
      if (key === 'port' && (num < 1 || num > 65535)) {
        D({ severity: 'error', code: 'CFG-001', message: 'port out of range', line: ln, col: vcol, len: val.length, label: `${val} ${num > 65535 ? 'exceeds 65535' : 'is below 1'}`, cause: 'TCP ports are 16-bit unsigned integers', help: 'use a port between 1 and 65535', fix: { applicability: 'maybe_incorrect', title: 'use 8080', edit: { line: ln, col: vcol, expect: val, replace: '8080' } }, key, section });
      }
      if (key === 'retries' && num < 0) {
        D({ severity: 'error', code: 'CFG-002', message: 'retries must not be negative', line: ln, col: vcol, len: val.length, label: 'negative retry budget', help: `use ${Math.abs(num)}`, fix: { applicability: 'machine_applicable', title: `use ${Math.abs(num)}`, edit: { line: ln, col: vcol, expect: val, replace: String(Math.abs(num)) } }, key, section });
      } else if (key === 'retries' && num > 10) {
        D({ severity: 'warning', code: 'W-CFG-011', message: 'retry budget is unusually high', line: ln, col: vcol, len: val.length, label: 'more than 10 retries', help: 'cap retries at 10', fix: { applicability: 'machine_applicable', title: 'cap at 10', edit: { line: ln, col: vcol, expect: val, replace: '10' } }, key, section });
      }
      if (key === 'timeout_ms' && (num < 100 || num > 60000)) {
        D({ severity: 'warning', code: 'W-CFG-012', message: 'timeout outside the supported window', line: ln, col: vcol, len: val.length, label: 'expected 100..=60000', help: 'pick a timeout between 100 ms and 60 s', key, section });
      }
      if (key === 'sample_rate' && (num < 0 || num > 1)) {
        const c = num < 0 ? '0.0' : '1.0';
        D({ severity: 'error', code: 'CFG-005', message: 'sample_rate must be within 0.0..=1.0', line: ln, col: vcol, len: val.length, label: `${val} is not a probability`, help: `clamp to ${c}`, notes: ['1.0 samples every span; 0.0 disables export'], fix: { applicability: 'machine_applicable', title: `clamp to ${c}`, edit: { line: ln, col: vcol, expect: val, replace: c } }, key, section });
      }
      if (key === 'endpoint' && /^"http:\/\//.test(val)) {
        const tls = sections.uplink && sections.uplink.keys.tls;
        const d = D({ severity: 'warning', code: 'W-SEC-004', message: 'telemetry endpoint is not encrypted', line: ln, col: vcol + 1, len: 7, label: 'plain http', help: 'use https', cause: 'diagnostic exports can carry source paths and messages', fix: { applicability: 'machine_applicable', title: 'switch to https', edit: { line: ln, col: vcol + 1, expect: 'http://', replace: 'https://' } }, key, section });
        if (tls) d.secondary = { line: tls.line, col: tls.vcol, len: tls.val.length, label: 'uplink transport security is configured here' };
      }
    });
    Object.entries(REQUIRED).forEach(([sec, keys]) => {
      const s = sections[sec];
      if (!s) { D({ severity: 'error', code: 'CFG-009', message: `missing section \`[${sec}]\``, line: 1, col: 1, len: Math.max(1, (lines[0] || '').length), label: 'required section not found', help: `add a \`[${sec}]\` section`, section: sec }); return; }
      keys.forEach(k => { if (!s.keys[k]) D({ severity: 'error', code: 'CFG-006', message: `missing required key \`${k}\``, line: s.line, col: 2, len: sec.length, label: `\`[${sec}]\` has no \`${k}\``, help: `add \`${k} = "…"\``, fix: { applicability: 'has_placeholders', title: `add ${k}`, edit: { line: s.line + 1, col: 1, expect: '', replace: `${k} = "<name>"\n` } }, key: k, section: sec }); });
    });
    return out.sort((a, b) => a.line - b.line || a.col - b.col);
  }

  /* ---------- renderers ---------- */
  const lines = () => snapshot.split('\n'); // diagnostics render against the revision they were bound to
  function renderTerminal(ds) {
    const src = lines(); let o = '';
    if (!ds.length) return `<span class="t-dim">$ diagprint check ${FILE}</span>\n\n<span class="t-ok">✓ no diagnostics</span> <span class="t-dim">// 0 errors · 0 warnings</span>\n<span class="t-dim">report: diagprint.canonical/v1 · clean</span>`;
    o += `<span class="t-dim">$ diagprint check ${FILE}</span>\n\n`;
    ds.forEach(d => {
      const sev = d.severity === 'error' ? 't-err' : 't-warn';
      const w = String(Math.max(d.line, d.secondary ? d.secondary.line : 0)).length, pad = ' '.repeat(w);
      o += `<span class="${sev}">${d.severity}[${d.code}]</span><span class="t-b">: ${esc(d.message)}</span>\n`;
      o += `${pad}<span class="t-dim">--&gt;</span> <span class="t-path">${FILE}:${d.line}:${d.col}</span>\n${pad} <span class="t-dim">|</span>\n`;
      const rows = [{ ...d, primary: true }]; if (d.secondary) rows.push({ ...d.secondary, primary: false });
      rows.sort((a, b) => a.line - b.line).forEach((r, idx) => {
        if (idx && r.line - rows[idx - 1].line > 1) o += `<span class="t-dim">${pad}...</span>\n`;
        o += `<span class="t-num">${String(r.line).padStart(w)}</span> <span class="t-dim">|</span> ${esc(src[r.line - 1] || '')}\n`;
        o += `${pad} <span class="t-dim">|</span> ${' '.repeat(Math.max(0, r.col - 1))}<span class="${r.primary ? 't-car' : 't-car2'}">${(r.primary ? '^' : '-').repeat(Math.max(1, r.len))} ${esc(r.label)}</span>\n`;
      });
      o += `${pad} <span class="t-dim">|</span>\n`;
      if (d.cause) o += `${pad} <span class="t-dim">=</span> <span class="t-cause">cause:</span> ${esc(d.cause)}\n`;
      (d.notes || []).forEach(n => { o += `${pad} <span class="t-dim">=</span> <span class="t-note">note:</span> ${esc(n)}\n`; });
      if (d.help) o += `${pad} <span class="t-dim">=</span> <span class="t-help">help:</span> ${esc(d.help)}\n`;
      if (d.fix) o += `${pad} <span class="t-dim">=</span> <span class="t-p">suggestion</span> <span class="t-dim">(${d.fix.applicability}):</span> ${esc(d.fix.title)}\n`;
      o += '\n';
    });
    const e = ds.filter(d => d.severity === 'error').length, w = ds.length - e, ma = ds.filter(d => d.fix && d.fix.applicability === 'machine_applicable').length;
    o += `<span class="${e ? 't-err' : 't-warn'}">${e ? 'error' : 'warning'}</span><span class="t-b">: ${e} error${e === 1 ? '' : 's'}, ${w} warning${w === 1 ? '' : 's'} emitted</span> <span class="t-dim">// ${ma} machine-applicable fix${ma === 1 ? '' : 'es'}</span>`;
    return o;
  }
  const uuid = seed => { const h = (fnv(seed) + fnv(seed + '1') + fnv(seed + '2') + fnv(seed + '3')); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  const SESSION = uuid('session' + Date.now());
  function exportShape(d) {
    const labels = [{ location: { file: FILE, line: d.line, column: d.col }, length: d.len, message: d.label }];
    if (d.secondary) labels.push({ kind: 'secondary', location: { file: FILE, line: d.secondary.line, column: d.secondary.col }, length: d.secondary.len, message: d.secondary.label });
    const o = { report_id: uuid(d.fingerprint + rev), session_id: SESSION, timestamp: new Date().toISOString().replace('Z', '+00:00'), application: 'uplink', severity: d.severity, code: d.code, message: d.message.replace(/`/g, ''), attribute_count: 0, labels };
    if (d.notes && d.notes.length) o.notes = d.notes;
    if (d.help) o.help = d.help;
    if (d.cause) o.cause = { message: d.cause, source: null };
    if (d.fix) o.suggestions = [{ title: d.fix.title, applicability: d.fix.applicability, edit_count: 1, command_count: 0 }];
    return o;
  }
  const hiJson = s => esc(s).replace(/("(?:[^"\\]|\\.)*")(\s*:)?/g, (m, str, colon) => colon ? `<span class="t-note">${str}</span>${colon}` : `<span class="t-help">${str}</span>`).replace(/\b(-?\d+(?:\.\d+)?|null|true|false)\b/g, '<span class="t-cause">$1</span>');
  function renderJson(ds) { return hiJson(JSON.stringify(ds.map(exportShape), null, 2)); }
  function renderSarif(ds) {
    const rules = [...new Set(ds.map(d => d.code))];
    const loc = (l) => ({ physicalLocation: { artifactLocation: { uri: FILE }, region: { startLine: l.line, startColumn: l.col, endColumn: l.col + l.len } } });
    const doc = { $schema: 'https://json.schemastore.org/sarif-2.1.0.json', version: '2.1.0', runs: [{ tool: { driver: { name: 'diagprint', version: '0.8.0', informationUri: 'https://github.com/cybercore-tech/diagprint', rules: rules.map(id => ({ id, shortDescription: { text: ds.find(d => d.code === id).message.replace(/`/g, '') } })) } },
      results: ds.map(d => { const r = { ruleId: d.code, ruleIndex: rules.indexOf(d.code), level: d.severity === 'error' ? 'error' : 'warning', message: { text: d.message.replace(/`/g, '') }, locations: [loc(d)] }; if (d.secondary) r.relatedLocations = [{ id: 1, ...loc(d.secondary), message: { text: d.secondary.label } }]; return r; }) }] };
    return hiJson(JSON.stringify(doc, null, 2));
  }
  const ghEsc = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const ghProp = s => ghEsc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
  function renderGha(ds) {
    if (!ds.length) return '<span class="t-dim"># no annotations</span>';
    return ds.flatMap(d => {
      const cmd = d.severity === 'error' ? 'error' : 'warning';
      const out = [`<span class="${d.severity === 'error' ? 't-err' : 't-warn'}">::${cmd}</span> <span class="t-note">file=${FILE},line=${d.line},col=${d.col},endColumn=${d.col + d.len},title=${ghProp(d.code)}</span><span class="t-dim">::</span>${esc(ghEsc(d.message.replace(/`/g, '')))}`];
      if (d.secondary) out.push(`<span class="t-help">::notice</span> <span class="t-note">file=${FILE},line=${d.secondary.line},col=${d.secondary.col},endColumn=${d.secondary.col + d.secondary.len},title=${ghProp(d.code + ' related')}</span><span class="t-dim">::</span>${esc(ghEsc(d.secondary.label))}`);
      return out;
    }).join('\n') + '\n\n<span class="t-dim"># secondary labels are notices, so related context never reads as an extra failure</span>';
  }
  function renderMarkdown(ds) {
    if (!ds.length) return '<span class="t-dim">_No diagnostics._</span>';
    return ds.map(d => {
      let s = `<span class="t-p">## ${d.severity}</span> <span class="t-b">— ${esc(d.message)}</span> — <span class="t-help">\`${d.code}\`</span>\n\n`;
      s += `- **Location:** \`${FILE}:${d.line}:${d.col}\` (length: \`${d.len}\`) — ${esc(d.label)}\n`;
      if (d.secondary) s += `- **Related:** \`${FILE}:${d.secondary.line}:${d.secondary.col}\` — ${esc(d.secondary.label)}\n`;
      if (d.cause) s += `- **Cause:** ${esc(d.cause)}\n`;
      (d.notes || []).forEach(n => { s += `- **Note:** ${esc(n)}\n`; });
      if (d.help) s += `- **Help:** ${esc(d.help)}\n`;
      if (d.fix) s += `\n<span class="t-note">### ${esc(d.fix.title)}</span>\n\nApplicability: \`${d.fix.applicability}\`\n`;
      return s;
    }).join('\n<span class="t-dim">---</span>\n\n');
  }
  function renderLsp(ds) {
    const rng = l => ({ start: { line: l.line - 1, character: l.col - 1 }, end: { line: l.line - 1, character: l.col - 1 + l.len } });
    const params = { uri: `file:///srv/${FILE}`, version: rev, diagnostics: ds.map(d => { const o = { range: rng(d), severity: d.severity === 'error' ? 1 : 2, code: d.code, source: 'diagprint', message: d.message.replace(/`/g, '') }; if (d.secondary) o.relatedInformation = [{ location: { uri: `file:///srv/${FILE}`, range: rng(d.secondary) }, message: d.secondary.label }]; return o; }) };
    const actions = ds.filter(d => d.fix && d.fix.applicability === 'machine_applicable').map(d => `<span class="t-dim">// code action:</span> <span class="t-help">quickfix</span> “${esc(d.fix.title)}” <span class="t-dim">→ ${d.code}</span>`);
    return `<span class="t-dim">// textDocument/publishDiagnostics</span>\n${hiJson(JSON.stringify(params, null, 2))}${actions.length ? '\n\n' + actions.join('\n') : ''}`;
  }
  const RENDER = { terminal: renderTerminal, json: renderJson, sarif: renderSarif, gha: renderGha, markdown: renderMarkdown, lsp: renderLsp };

  /* ---------- editor overlay ---------- */
  function highlight(text, ds) {
    const src = text.split('\n');
    const marks = src.map(() => []);
    ds.forEach(d => { if (marks[d.line - 1]) marks[d.line - 1].push([d.col - 1, d.col - 1 + Math.max(1, d.len), d.severity === 'error' ? 'e' : 'w']); });
    return src.map((line, i) => {
      const tok = new Array(line.length).fill('');
      const c = line.indexOf('#'); const code = c >= 0 && !/".*#.*"/.test(line.slice(0, c + 1)) ? c : line.length;
      for (let k = code; k < line.length; k++) tok[k] = 'hc';
      let m = line.match(/^(\s*)\[[^\]]*\]/); if (m) for (let k = m[1].length; k < m[0].length; k++) tok[k] = 'hh';
      m = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/);
      if (m) {
        for (let k = m[1].length; k < m[1].length + m[2].length; k++) tok[k] = 'hk';
        const vs = m[1].length + m[2].length + m[3].length, v = m[4], cls = /^"/.test(v) ? 'hs' : /^[+-]?\d/.test(v) ? 'hn' : /^(true|false)/.test(v) ? 'hn' : '';
        for (let k = vs; k < Math.min(code, line.length); k++) if (!tok[k]) tok[k] = cls;
      }
      const mk = new Array(line.length).fill('');
      marks[i].forEach(([a, b, s]) => { for (let k = a; k < Math.min(b, line.length || 1); k++) mk[k] = s; });
      let html = '', k = 0;
      while (k < line.length) {
        let j = k; while (j < line.length && tok[j] === tok[k] && mk[j] === mk[k]) j++;
        let seg = esc(line.slice(k, j)); if (tok[k]) seg = `<span class="${tok[k]}">${seg}</span>`; if (mk[k]) seg = `<mark class="${mk[k] === 'w' ? 'w' : ''}">${seg}</mark>`;
        html += seg; k = j;
      }
      if (!line.length && marks[i].length) html = '<mark> </mark>';
      return html;
    }).join('\n') + '\n';
  }
  function gutter(text, ds) {
    const n = text.split('\n').length, bad = {};
    ds.forEach(d => { bad[d.line] = bad[d.line] === 'err' || d.severity === 'error' ? 'err' : 'warn'; });
    $('#edGutter').innerHTML = Array.from({ length: n }, (_, i) => `<div class="${bad[i + 1] || ''}">${i + 1}</div>`).join('');
  }

  /* ---------- paint ---------- */
  function paint() {
    const text = ta.value;
    $('#edHl').innerHTML = highlight(text, diags); gutter(text, diags);
    $('#labOut').innerHTML = RENDER[fmt](diags);
    const e = diags.filter(d => d.severity === 'error').length, w = diags.length - e;
    const ma = diags.filter(d => d.fix && d.fix.applicability === 'machine_applicable').length;
    $('#edStatus').innerHTML = `<b class="e">✗ ${e} ERRORS</b><b class="w">▲ ${w} WARNINGS</b><b class="f">⚙ ${ma} MACHINE-APPLICABLE</b><span>FINGERPRINTS ${diags.slice(0, 3).map(d => d.fingerprint.slice(0, 6)).join(' ')}${diags.length > 3 ? ' …' : ''}</span>`;
    $('#labCounts').textContent = `${diags.length} DIAGNOSTICS · ${fmt.toUpperCase()}`;
    $('#labRev').textContent = `r${rev}`;
    const stale = rev !== boundRev;
    $('#labRev').classList.toggle('stale', stale);
    $('#fixBound').textContent = stale ? `bound to r${boundRev} · buffer r${rev} · STALE` : `bound to r${boundRev}`;
    $('#fixBound').classList.toggle('stale', stale);
    syncScroll();
  }
  function rescan() { snapshot = ta.value; diags = scan(snapshot); boundRev = rev; paint(); }
  function syncScroll() { const hl = $('#edHl'); hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; $('#edGutter').style.transform = `translateY(${-ta.scrollTop}px)`; }

  let t;
  ta.addEventListener('input', () => { rev++; clearTimeout(t); paint(); t = setTimeout(rescan, 160); });
  ta.addEventListener('scroll', syncScroll);
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
  document.querySelectorAll('#fmtTabs button').forEach(b => b.addEventListener('click', () => {
    fmt = b.dataset.fmt; document.querySelectorAll('#fmtTabs button').forEach(x => x.setAttribute('aria-selected', String(x === b))); paint();
  }));
  $('#labReset').addEventListener('click', () => { if (busy) return; ta.value = INITIAL; rev++; rescan(); resetTx(); });
  $('#labCopyOut').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#labOut').innerText); window.DP?.toast(`COPIED ${fmt.toUpperCase()}`); } catch {} });

  /* ---------- guarded remediation ---------- */
  const STEPS = ['collect machine_applicable edits', 'check applicability levels', 'verify expected source contents', 'check UTF-8 boundaries', 'reject overlapping edits', 'prepare resulting contents', 'create recovery state', 'write transaction', 'post-fix verification (rescan)', 'issue remediation receipt'];
  function resetTx(note) {
    $('#labTx').innerHTML = STEPS.map(s => `<li>${s}</li>`).join('');
    const n = $('#fixNote'); n.className = 'fix-note'; n.innerHTML = note || 'Only <code>machine_applicable</code> edits are applied. Everything else stays a suggestion.';
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const offsetOf = (text, line, col) => { const ls = text.split('\n'); let o = 0; for (let i = 0; i < line - 1; i++) o += ls[i].length + 1; return o + col - 1; };
  async function sha(s) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch { return fnv(s).repeat(8); } }

  async function applyPlan() {
    if (busy) return; busy = true; resetTx();
    const li = [...$('#labTx').children], note = $('#fixNote');
    const step = async (i, ok = true) => { li[i].className = 'go'; await sleep(230); li[i].className = ok ? 'ok' : 'bad'; };
    const fail = (i, msg) => { li[i].className = 'bad'; for (let k = i + 1; k < li.length; k++) li[k].className = 'skip'; note.className = 'fix-note bad'; note.innerHTML = msg; busy = false; window.DP?.toast('FIXPLAN REJECTED'); };
    const text = ta.value;
    const edits = diags.filter(d => d.fix && d.fix.applicability === 'machine_applicable').map(d => ({ d, ...d.fix.edit }));
    await step(0);
    if (!edits.length) { for (let k = 1; k < li.length; k++) li[k].className = 'skip'; note.className = 'fix-note'; note.innerHTML = 'Nothing machine-applicable. The remaining suggestions need a human: <code>maybe_incorrect</code> and <code>has_placeholders</code> are never applied automatically.'; busy = false; return; }
    const held = diags.filter(d => d.fix && d.fix.applicability !== 'machine_applicable').length;
    await step(1);
    li[2].className = 'go'; await sleep(260);
    for (const e of edits) {
      const o = offsetOf(text, e.line, e.col);
      if (text.slice(o, o + e.expect.length) !== e.expect) {
        const found = text.slice(o, o + Math.max(e.expect.length, 1)).split('\n')[0];
        return fail(2, `<b>Stale edit rejected.</b> ${e.d.code} expected <code>${esc(e.expect)}</code> at ${FILE}:${e.line}:${e.col} (r${boundRev}) but the buffer now has <code>${esc(found)}</code> (r${rev}). Nothing was written. Rescan to re-bind.`);
      }
    }
    li[2].className = 'ok';
    await step(3);
    li[4].className = 'go'; await sleep(200);
    const spans = edits.map(e => { const o = offsetOf(text, e.line, e.col); return [o, o + e.expect.length]; }).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < spans.length; k++) if (spans[k][0] < spans[k - 1][1]) return fail(4, '<b>Overlapping edits rejected.</b> Two fixes touch the same bytes.');
    li[4].className = 'ok';
    await step(5);
    let next = text;
    [...edits].sort((a, b) => offsetOf(text, b.line, b.col) - offsetOf(text, a.line, a.col)).forEach(e => { const o = offsetOf(text, e.line, e.col); next = next.slice(0, o) + e.replace + next.slice(o + e.expect.length); });
    const backup = text;
    await step(6);
    li[7].className = 'go'; await sleep(260);
    ta.value = next; rev++; li[7].className = 'ok';
    li[8].className = 'go'; await sleep(320);
    const after = scan(next);
    const fixed = new Set(edits.map(e => e.d.fingerprint));
    const regressed = after.filter(d => d.severity === 'error' && !diags.some(x => x.fingerprint === d.fingerprint));
    if (regressed.length || after.some(d => fixed.has(d.fingerprint))) { ta.value = backup; rev++; rescan(); return fail(8, '<b>Verification failed. Rolled back</b> to the recovery state.'); }
    rescan(); li[8].className = 'ok';
    li[9].className = 'go';
    const [before, aft] = await Promise.all([sha(backup), sha(next)]);
    await sleep(200); li[9].className = 'ok';
    note.className = 'fix-note good';
    note.innerHTML = `<b>${edits.length} edit${edits.length === 1 ? '' : 's'} applied and verified.</b> ${held ? `${held} suggestion${held === 1 ? '' : 's'} held back for a human. ` : ''}<br><span class="t-dim">receipt · before sha256:${before.slice(0, 16)}… → after sha256:${aft.slice(0, 16)}…</span>`;
    window.DP?.toast(`${edits.length} FIXES APPLIED · VERIFIED`);
    busy = false;
  }
  function mutate() {
    if (busy) return;
    const fixable = diags.find(d => d.fix && d.fix.applicability === 'machine_applicable');
    const text = ta.value;
    if (fixable) {
      const e = fixable.fix.edit, o = offsetOf(text, e.line, e.col);
      const swap = e.expect === 'http://' ? 'ftp://' : /^-?\d/.test(e.expect) ? e.expect.replace(/\d$/, m => String((+m + 7) % 10)) : e.expect.slice(0, -1) + 'x';
      ta.value = text.slice(0, o) + swap + text.slice(o + e.expect.length);
    } else ta.value = text + '# edited elsewhere\n';
    rev++; paint(); // deliberately no rescan: diagnostics stay bound to the old revision
    resetTx('Buffer changed behind the scan. Diagnostics are still bound to the old revision. Try <b>APPLY FIXPLAN</b> now.');
    window.DP?.toast(`BUFFER MUTATED · r${rev}`);
  }
  $('#labFix').addEventListener('click', applyPlan);
  $('#labStale').addEventListener('click', mutate);

  ta.value = INITIAL; resetTx(); rescan();
  window.DP_LAB = { scan, renderTerminal };
})();
