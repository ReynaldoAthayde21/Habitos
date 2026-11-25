// Treino: atividades (editáveis), uma ou mais por dia, foto opcional, ou "Descanso/falta".
import { esc, mkey, monthDays, monthShort, monthName, todayKey, barChart, stackChart } from '../util.js';
import { newId, deleteBlob } from '../store.js';

const EMOJIS = ['🏋️‍♀️', '🏐', '🏃‍♀️', '🧘‍♀️', '🚶‍♀️', '🚴‍♀️', '🏊‍♀️', '💃', '🎾', '🥊', '⛹️‍♀️', '🤸‍♀️', '🏄‍♀️', '⚽'];
const COLORS = ['var(--pink-d)', 'var(--lilac-d)', 'var(--mint-d)', 'var(--peach-d)', 'var(--sky-d)', 'var(--lemon-d)', 'var(--rose-d)'];

const log = (s, d) => s.workoutLog[d] || null;
const trained = (s, d) => !!(log(s, d) && log(s, d).acts.length);
const rested = (s, d) => !!(log(s, d) && log(s, d).rest);
const actives = s => s.activities.filter(a => !a.archived);
function ensure(s, d) { s.workoutLog[d] = s.workoutLog[d] || { acts: [], rest: false, photo: null }; return s.workoutLog[d]; }
function cleanup(s, d) { const l = log(s, d); if (l && !l.acts.length && !l.rest && !l.photo) delete s.workoutLog[d]; }

function monthStats(s, ym, since = '') {
  const t = todayKey();
  const days = monthDays(ym).filter(d => d <= t && d >= since);
  const per = {};
  let tr = 0, rest = 0;
  for (const d of days) {
    const l = log(s, d); if (!l) continue;
    if (l.acts.length) { tr++; for (const a of l.acts) per[a] = (per[a] || 0) + 1; }
    else if (l.rest) rest++;
  }
  return { trained: tr, rest, none: days.length - tr - rest, days: days.length, per };
}

function chips(ctx, d) {
  const s = ctx.state, l = log(s, d);
  const list = s.activities.filter(a => !a.archived || (l && l.acts.includes(a.id)));
  return `<div class="chips big">${list.map(a => `<button class="chip ${l && l.acts.includes(a.id) ? 'on' : ''}" data-act="workout:toggle" data-a="${a.id}">${a.emoji} ${esc(a.name)}</button>`).join('')}
    <button class="chip rest ${rested(s, d) ? 'on' : ''}" data-act="workout:rest">😴 Descanso/falta</button></div>`;
}

export default {
  id: 'workout', tabId: 'treino', title: 'Treino', short: 'Treino', emoji: '🏋️‍♀️', color: 'var(--lilac-d)',

  defaults(s) {
    s.activities = s.activities || [
      ['Musculação', '🏋️‍♀️'], ['Futevôlei', '🏐'], ['Corrida', '🏃‍♀️'], ['Pilates', '🧘‍♀️'], ['Caminhada', '🚶‍♀️'],
    ].map(([name, emoji]) => ({ id: newId('a'), name, emoji }));
    s.workoutLog = s.workoutLog || {};
  },

  renderTab(ctx) {
    const s = ctx.state, d = ctx.ui.date, l = log(s, d);
    const st = monthStats(s, mkey(new Date()), ctx.since());
    return `${ctx.dateNav()}
    <div class="card">
      <div class="card-h"><span class="ce">🏋️‍♀️</span><b>O que você fez?</b><span class="check ${trained(s, d) || rested(s, d) ? 'on' : ''}">${trained(s, d) || rested(s, d) ? '✓' : ''}</span></div>
      ${chips(ctx, d)}
      <div class="photo-line">${ctx.photoSlot(l && l.photo, 'workout:photo', '', 'Foto do treino')}</div>
    </div>
    <div class="card soft">
      <div class="card-h"><span class="ce">🗓️</span><b>Neste mês</b></div>
      <div class="trio"><div><b>${st.trained}</b><small>dias de treino</small></div><div><b>${st.rest}</b><small>descanso/falta</small></div><div><b>${st.none}</b><small>sem registro</small></div></div>
    </div>
    <div class="card soft">
      <div class="card-h"><span class="ce">⚙️</span><b>Atividades</b></div>
      ${actives(s).map(a => `<div class="edit-row">
        <button class="emoji-pick" data-act="workout:emoji" data-a="${a.id}">${a.emoji}</button>
        <input class="grow" value="${esc(a.name)}" data-change="workout:rename" data-a="${a.id}">
        <button class="icon-btn danger" data-act="workout:del" data-a="${a.id}">🗑</button></div>`).join('')}
      <div class="edit-row add"><input class="grow" id="newact" placeholder="Nova atividade…" data-change="workout:add">
        <button class="btn small" data-act="workout:addbtn">+</button></div>
    </div>`;
  },

  renderToday(ctx, d) {
    const s = ctx.state;
    return `<div class="card today-card" style="--c:var(--lilac)">
      <div class="card-h"><span class="ce">🏋️‍♀️</span><b>Treino</b><span class="pill ${trained(s, d) ? 'ok' : ''}">${trained(s, d) ? 'feito' : rested(s, d) ? 'descanso' : '—'}</span></div>
      ${chips(ctx, d)}</div>`;
  },

  todayChecks(ctx, d) { return { done: trained(ctx.state, d) || rested(ctx.state, d) ? 1 : 0, total: 1 }; },
  hasRecord(s, d) { const l = log(s, d); return !!(l && (l.acts.length || l.rest || l.photo)); },
  dayDetail(ctx, d) {
    const s = ctx.state, l = log(s, d); if (!l) return '';
    const names = l.acts.map(id => s.activities.find(a => a.id === id)).filter(Boolean).map(a => `${a.emoji} ${esc(a.name)}`);
    return `<div class="dd"><h4>🏋️‍♀️ Treino</h4><p>${names.length ? names.join(', ') : l.rest ? '😴 Descanso/falta' : ''}</p></div>`;
  },

  evolution(ctx, months) {
    const s = ctx.state;
    const data = months.map(ym => ({ ym, ...monthStats(s, ym, ctx.since()) }));
    const cur = data[data.length - 1], prev = data[data.length - 2];
    const acts = s.activities.filter(a => (cur.per[a.id] || prev.per[a.id]));
    return `<div class="card evo"><div class="card-h"><span class="ce">🏋️‍♀️</span><b>Treino: distribuição dos dias</b></div>
      ${stackChart(data.map(x => ({ label: monthShort(x.ym), parts: [{ value: x.trained, color: 'var(--lilac-d)' }, { value: x.rest, color: 'var(--lemon-d)' }, { value: x.none, color: 'var(--gray)' }] })))}
      <div class="legend"><span><i style="background:var(--lilac-d)"></i>Treino</span><span><i style="background:var(--lemon-d)"></i>Descanso/falta</span><span><i style="background:var(--gray)"></i>Sem registro</span></div>
      <div class="cmp">
        <div><small>${monthName(prev.ym)}</small><b>${prev.trained}</b><small>dias de treino · ${prev.rest} descanso</small></div>
        <div><small>${monthName(cur.ym)}</small><b>${cur.trained}</b><small>dias de treino · ${cur.rest} descanso</small></div>
      </div>
      ${acts.length ? `<h4 class="sub">Por atividade (${monthShort(prev.ym)} × ${monthShort(cur.ym)})</h4>
        ${barChart(acts.flatMap((a, i) => [
          { label: a.emoji, value: prev.per[a.id] || 0, color: 'var(--empty-d)' },
          { label: a.emoji, value: cur.per[a.id] || 0, color: COLORS[i % COLORS.length] },
        ]))}
        <p class="small muted center">barra clara = mês anterior</p>` : ''}
    </div>`;
  },

  actions: {
    toggle(ctx, el) {
      const l = ensure(ctx.state, ctx.ui.date), a = el.dataset.a;
      l.acts = l.acts.includes(a) ? l.acts.filter(x => x !== a) : [...l.acts, a];
      if (l.acts.length) l.rest = false;
      cleanup(ctx.state, ctx.ui.date); ctx.save();
    },
    rest(ctx) {
      const l = ensure(ctx.state, ctx.ui.date);
      l.rest = !l.rest; if (l.rest) l.acts = [];
      cleanup(ctx.state, ctx.ui.date); ctx.save();
    },
    async photo(ctx) {
      const d = ctx.ui.date;
      const id = await ctx.pickPhoto(); if (!id) return;
      const l = ensure(ctx.state, d);
      if (l.photo) await deleteBlob(l.photo);
      l.photo = id; ctx.save();
    },
    photoRemove(ctx) { const l = log(ctx.state, ctx.ui.date); if (l) { l.photo = null; cleanup(ctx.state, ctx.ui.date); } },
    rename(ctx, el) { const a = ctx.state.activities.find(x => x.id === el.dataset.a); if (a && el.value.trim()) { a.name = el.value.trim(); ctx.save(); } },
    add(ctx, el) {
      const v = el.value.trim(); if (!v) return;
      ctx.state.activities.push({ id: newId('a'), name: v, emoji: '⭐' });
      ctx.save(); ctx.toast('Atividade adicionada');
    },
    addbtn() { const i = document.getElementById('newact'); if (i && i.value.trim()) i.dispatchEvent(new Event('change', { bubbles: true })); },
    async del(ctx, el) {
      const a = ctx.state.activities.find(x => x.id === el.dataset.a);
      if (!(await ctx.confirm(`Remover "${a.name}" da lista? Os registros antigos continuam no histórico.`, { ok: 'Remover', danger: true }))) return;
      a.archived = true; ctx.save();
    },
    emoji(ctx, el) {
      ctx.sheet(`<h3>Escolher ícone</h3><div class="emoji-grid">${EMOJIS.map(e => `<button data-act="workout:emojiset" data-a="${el.dataset.a}" data-e="${e}">${e}</button>`).join('')}</div>`);
    },
    emojiset(ctx, el) { const a = ctx.state.activities.find(x => x.id === el.dataset.a); a.emoji = el.dataset.e; ctx.closeSheet(); ctx.save(); },
  },
};
