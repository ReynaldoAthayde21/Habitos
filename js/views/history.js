// Histórico: calendário. Dias passados sem nenhum registro ficam cinza (esquecimento).
import { esc, mkey, addMonths, monthName, monthDays, parseKey, todayKey, dayLabel, SEMANA_CURTA } from '../util.js';

export default {
  id: 'history', tabId: 'historico', title: 'Histórico', short: 'Histórico', emoji: '📅', color: 'var(--lemon-d)',
  render(ctx) {
    const ym = ctx.ui.month, t = todayKey(), since = ctx.since();
    const days = monthDays(ym);
    const offset = parseKey(days[0]).getDay();
    let rec = 0, gray = 0;
    const cells = days.map(d => {
      const n = Number(d.slice(8));
      if (d > t) return `<div class="cal-d future"><span>${n}</span></div>`;
      const hs = ctx.habits.filter(h => h.hasRecord(ctx.state, d));
      if (!hs.length && d < since) return `<button class="cal-d before" data-act="history:day" data-d="${d}"><span>${n}</span></button>`;
      if (hs.length) rec++; else gray++;
      return `<button class="cal-d ${hs.length ? 'has' : 'none'} ${d === t ? 'today' : ''}" data-act="history:day" data-d="${d}">
        <span>${n}</span><i class="dots">${hs.map(h => `<em style="background:${h.color}"></em>`).join('')}</i></button>`;
    });
    return `<div class="card">
      <div class="monthnav"><button class="icon-btn" data-act="history:month" data-n="-1">‹</button><b>${monthName(ym)}</b>
        <button class="icon-btn" data-act="history:month" data-n="1" ${ym >= mkey(new Date()) ? 'disabled' : ''}>›</button></div>
      <div class="cal">${SEMANA_CURTA.map(s => `<div class="cal-h">${s}</div>`).join('')}
        ${'<div></div>'.repeat(offset)}${cells.join('')}</div>
      <div class="legend wrap">${ctx.habits.map(h => `<span><i style="background:${h.color}"></i>${esc(h.title)}</span>`).join('')}
        <span><i style="background:var(--gray)"></i>Sem registro</span></div>
    </div>
    <div class="card soft trio">
      <div><b>${rec}</b><small>dias com registro</small></div>
      <div><b>${gray}</b><small>dias esquecidos</small></div>
      <div><b>${rec + gray ? Math.round((rec / (rec + gray)) * 100) : 0}%</b><small>constância</small></div>
    </div>
    <p class="small muted center">Toque num dia para ver os detalhes ou completar o que faltou.</p>`;
  },
  actions: {
    month(ctx, el) {
      const ym = addMonths(ctx.ui.month, Number(el.dataset.n));
      if (ym > mkey(new Date())) return;
      ctx.ui.month = ym; ctx.render();
    },
    day(ctx, el) {
      const d = el.dataset.d;
      const parts = ctx.habits.map(h => (h.dayDetail ? h.dayDetail(ctx, d) : '')).filter(Boolean).join('');
      ctx.sheet(`<h3>${esc(dayLabel(d))}</h3>
        ${parts || `<p class="muted">Nenhum registro neste dia. 🩶</p>`}
        <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Fechar</button>
        <button class="btn" data-act="history:edit" data-d="${d}">${parts ? 'Editar este dia' : 'Registrar agora'}</button></div>`);
    },
    edit(ctx, el) { ctx.closeSheet(); ctx.go('hoje', { date: el.dataset.d }); },
  },
};
