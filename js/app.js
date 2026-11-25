// Hábitos — núcleo do app: estado, navegação, folhas (modais), fotos e bloqueio.
import * as store from './store.js';
import { esc, todayKey, mkey, dayLabel, addDays } from './util.js';
import { HABITS } from './habits/index.js';
import today from './views/today.js';
import history from './views/history.js';
import evolution from './views/evolution.js';
import settings from './views/settings.js';
import lock from './views/lock.js';

// Abas na ordem pedida. Para um novo hábito: criar o arquivo em js/habits/ e registrar em habits/index.js.
const VIEWS = [today, ...HABITS.filter(h => h.tab !== false), history, evolution];
const ALL = [...VIEWS, settings, lock];

const ctx = {
  state: null,
  ui: { tab: 'hoje', date: todayKey(), month: mkey(new Date()) },
  habits: HABITS,
  store,
};
window.__habitos = ctx; // útil para depuração

// ---------- estado ----------
function defaults(s) {
  s = s || {};
  s.version = 1;
  s.settings = s.settings || { pin: null, lockAfterSec: 30, onboarded: false };
  s.settings.since = s.settings.since || todayKey();
  for (const h of HABITS) h.defaults && h.defaults(s);
  return s;
}

let saveTimer = null;
ctx.save = (rerender = true) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.kvSet('state', ctx.state).catch(e => ctx.toast('Erro ao salvar: ' + e.message)), 150);
  if (rerender) ctx.render();
};
// Primeiro dia de uso (ou o registro mais antigo): antes disso nada aparece como "esquecido".
ctx.since = () => {
  const s = ctx.state;
  let min = s.settings.since || todayKey();
  const keys = [...Object.keys(s.mealLog || {}), ...Object.keys((s.water || {}).log || {}), ...Object.keys(s.workoutLog || {}),
    ...(s.weights || []).map(w => w.date), ...(s.books || []).flatMap(b => b.log.map(e => e.date))];
  for (const k of keys) if (k < min) min = k;
  return min;
};
ctx.flush = async () => { clearTimeout(saveTimer); await store.kvSet('state', ctx.state); };
ctx.replaceState = async s => { ctx.state = defaults(s); await ctx.flush(); ctx.render(); };

// ---------- navegação ----------
ctx.go = (tab, opts = {}) => {
  if (opts.date) ctx.ui.date = opts.date;
  ctx.ui.tab = tab;
  ctx.render();
  window.scrollTo(0, 0);
};

function viewOf(id) { return ALL.find(v => (v.tabId || v.id) === id); }

ctx.dateNav = () => {
  const d = ctx.ui.date, t = todayKey();
  return `<div class="datenav">
    <button class="icon-btn" data-act="app:day" data-n="-1" aria-label="Dia anterior">‹</button>
    <button class="datenav-label" data-act="app:pickday">${esc(dayLabel(d))}${d !== t ? '' : ''}</button>
    <button class="icon-btn" data-act="app:day" data-n="1" aria-label="Próximo dia" ${d >= t ? 'disabled' : ''}>›</button>
  </div>${d !== t ? `<button class="back-today" data-act="app:today">voltar para hoje</button>` : ''}`;
};

ctx.render = () => {
  const main = document.getElementById('main');
  const v = viewOf(ctx.ui.tab) || today;
  document.getElementById('title').innerHTML = `<span class="t-emoji">${v.emoji}</span>${esc(v.title)}`;
  main.innerHTML = v.renderTab ? v.renderTab(ctx) : v.render(ctx);
  main.dataset.view = v.tabId || v.id;
  renderTabs();
  hydratePhotos(main);
  const sh = document.getElementById('sheet');
  if (sh.classList.contains('open') && sh._render) {
    sh.querySelector('.sheet-body').innerHTML = sh._render();
    hydratePhotos(sh);
  }
};

function renderTabs() {
  const bar = document.getElementById('tabs');
  bar.innerHTML = VIEWS.map(v => {
    const id = v.tabId || v.id;
    return `<button class="tab ${ctx.ui.tab === id ? 'on' : ''}" data-act="app:tab" data-tab="${id}" style="--c:${v.color}">
      <span class="tab-i">${v.emoji}</span><span class="tab-l">${esc(v.short || v.title)}</span></button>`;
  }).join('');
  const on = bar.querySelector('.on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export async function hydratePhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) {
    const u = await store.blobURL(img.dataset.photo);
    if (u) img.src = u; else img.closest('.photo')?.classList.add('missing');
  }
}
ctx.hydratePhotos = hydratePhotos;

// ---------- folhas (modais) ----------
let sheetResolve = null;
// html pode ser uma função: nesse caso a folha é redesenhada a cada ctx.render()
ctx.sheet = (html, { onClose, cls = '' } = {}) => {
  const root = document.getElementById('sheet');
  const fn = typeof html === 'function' ? html : null;
  root.innerHTML = `<div class="sheet-bg" data-act="app:closesheet"></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grab"></div><div class="sheet-body">${fn ? fn() : html}</div></div>`;
  root.classList.add('open');
  document.body.classList.add('modal-open');
  root._onClose = onClose;
  root._render = fn;
  hydratePhotos(root);
  const f = root.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus(), 250);
};
ctx.closeSheet = (val) => {
  const root = document.getElementById('sheet');
  if (!root.classList.contains('open')) return;
  root.classList.remove('open');
  document.body.classList.remove('modal-open');
  const cb = root._onClose; root._onClose = null; root._render = null;
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 260);
  if (sheetResolve) { const r = sheetResolve; sheetResolve = null; r(val); }
  cb && cb(val);
};
ctx.confirm = (msg, { ok = 'Confirmar', danger = false } = {}) => new Promise(res => {
  ctx.sheet(`<p class="confirm-msg">${esc(msg)}</p>
    <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Cancelar</button>
    <button class="btn ${danger ? 'danger' : ''}" data-act="app:confirmok">${esc(ok)}</button></div>`);
  sheetResolve = res;
});
ctx.sheetVal = id => { const el = document.querySelector(`#sheet #${id}`); return el ? el.value : ''; };

let toastTimer;
ctx.toast = msg => {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
};

// ---------- fotos ----------
// Precisa ser chamado direto no toque (gesto do usuário) para abrir câmera/galeria no iPhone.
ctx.pickFile = (accept = 'image/*') => new Promise(resolve => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept;
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); }, { once: true });
  inp.click();
});
ctx.pickPhoto = async () => {
  const f = await ctx.pickFile('image/*');
  if (!f) return null;
  const b = await store.compressImage(f);
  return store.putBlob(b, 'ph');
};
ctx.photoSlot = (id, act, attrs = '', label = 'Foto') => id
  ? `<button class="photo" data-act="app:viewphoto" data-id="${id}" data-del="${esc(act)}" ${attrs}><img data-photo="${id}" alt=""></button>`
  : `<button class="photo add" data-act="${esc(act)}" ${attrs}><span>📷</span><small>${esc(label)}</small></button>`;

// ---------- ações globais ----------
const appActions = {
  tab: (el) => ctx.go(el.dataset.tab),
  day: (el) => { const n = Number(el.dataset.n); const nd = addDays(ctx.ui.date, n); if (nd <= todayKey()) { ctx.ui.date = nd; ctx.render(); } },
  today: () => { ctx.ui.date = todayKey(); ctx.render(); },
  pickday: () => {
    ctx.sheet(`<h3>Escolher dia</h3><input type="date" id="pd" max="${todayKey()}" value="${ctx.ui.date}">
      <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Cancelar</button><button class="btn" data-act="app:pickdayok">Ir</button></div>`);
  },
  pickdayok: () => { const v = ctx.sheetVal('pd'); if (v && v <= todayKey()) ctx.ui.date = v; ctx.closeSheet(); ctx.render(); },
  closesheet: () => ctx.closeSheet(false),
  confirmok: () => ctx.closeSheet(true),
  settings: () => ctx.go('ajustes'),
  viewphoto: async (el) => {
    const id = el.dataset.id, del = el.dataset.del;
    ctx.sheet(`<div class="viewer"><img data-photo="${id}" alt=""></div>
      <div class="row-btns">${del ? `<button class="btn danger ghost" data-act="app:delphoto">Remover foto</button>` : ''}
      <button class="btn" data-act="app:closesheet">Fechar</button></div>`, { cls: 'tall' });
    ctx._photoCtx = { id, del, el };
  },
  delphoto: async () => {
    const pc = ctx._photoCtx; if (!pc) return;
    ctx.closeSheet();
    if (!(await ctx.confirm('Remover esta foto?', { ok: 'Remover', danger: true }))) return;
    const [hid, act] = pc.del.split(':');
    const h = ALL.find(v => v.id === hid);
    if (h && h.actions && h.actions[act + 'Remove']) await h.actions[act + 'Remove'](ctx, pc.el, pc.id);
    await store.deleteBlob(pc.id);
    ctx.save();
  },
};

function findAction(name) {
  const [scope, act] = name.split(':');
  if (scope === 'app') return appActions[act];
  const v = ALL.find(x => x.id === scope);
  return v && v.actions && v.actions[act];
}

function bind() {
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = findAction(el.dataset.act);
    if (fn) { ev.preventDefault(); Promise.resolve(fn(el, ev, ctx)).catch(e => { console.error(e); ctx.toast('Ops: ' + e.message); }); }
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    const fn = findAction(el.dataset.change);
    if (fn) Promise.resolve(fn(el, ev, ctx)).catch(e => { console.error(e); ctx.toast('Ops: ' + e.message); });
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') ctx.closeSheet(false);
    if (ev.key === 'Enter' && ev.target.matches('#sheet input:not([type=date])')) {
      const ok = document.querySelector('#sheet [data-enter]');
      if (ok) { ev.preventDefault(); ok.click(); }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ctx._hiddenAt = Date.now(); ctx.flush().catch(() => {}); }
    else {
      const s = ctx.state.settings;
      if (s.pin && ctx._hiddenAt && Date.now() - ctx._hiddenAt > (s.lockAfterSec ?? 30) * 1000) lock.show(ctx);
      if (ctx.ui.date > todayKey()) ctx.ui.date = todayKey();
      ctx.render();
    }
  });
}

// O hábito vê as ações com a assinatura (ctx, el, ev)
for (const v of ALL) {
  if (!v.actions) continue;
  for (const k of Object.keys(v.actions)) {
    const f = v.actions[k];
    if (k.endsWith('Remove')) continue;
    v.actions[k] = (el, ev) => f(ctx, el, ev);
  }
}

async function boot() {
  let s = null;
  try { s = await store.kvGet('state'); } catch (e) { console.error(e); }
  ctx.state = defaults(s);
  bind();
  ctx.render();
  if (ctx.state.settings.pin) lock.show(ctx);
  else if (!ctx.state.settings.onboarded) settings.onboarding(ctx);
  store.requestPersist();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  document.documentElement.classList.add('ready');
}

boot();
