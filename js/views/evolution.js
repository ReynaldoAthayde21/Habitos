// Evolução: gráficos e comparativos mês a mês de todos os hábitos.
import { mkey, addMonths, monthName, monthDays, monthShort, todayKey, barChart } from '../util.js';

export default {
  id: 'evolution', tabId: 'evolucao', title: 'Evolução', short: 'Evolução', emoji: '📈', color: 'var(--pink)',
  render(ctx) {
    const end = ctx.ui.evoEnd || mkey(new Date());
    const first = ctx.since().slice(0, 7);
    let months = Array.from({ length: 6 }, (_, i) => addMonths(end, i - 5));
    const trimmed = months.filter(m => m >= first);
    months = trimmed.length >= 2 ? trimmed : months.slice(-2);
    const t = todayKey(), since = ctx.since();
    const consist = months.map(ym => {
      const days = monthDays(ym).filter(d => d <= t && d >= since);
      const rec = days.filter(d => ctx.habits.some(h => h.hasRecord(ctx.state, d))).length;
      return { label: monthShort(ym), value: days.length ? Math.round((rec / days.length) * 100) : 0 };
    });
    return `<div class="monthnav card soft"><button class="icon-btn" data-act="evolution:shift" data-n="-1">‹</button>
      <b>${monthName(months[0])} – ${monthName(end)}</b>
      <button class="icon-btn" data-act="evolution:shift" data-n="1" ${end >= mkey(new Date()) ? 'disabled' : ''}>›</button></div>
    <div class="card evo"><div class="card-h"><span class="ce">✨</span><b>Constância: dias com algum registro</b></div>
      ${barChart(consist, { unit: '%', max: 100, color: 'var(--pink-d)' })}</div>
    <div class="evo-grid">${ctx.habits.map(h => (h.evolution ? h.evolution(ctx, months) : '')).join('')}</div>`;
  },
  actions: {
    shift(ctx, el) {
      const e = addMonths(ctx.ui.evoEnd || mkey(new Date()), Number(el.dataset.n));
      if (e > mkey(new Date())) return;
      ctx.ui.evoEnd = e; ctx.render();
    },
  },
};
