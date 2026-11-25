// Tela inicial: checks do dia.
import { ring, todayKey } from '../util.js';

const FRASES = ['Um dia de cada vez 🌷', 'Você está indo muito bem 💖', 'Pequenos passos, grandes mudanças ✨', 'Cuide de você hoje 🌸', 'Constância é tudo 💪', 'Orgulho de você 🫶'];

export default {
  id: 'today', tabId: 'hoje', title: 'Hoje', short: 'Hoje', emoji: '☀️', color: 'var(--pink-d)',
  render(ctx) {
    const d = ctx.ui.date;
    let done = 0, total = 0;
    for (const h of ctx.habits) if (h.todayChecks) { const c = h.todayChecks(ctx, d); done += c.done; total += c.total; }
    const p = total ? Math.round((done / total) * 100) : 0;
    const frase = FRASES[Number(d.replaceAll('-', '')) % FRASES.length];
    return `${ctx.dateNav()}
    <div class="card hero">
      ${ring(p, { size: 96, stroke: 11, color: 'var(--pink-d)' })}
      <div><b class="hero-n">${done} de ${total} checks</b><p class="muted small">${d === todayKey() ? frase : 'Completando um dia anterior'}</p></div>
    </div>
    <div class="today-grid">${ctx.habits.map(h => (h.renderToday ? h.renderToday(ctx, d) : '')).join('')}</div>`;
  },
};
