// Leitura: um livro por vez, progresso por página, conclusão com comentário, histórico.
import { esc, todayKey, shortDate, parseKey, pct, fmtNum, monthShort, monthName, barChart, progressBar } from '../util.js';
import { newId } from '../store.js';

const current = s => s.books.find(b => !b.end) || null;
const finished = s => s.books.filter(b => b.end).sort((a, b) => b.end.localeCompare(a.end));

// páginas lidas por dia (diferença entre atualizações)
function pagesByDay(s) {
  const out = {};
  for (const b of s.books) {
    let prev = 0;
    for (const e of [...b.log].sort((x, y) => x.date.localeCompare(y.date) || x.ts - y.ts)) {
      const delta = Math.max(0, e.page - prev);
      prev = Math.max(prev, e.page);
      if (delta) out[e.date] = (out[e.date] || 0) + delta;
    }
  }
  return out;
}
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000) + 1;

function setPage(b, page, date) {
  page = Math.max(0, Math.min(b.pages, Math.round(page)));
  b.log.push({ date, page, ts: Date.now() });
  b.current = Math.max(...b.log.map(e => e.page));
}

function bookForm(b) {
  return `<label class="field"><span>Título</span><input id="bk-title" value="${esc(b ? b.title : '')}" maxlength="120" placeholder="Nome do livro" autofocus></label>
    <label class="field"><span>Total de páginas</span><input id="bk-pages" type="number" inputmode="numeric" min="1" value="${b ? b.pages : ''}"></label>
    <label class="field"><span>Data de início</span><input id="bk-start" type="date" max="${todayKey()}" value="${b ? b.start : todayKey()}"></label>`;
}

function currentCard(ctx, b, date, compact = false) {
  const p = pct(b.current, b.pages);
  return `<div class="book">
    <div class="book-cover">📖</div>
    <div class="book-info"><b>${esc(b.title)}</b>
      <small>desde ${shortDate(b.start)} · página ${b.current} de ${b.pages}</small>
      ${progressBar(p, 'var(--lilac-d)')}<small class="muted">${p}% lido</small></div>
  </div>
  <div class="page-update">
    <input type="number" inputmode="numeric" id="pg-${compact ? 't' : 'r'}" min="0" max="${b.pages}" placeholder="página atual" aria-label="Página atual">
    <button class="btn" data-act="reading:page" data-in="pg-${compact ? 't' : 'r'}" data-d="${date}">Atualizar</button>
  </div>
  ${compact ? '' : `<div class="row-btns left wrap">
    <button class="btn small mint" data-act="reading:finish">🎉 Concluí o livro</button>
    <button class="btn small ghost" data-act="reading:edit" data-b="${b.id}">Editar</button></div>`}`;
}

export default {
  id: 'reading', tabId: 'leitura', title: 'Leitura', short: 'Leitura', emoji: '📚', color: 'var(--mint-d)',

  defaults(s) { s.books = s.books || []; },

  renderTab(ctx) {
    const s = ctx.state, b = current(s), done = finished(s);
    const total = done.reduce((a, x) => a + x.pages, 0) + (b ? b.current : 0);
    return `<div class="card">
      <div class="card-h"><span class="ce">📖</span><b>Lendo agora</b></div>
      ${b ? currentCard(ctx, b, todayKey()) : `<p class="muted small">Nenhum livro em andamento.</p>
        <button class="btn block" data-act="reading:new">+ Começar um livro</button>`}
    </div>
    <div class="card soft trio">
      <div><b>${fmtNum(total)}</b><small>páginas lidas</small></div>
      <div><b>${done.length}</b><small>livros concluídos</small></div>
      <div><b>${done.filter(x => x.end.slice(0, 4) === todayKey().slice(0, 4)).length}</b><small>neste ano</small></div>
    </div>
    <div class="card"><div class="card-h"><span class="ce">🏆</span><b>Livros concluídos</b></div>
      ${done.length ? done.map(x => `<div class="done-book">
        <div class="db-h"><b>${esc(x.title)}</b><button class="icon-btn" data-act="reading:edit" data-b="${x.id}" aria-label="Editar">✏️</button></div>
        <small class="muted">${x.pages} páginas · ${shortDate(x.start)} → ${shortDate(x.end)} (${daysBetween(x.start, x.end)} dias)</small>
        ${x.comment ? `<p class="comment">“${esc(x.comment)}”</p>` : ''}
      </div>`).join('') : `<p class="muted small">Seus livros terminados aparecem aqui. 📚</p>`}
    </div>`;
  },

  renderToday(ctx, date) {
    const b = current(ctx.state);
    return `<div class="card today-card" style="--c:var(--mint)">
      <div class="card-h"><span class="ce">📚</span><b>Leitura</b>${b ? `<span class="pill">${pct(b.current, b.pages)}%</span>` : ''}</div>
      ${b ? currentCard(ctx, b, date, true) : `<button class="btn small ghost" data-act="app:tab" data-tab="leitura">+ Começar um livro</button>`}
    </div>`;
  },

  hasRecord(s, d) { return s.books.some(b => b.log.some(e => e.date === d) || b.end === d || b.start === d); },
  dayDetail(ctx, d) {
    const n = pagesByDay(ctx.state)[d];
    const ended = ctx.state.books.filter(b => b.end === d);
    if (!n && !ended.length) return '';
    return `<div class="dd"><h4>📚 Leitura</h4><p>${n ? `${n} páginas lidas` : ''}${ended.map(b => `<br>🎉 Terminou “${esc(b.title)}”`).join('')}</p></div>`;
  },

  evolution(ctx, months) {
    const byDay = pagesByDay(ctx.state);
    const data = months.map(ym => ({
      ym,
      pages: Object.entries(byDay).filter(([d]) => d.startsWith(ym)).reduce((a, [, v]) => a + v, 0),
      books: ctx.state.books.filter(b => b.end && b.end.startsWith(ym)).length,
    }));
    const cur = data[data.length - 1], prev = data[data.length - 2];
    return `<div class="card evo"><div class="card-h"><span class="ce">📚</span><b>Leitura: páginas por mês</b></div>
      ${barChart(data.map(x => ({ label: monthShort(x.ym), value: x.pages })), { color: 'var(--mint-d)' })}
      <div class="cmp">
        <div><small>${monthName(prev.ym)}</small><b>${prev.pages}</b><small>páginas · ${prev.books} livro(s)</small></div>
        <div><small>${monthName(cur.ym)}</small><b>${cur.pages}</b><small>páginas · ${cur.books} livro(s)</small></div>
      </div></div>`;
  },

  actions: {
    new(ctx) {
      ctx.sheet(`<h3>📖 Novo livro</h3>${bookForm(null)}
        <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Cancelar</button><button class="btn" data-act="reading:create">Começar</button></div>`);
    },
    create(ctx) {
      const title = ctx.sheetVal('bk-title').trim(), pages = parseInt(ctx.sheetVal('bk-pages'), 10), start = ctx.sheetVal('bk-start') || todayKey();
      if (!title || !(pages > 0)) { ctx.toast('Preencha título e páginas'); return; }
      if (current(ctx.state)) { ctx.toast('Conclua o livro atual primeiro'); return; }
      ctx.state.books.push({ id: newId('b'), title, pages, start, end: null, current: 0, comment: '', log: [] });
      ctx.closeSheet(); ctx.save(); ctx.toast('Boa leitura! 📚');
    },
    page(ctx, el) {
      const b = current(ctx.state); if (!b) return;
      const v = parseInt(document.getElementById(el.dataset.in)?.value, 10);
      if (!(v >= 0)) { ctx.toast('Digite a página atual'); return; }
      if (v > b.pages) { ctx.toast(`O livro tem ${b.pages} páginas`); return; }
      setPage(b, v, el.dataset.d || todayKey());
      ctx.save();
      ctx.toast(v >= b.pages ? 'Última página! Marque como concluído 🎉' : `Página ${v} registrada`);
    },
    finish(ctx) {
      const b = current(ctx.state);
      ctx.sheet(`<h3>🎉 Concluir “${esc(b.title)}”</h3>
        <label class="field"><span>Data de término</span><input id="bk-end" type="date" min="${b.start}" max="${todayKey()}" value="${todayKey()}"></label>
        <label class="field"><span>Comentário (opcional)</span><textarea id="bk-comment" rows="4" maxlength="600" placeholder="O que achou?"></textarea></label>
        <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Cancelar</button><button class="btn mint" data-act="reading:finishok">Concluir</button></div>`);
    },
    finishok(ctx) {
      const b = current(ctx.state);
      const end = ctx.sheetVal('bk-end') || todayKey();
      setPage(b, b.pages, end);
      b.end = end; b.comment = ctx.sheetVal('bk-comment').trim();
      ctx.closeSheet(); ctx.save(); ctx.toast('Mais um livro! 🏆');
    },
    edit(ctx, el) {
      const b = ctx.state.books.find(x => x.id === el.dataset.b);
      ctx.sheet(`<h3>Editar livro</h3>${bookForm(b)}
        ${b.end ? `<label class="field"><span>Data de término</span><input id="bk-end" type="date" min="${b.start}" max="${todayKey()}" value="${b.end}"></label>
        <label class="field"><span>Comentário</span><textarea id="bk-comment" rows="4" maxlength="600">${esc(b.comment)}</textarea></label>` : ''}
        <div class="row-btns"><button class="btn danger ghost" data-act="reading:del" data-b="${b.id}">Excluir</button>
        <button class="btn" data-act="reading:save" data-b="${b.id}">Salvar</button></div>`);
    },
    save(ctx, el) {
      const b = ctx.state.books.find(x => x.id === el.dataset.b);
      const title = ctx.sheetVal('bk-title').trim(), pages = parseInt(ctx.sheetVal('bk-pages'), 10);
      if (!title || !(pages > 0)) { ctx.toast('Preencha título e páginas'); return; }
      b.title = title; b.pages = pages; b.start = ctx.sheetVal('bk-start') || b.start;
      if (b.end) {
        const newEnd = ctx.sheetVal('bk-end') || b.end;
        b.log.forEach(e => { if (e.date === b.end && e.page >= b.current) e.date = newEnd; });
        b.end = newEnd; b.comment = ctx.sheetVal('bk-comment').trim();
        b.current = pages;
      } else b.current = Math.min(b.current, pages);
      ctx.closeSheet(); ctx.save();
    },
    async del(ctx, el) {
      const b = ctx.state.books.find(x => x.id === el.dataset.b);
      ctx.closeSheet();
      if (!(await ctx.confirm(`Excluir “${b.title}” e o progresso registrado?`, { ok: 'Excluir', danger: true }))) return;
      ctx.state.books = ctx.state.books.filter(x => x !== b); ctx.save();
    },
  },
};
