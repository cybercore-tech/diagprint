/* diagprint site — CYBERGRID theme engine.
 * Same registry, storage key and menu behaviour as every Cybercore site:
 *   <dataRoot>/cybergrid.json, <dataRoot>/themes/<family>/<name>.json
 * SITE.mashups blend surfaces from `base` with neons from `accent`.
 * Emits `cc:theme` with the active palette.
 */
(() => {
  const root = document.documentElement;
  const SITE = window.SITE || { mashups: [] };
  const DATA = (SITE.dataRoot || '/data').replace(/\/$/, '');
  const STORE = 'cybercore-theme';
  const VARS = { bg: '--bg', white: '--white', acid_green: '--acid', hot_pink: '--pink', purple: '--purple', cyan: '--cyan', orange: '--orange', red: '--red', panel: '--panel', line: '--line', muted: '--muted' };
  const SURFACE = ['bg', 'white', 'panel', 'line', 'muted'];
  const FALLBACK = { bg: '0e100f', white: 'd1d1d1', panel: '191c1a', line: '313835', muted: '7b827f', acid_green: '7fff00', hot_pink: 'ff00aa', purple: '7209b7', cyan: '00f0ff', orange: 'ff6600', red: 'd00000' };
  const LABELS = { mashup: 'DIAGPRINT SIGNATURE', 'cybercore-tech': 'CYBERCORE TECH / MASTER MIX', cyberdyne: 'CYBERDYNE', cyberpunk: 'CYBERPUNK', default: 'DEFAULT / CLASSICS', dystopian: 'DYSTOPIAN', neosynth: 'NEOSYNTH', synthwave: 'SYNTHWAVE' };
  const $ = s => document.querySelector(s);
  const display = s => s.replaceAll('-', ' ').toUpperCase();

  let families = {}, current = null, palette = FALLBACK;
  const cache = {};
  const familyOf = n => Object.keys(families).find(f => families[f].includes(n));
  const mashOf = id => SITE.mashups.find(m => m.id === id);
  const labelOf = id => (mashOf(id) ? mashOf(id).label : display(id));
  const all = () => SITE.mashups.map(m => m.id).concat(Object.values(families).flat());

  async function load(name) {
    if (cache[name]) return cache[name];
    const f = familyOf(name); if (!f) throw new Error(`unknown theme ${name}`);
    const r = await fetch(`${DATA}/themes/${f}/${name}.json`); if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return (cache[name] = await r.json());
  }
  async function resolve(id) {
    const m = mashOf(id); if (!m) return load(id);
    const [b, a] = await Promise.all([load(m.base), load(m.accent)]);
    const out = { ...a }; SURFACE.forEach(k => { out[k] = b[k]; }); return out;
  }
  function paint(id, p) {
    Object.entries(VARS).forEach(([k, v]) => p[k] && root.style.setProperty(v, `#${p[k]}`));
    root.style.setProperty('--fg', `#${p.white}`);
    root.dataset.theme = id; current = id; palette = p;
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = `#${p.bg}`;
    $('#themeLabel').textContent = labelOf(id);
    document.querySelectorAll('#themeList .theme-option').forEach(o => o.setAttribute('aria-selected', String(o.dataset.value === id)));
    document.dispatchEvent(new CustomEvent('cc:theme', { detail: { id, palette: p } }));
  }
  async function apply(id, { persist = true, origin } = {}) {
    let p; try { p = await resolve(id); } catch (e) { console.warn('theme', e); id = SITE.defaultTheme; p = FALLBACK; }
    const go = () => paint(id, p);
    if (origin && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.style.setProperty('--vx', `${origin.x}px`); root.style.setProperty('--vy', `${origin.y}px`);
      document.startViewTransition(go);
    } else go();
    if (persist) { try { localStorage.setItem(STORE, id); } catch {} const u = new URL(location.href); u.searchParams.set('theme', id); history.replaceState(null, '', u); }
  }

  /* menu */
  const button = $('#themeButton'), menu = $('#themeMenu'), list = $('#themeList'), filter = $('#themeFilter');
  function build() {
    list.innerHTML = '';
    const groups = [['mashup', SITE.mashups.map(m => m.id)], ...Object.entries(families)];
    groups.forEach(([fam, names]) => {
      if (!names.length) return;
      const h = document.createElement('div'); h.className = 'theme-group-label'; h.dataset.family = fam;
      h.innerHTML = `${LABELS[fam] || fam.toUpperCase()}<em>${names.length}</em>`; list.append(h);
      names.forEach((n, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'theme-option'; b.setAttribute('role', 'option');
        b.dataset.value = n; b.dataset.family = fam; b.dataset.tone = i % 2 ? 'alt' : 'base';
        b.innerHTML = `<span>${labelOf(n)}</span><span class="dots"></span>`;
        b.addEventListener('click', ev => { apply(n, { origin: { x: ev.clientX, y: ev.clientY } }); close(); });
        list.append(b);
      });
    });
    filter.placeholder = `FILTER ${all().length} THEMES…`;
  }
  async function dots() {
    await Promise.all(Object.values(families).flat().map(n => load(n).catch(() => null)));
    for (const b of list.querySelectorAll('.theme-option')) {
      const p = await resolve(b.dataset.value).catch(() => null);
      if (p) b.querySelector('.dots').innerHTML = ['acid_green', 'hot_pink', 'cyan'].map(k => `<i style="background:#${p[k]}"></i>`).join('');
    }
  }
  function open() { menu.hidden = false; button.setAttribute('aria-expanded', 'true'); const s = list.querySelector('[aria-selected="true"]'); if (s) list.scrollTop = s.offsetTop - list.clientHeight / 2; if (matchMedia('(pointer:fine)').matches) filter.focus({ preventScroll: true }); }
  function close() { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); filter.value = ''; runFilter(''); }
  function runFilter(q) {
    q = q.trim().toLowerCase().replaceAll(' ', '-'); let head = null, any = false;
    [...list.children].forEach(el => {
      if (el.classList.contains('theme-group-label')) { if (head) head.hidden = !any; head = el; any = false; return; }
      const hit = !q || el.dataset.value.includes(q) || el.dataset.family.includes(q) || el.textContent.toLowerCase().replaceAll(' ', '-').includes(q);
      el.hidden = !hit; any = any || hit;
    });
    if (head) head.hidden = !any;
  }
  button.addEventListener('click', () => (menu.hidden ? open() : close()));
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('#picker')) close(); });
  filter.addEventListener('input', () => runFilter(filter.value));
  menu.addEventListener('keydown', e => {
    const opts = [...list.querySelectorAll('.theme-option:not([hidden])')], i = opts.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); button.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0])?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? filter : opts[i - 1])?.focus(); }
    else if (e.key === 'Enter' && document.activeElement === filter && opts[0]) { e.preventDefault(); opts[0].click(); setTimeout(() => button.focus({ preventScroll: true })); }
  });

  /* toast */
  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1700); }

  async function boot() {
    try { families = (await (await fetch(`${DATA}/cybergrid.json`)).json()).families || {}; }
    catch (e) { console.warn('theme registry offline', e); paint(SITE.defaultTheme, FALLBACK); $('#themeLabel').textContent = 'REGISTRY OFFLINE'; return; }
    build();
    const known = n => n && (mashOf(n) || familyOf(n));
    const req = new URLSearchParams(location.search).get('theme');
    let saved = null; try { saved = localStorage.getItem(STORE); } catch {}
    await apply([req, saved, SITE.defaultTheme].find(known) || SITE.defaultTheme, { persist: Boolean(req) });
    dots();
  }
  paint(SITE.defaultTheme, FALLBACK);
  window.DP = { apply, toast, all, labelOf, get palette() { return palette; }, get id() { return current; } };
  boot();
})();
