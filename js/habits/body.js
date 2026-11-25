// Corpo: fotos mensais (frente, lado, costas) com peso, peso avulso e comparador lado a lado.
import { esc, todayKey, mkey, addMonths, monthName, monthShort, shortDate, fmtNum, lineChart } from '../util.js';
import { newId, deleteBlob } from '../store.js';

const ANGLES = [['front', 'Frente'], ['side', 'Lado'], ['back', 'Costas']];
const sortedW = s => [...s.weights].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
const lastW = s => { const w = sortedW(s); return w[w.length - 1] || null; };
const sessionDate = ym => (ym === mkey(new Date()) ? todayKey() : `${ym}-15`);
const kgFmt = v => (v == null ? '—' : `${fmtNum(v, 1)} kg`);

function monthWeight(s, ym) {
  const bp = s.bodyPhotos[ym];
  if (bp && bp.kg) return bp.kg;
  const w = sortedW(s).filter(x => x.date.startsWith(ym));
  return w.length ? w[w.length - 1].kg : null;
}
function photosMonths(s) { return Object.keys(s.bodyPhotos).filter(k => ANGLES.some(([a]) => s.bodyPhotos[k][a])).sort(); }

function parseKg(v) { const n = parseFloat(String(v).replace(',', '.')); return n > 20 && n < 400 ? Math.round(n * 10) / 10 : null; }

function setMonthKg(s, ym, kg) {
  const bp = s.bodyPhotos[ym] = s.bodyPhotos[ym] || {};
  bp.kg = kg;
  let w = bp.wid && s.weights.find(x => x.id === bp.wid);
  if (!w) { w = { id: newId('w'), date: bp.date || sessionDate(ym), kg, ts: Date.now(), withPhoto: true }; s.weights.push(w); bp.wid = w.id; }
  else w.kg = kg;
}

function compareView(ctx) {
  const s = ctx.state, ui = ctx.ui;
  const months = photosMonths(s);
  const a = ui.cmpA || addMonths(mkey(new Date()), -1), b = ui.cmpB || mkey(new Date());
  const angle = ui.cmpAngle || 'front';
  const opts = sel => {
    const set = new Set([...months, a, b, mkey(new Date()), addMonths(mkey(new Date()), -1)]);
    return [...set].sort().reverse().map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${monthName(m)}</option>`).join('');
  };
  const col = (ym, which) => {
    const bp = s.bodyPhotos[ym] || {};
    return `<div class="cmp-col"><select data-change="body:cmp" data-w="${which}">${opts(ym)}</select>
      <div class="cmp-photo">${bp[angle] ? `<img data-photo="${bp[angle]}" alt="">` : `<span class="muted small">sem foto</span>`}</div>
      <b>${kgFmt(monthWeight(s, ym))}</b></div>`;
  };
  const ka = monthWeight(s, a), kb = monthWeight(s, b);
  const diff = ka != null && kb != null ? kb - ka : null;
  return `<div class="card"><div class="card-h"><span class="ce">🪞</span><b>Comparar lado a lado</b></div>
    <div class="seg">${ANGLES.map(([k, l]) => `<button class="${angle === k ? 'on' : ''}" data-act="body:angle" data-a="${k}">${l}</button>`).join('')}</div>
    <div class="cmp-grid">${col(a, 'A')}${col(b, 'B')}</div>
    ${diff != null ? `<p class="center small">Diferença: <b>${diff > 0 ? '+' : ''}${fmtNum(diff, 1)} kg</b></p>` : ''}
  </div>`;
}

export default {
  id: 'body', tabId: 'corpo', title: 'Corpo', short: 'Corpo', emoji: '🌸', color: 'var(--rose-d)',

  defaults(s) {
    s.weights = s.weights || [];
    s.bodyPhotos = s.bodyPhotos || {};
  },

  renderTab(ctx) {
    const s = ctx.state, ym = ctx.ui.bodyMonth || mkey(new Date());
    const bp = s.bodyPhotos[ym] || {};
    const w = sortedW(s), lw = w[w.length - 1], pw = w[w.length - 2];
    return `<div class="card">
      <div class="card-h"><span class="ce">📸</span><b>Fotos do mês</b></div>
      <div class="monthnav"><button class="icon-btn" data-act="body:month" data-n="-1">‹</button><b>${monthName(ym)}</b>
        <button class="icon-btn" data-act="body:month" data-n="1" ${ym >= mkey(new Date()) ? 'disabled' : ''}>›</button></div>
      <div class="body-slots">${ANGLES.map(([k, l]) => `<div class="body-slot"><small>${l}</small>${ctx.photoSlot(bp[k], 'body:photo', `data-a="${k}" data-ym="${ym}"`, l)}</div>`).join('')}</div>
      <label class="field inline"><span>Peso junto das fotos</span>
        <input type="text" inputmode="decimal" placeholder="kg" value="${bp.kg ? fmtNum(bp.kg, 1) : ''}" data-change="body:monthkg" data-ym="${ym}"></label>
    </div>
    ${compareView(ctx)}
    <div class="card">
      <div class="card-h"><span class="ce">⚖️</span><b>Peso</b><span class="pill">${kgFmt(lw && lw.kg)}</span></div>
      ${lw && pw ? `<p class="small muted">${lw.kg - pw.kg > 0 ? '+' : ''}${fmtNum(lw.kg - pw.kg, 1)} kg desde ${shortDate(pw.date)}</p>` : ''}
      <div class="page-update"><input id="kg-r" type="text" inputmode="decimal" placeholder="peso em kg" aria-label="Peso">
        <input id="kg-d" type="date" max="${todayKey()}" value="${todayKey()}" aria-label="Data">
        <button class="btn rose" data-act="body:addkg" data-in="kg-r" data-date="kg-d">Salvar</button></div>
      ${lineChart(w.slice(-10).map(x => ({ label: shortDate(x.date).slice(0, 5), value: x.kg })), { color: 'var(--rose-d)' })}
      ${w.length ? `<details><summary>Todos os registros (${w.length})</summary><ul class="wlist">${[...w].reverse().map(x =>
        `<li><span>${shortDate(x.date)}${x.withPhoto ? ' 📸' : ''}</span><b>${kgFmt(x.kg)}</b><button class="icon-btn danger" data-act="body:delkg" data-id="${x.id}">✕</button></li>`).join('')}</ul></details>` : ''}
    </div>`;
  },

  renderToday(ctx, date) {
    const s = ctx.state, lw = lastW(s), ym = mkey(new Date());
    const has = ANGLES.filter(([a]) => (s.bodyPhotos[ym] || {})[a]).length;
    const todayW = s.weights.find(x => x.date === date);
    return `<div class="card today-card" style="--c:var(--rose)">
      <div class="card-h"><span class="ce">🌸</span><b>Corpo</b><span class="pill">${kgFmt(lw && lw.kg)}</span></div>
      <div class="page-update"><input id="kg-t" type="text" inputmode="decimal" placeholder="${todayW ? 'peso registrado: ' + fmtNum(todayW.kg, 1) : 'peso de hoje (opcional)'}" aria-label="Peso">
        <button class="btn rose" data-act="body:addkg" data-in="kg-t" data-d="${date}">Salvar</button></div>
      ${has < 3 ? `<button class="link-btn" data-act="app:tab" data-tab="corpo">📸 Fotos de ${monthName(ym)}: ${has}/3</button>` : `<p class="small muted">📸 Fotos do mês feitas ✓</p>`}
    </div>`;
  },

  hasRecord(s, d) { return s.weights.some(w => w.date === d) || Object.values(s.bodyPhotos).some(b => b.date === d); },
  dayDetail(ctx, d) {
    const w = ctx.state.weights.filter(x => x.date === d);
    const ph = Object.values(ctx.state.bodyPhotos).some(b => b.date === d);
    if (!w.length && !ph) return '';
    return `<div class="dd"><h4>🌸 Corpo</h4><p>${w.map(x => kgFmt(x.kg)).join(', ')}${ph ? ' 📸 fotos do mês' : ''}</p></div>`;
  },

  evolution(ctx, months) {
    const s = ctx.state;
    const data = months.map(ym => ({ ym, kg: monthWeight(s, ym) }));
    const cur = data[data.length - 1], prev = data[data.length - 2];
    return `<div class="card evo"><div class="card-h"><span class="ce">🌸</span><b>Peso: mês a mês</b></div>
      ${lineChart(data.map(x => ({ label: monthShort(x.ym), value: x.kg })), { color: 'var(--rose-d)' })}
      <div class="cmp">
        <div><small>${monthName(prev.ym)}</small><b>${kgFmt(prev.kg)}</b><small>último peso do mês</small></div>
        <div><small>${monthName(cur.ym)}</small><b>${kgFmt(cur.kg)}</b><small>${cur.kg != null && prev.kg != null ? `${cur.kg - prev.kg > 0 ? '+' : ''}${fmtNum(cur.kg - prev.kg, 1)} kg` : 'último peso do mês'}</small></div>
      </div></div>`;
  },

  actions: {
    month(ctx, el) {
      const ym = addMonths(ctx.ui.bodyMonth || mkey(new Date()), Number(el.dataset.n));
      if (ym > mkey(new Date())) return;
      ctx.ui.bodyMonth = ym; ctx.render();
    },
    async photo(ctx, el) {
      const a = el.dataset.a, ym = el.dataset.ym;
      const id = await ctx.pickPhoto(); if (!id) return;
      const bp = ctx.state.bodyPhotos[ym] = ctx.state.bodyPhotos[ym] || {};
      if (bp[a]) await deleteBlob(bp[a]);
      bp[a] = id;
      bp.date = bp.date || sessionDate(ym);
      ctx.save();
      if (!bp.kg) ctx.toast('Registre o peso junto das fotos ⚖️');
    },
    photoRemove(ctx, el) {
      const bp = ctx.state.bodyPhotos[el.dataset.ym];
      if (bp) bp[el.dataset.a] = null;
    },
    monthkg(ctx, el) {
      const ym = el.dataset.ym;
      if (!el.value.trim()) return;
      const kg = parseKg(el.value);
      if (!kg) { ctx.toast('Peso inválido'); ctx.render(); return; }
      const bp = ctx.state.bodyPhotos[ym] = ctx.state.bodyPhotos[ym] || {};
      bp.date = bp.date || sessionDate(ym);
      setMonthKg(ctx.state, ym, kg);
      ctx.save(); ctx.toast('Peso salvo');
    },
    addkg(ctx, el) {
      const inp = document.getElementById(el.dataset.in);
      const kg = parseKg(inp && inp.value);
      if (!kg) { ctx.toast('Digite o peso em kg (ex.: 62,5)'); return; }
      const date = el.dataset.date ? (document.getElementById(el.dataset.date).value || todayKey()) : (el.dataset.d || todayKey());
      ctx.state.weights.push({ id: newId('w'), date, kg, ts: Date.now() });
      ctx.save(); ctx.toast(`${fmtNum(kg, 1)} kg registrado`);
    },
    async delkg(ctx, el) {
      if (!(await ctx.confirm('Excluir este registro de peso?', { ok: 'Excluir', danger: true }))) return;
      ctx.state.weights = ctx.state.weights.filter(x => x.id !== el.dataset.id);
      for (const bp of Object.values(ctx.state.bodyPhotos)) if (bp.wid === el.dataset.id) { bp.wid = null; bp.kg = null; }
      ctx.save();
    },
    angle(ctx, el) { ctx.ui.cmpAngle = el.dataset.a; ctx.render(); },
    cmp(ctx, el) { ctx.ui['cmp' + el.dataset.w] = el.value; ctx.render(); },
  },
};
