// Água: meta diária (padrão 3 L), garrafa (padrão 1,2 L), check = 1 garrafa, meio check = ½.
import { esc, mkey, monthDays, monthShort, monthName, addDays, pct, fmtL, fmtNum, barChart, ring, todayKey } from '../util.js';

const day = (s, d) => s.water.log[d] || null;
const ml = (s, d) => (day(s, d) ? day(s, d).ml : 0);
const goalOf = (s, d) => (day(s, d) ? day(s, d).goal : s.water.goalMl);
const dayPct = (s, d) => pct(ml(s, d), goalOf(s, d));

function add(s, d, amount) {
  const cur = day(s, d) || { ml: 0, goal: s.water.goalMl };
  cur.ml = Math.max(0, Math.round(cur.ml + amount));
  cur.goal = s.water.goalMl;
  if (cur.ml === 0) delete s.water.log[d]; else s.water.log[d] = cur;
}

function bottles(s, d) {
  const b = s.water.bottleMl, total = Math.ceil((goalOf(s, d) / b) * 2) / 2; // 3000/1200 = 2,5
  const have = ml(s, d) / b;
  const n = Math.max(Math.ceil(total), Math.ceil(have));
  let out = '';
  for (let i = 0; i < n; i++) {
    const fill = Math.max(0, Math.min(1, have - i));
    const isHalfSlot = i + 1 > total && i < total;
    out += `<div class="bottle ${fill >= 1 ? 'full' : fill > 0 ? 'half' : ''} ${i >= total ? 'extra' : ''} ${isHalfSlot ? 'halfslot' : ''}">
      <div class="b-cap"></div><div class="b-body"><div class="b-water" style="height:${Math.round(fill * 100)}%"></div></div></div>`;
  }
  return out;
}

function monthStats(s, ym, since = '') {
  const t = todayKey();
  const days = monthDays(ym).filter(d => d <= t && d >= since);
  const logged = days.filter(d => ml(s, d) > 0);
  const hit = days.filter(d => ml(s, d) >= goalOf(s, d)).length;
  const avgPct = logged.length ? Math.round(logged.reduce((a, d) => a + Math.min(150, dayPct(s, d)), 0) / logged.length) : 0;
  const avgMl = logged.length ? logged.reduce((a, d) => a + ml(s, d), 0) / logged.length : 0;
  return { hit, days: days.length, logged: logged.length, avgPct, avgMl };
}

function controls(s, d) {
  return `<div class="water-btns">
    <button class="btn water" data-act="water:add" data-f="1">💧 +1 garrafa</button>
    <button class="btn water soft" data-act="water:add" data-f="0.5">+½</button>
    <button class="btn ghost round" data-act="water:add" data-f="-0.5" ${ml(s, d) <= 0 ? 'disabled' : ''} aria-label="Desfazer meio">−</button>
  </div>`;
}

export default {
  id: 'water', tabId: 'agua', title: 'Água', short: 'Água', emoji: '💧', color: 'var(--sky-d)',

  defaults(s) {
    s.water = s.water || { goalMl: 3000, bottleMl: 1200, log: {} };
  },

  renderTab(ctx) {
    const s = ctx.state, d = ctx.ui.date, p = dayPct(s, d);
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(d, i - 6));
    const st = monthStats(s, mkey(new Date()), ctx.since());
    return `${ctx.dateNav()}
    <div class="card water-hero">
      ${ring(p, { size: 150, stroke: 14, label: `${fmtL(ml(s, d))} de ${fmtL(goalOf(s, d))}` })}
      <div class="bottles">${bottles(s, d)}</div>
      <p class="small muted center">${fmtNum(ml(s, d) / s.water.bottleMl, 1)} de ${fmtNum(goalOf(s, d) / s.water.bottleMl, 1)} garrafas de ${fmtL(s.water.bottleMl)}</p>
      ${controls(s, d)}
      ${p >= 100 ? `<p class="yay">Meta batida! 🎉💙</p>` : ''}
    </div>
    <div class="card"><div class="card-h"><span class="ce">📊</span><b>Últimos 7 dias</b></div>
      ${barChart(last7.map(k => ({ label: k.slice(8), value: dayPct(s, k), color: dayPct(s, k) >= 100 ? 'var(--sky-d)' : 'var(--sky)' })), { unit: '%', max: Math.max(100, ...last7.map(k => dayPct(s, k))) })}
      <div class="ms-row small"><span>Neste mês</span><b>meta batida em ${st.hit} de ${st.days} dias</b></div>
    </div>
    <div class="card soft">
      <div class="card-h"><span class="ce">⚙️</span><b>Ajustes da água</b></div>
      <label class="field"><span>Meta diária (litros)</span><input type="number" inputmode="decimal" step="0.1" min="0.5" max="8" value="${s.water.goalMl / 1000}" data-change="water:goal"></label>
      <label class="field"><span>Tamanho da garrafa (litros)</span><input type="number" inputmode="decimal" step="0.05" min="0.1" max="3" value="${s.water.bottleMl / 1000}" data-change="water:bottle"></label>
      <p class="small muted">Mudanças valem a partir de hoje; os dias anteriores mantêm a meta da época.</p>
    </div>`;
  },

  renderToday(ctx, d) {
    const s = ctx.state, p = dayPct(s, d);
    return `<div class="card today-card" style="--c:var(--sky)">
      <div class="card-h"><span class="ce">💧</span><b>Água</b><span class="pill ${p >= 100 ? 'ok' : ''}">${p}%</span></div>
      <div class="water-row"><div class="bottles sm">${bottles(s, d)}</div>
        <div class="small"><b>${fmtL(ml(s, d))}</b> de ${fmtL(goalOf(s, d))}</div></div>
      ${controls(s, d)}
    </div>`;
  },

  todayChecks(ctx, d) { return { done: ml(ctx.state, d) >= goalOf(ctx.state, d) ? 1 : 0, total: 1 }; },
  hasRecord(s, d) { return ml(s, d) > 0; },
  dayDetail(ctx, d) { return ml(ctx.state, d) ? `<div class="dd"><h4>💧 Água</h4><p>${fmtL(ml(ctx.state, d))} · ${dayPct(ctx.state, d)}% da meta</p></div>` : ''; },

  evolution(ctx, months) {
    const s = ctx.state;
    const data = months.map(ym => ({ ym, ...monthStats(s, ym, ctx.since()) }));
    const cur = data[data.length - 1], prev = data[data.length - 2];
    return `<div class="card evo"><div class="card-h"><span class="ce">💧</span><b>Água: média da meta</b></div>
      ${barChart(data.map(x => ({ label: monthShort(x.ym), value: x.avgPct })), { unit: '%', color: 'var(--sky-d)', max: 100 })}
      <div class="cmp">
        <div><small>${monthName(prev.ym)}</small><b>${prev.hit}</b><small>dias com meta · média ${fmtL(Math.round(prev.avgMl / 100) * 100)}</small></div>
        <div><small>${monthName(cur.ym)}</small><b>${cur.hit}</b><small>dias com meta · média ${fmtL(Math.round(cur.avgMl / 100) * 100)}</small></div>
      </div></div>`;
  },

  actions: {
    add(ctx, el) {
      add(ctx.state, ctx.ui.date, Number(el.dataset.f) * ctx.state.water.bottleMl);
      ctx.save();
    },
    goal(ctx, el) {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (!(v >= 0.5 && v <= 8)) { ctx.toast('Meta entre 0,5 e 8 L'); ctx.render(); return; }
      ctx.state.water.goalMl = Math.round(v * 1000);
      const t = ctx.state.water.log[todayKey()]; if (t) t.goal = ctx.state.water.goalMl;
      ctx.save(); ctx.toast('Meta atualizada');
    },
    bottle(ctx, el) {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (!(v >= 0.1 && v <= 3)) { ctx.toast('Garrafa entre 0,1 e 3 L'); ctx.render(); return; }
      ctx.state.water.bottleMl = Math.round(v * 1000);
      ctx.save(); ctx.toast('Garrafa atualizada');
    },
  },
};
