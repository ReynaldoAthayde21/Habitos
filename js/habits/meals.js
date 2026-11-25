// Refeições: plano da nutricionista (editável) + refeição livre.
import { esc, mkey, monthDays, monthShort, monthName, addMonths, pct, stackChart, progressBar } from '../util.js';
import { newId, putBlob, blobURL, deleteBlob } from '../store.js';

const EMOJIS = ['☕', '🍎', '🍽️', '🥗', '🧁', '🌙', '🍵', '🥑', '🍓', '🥪', '🍳', '🥤'];

function examplePlan() {
  const m = (name, emoji, opts) => ({ id: newId('m'), name, emoji, options: opts.map(([n, k]) => ({ id: newId('o'), name: n, kind: k })) });
  return {
    isExample: true,
    meals: [
      m('Café da manhã', '☕', [['Pão integral com ovo', 'principal'], ['Iogurte com granola', 'principal'], ['Fruta', 'acomp'], ['Café sem açúcar', 'acomp']]),
      m('Lanche da manhã', '🍎', [['Fruta com castanhas', 'principal'], ['Iogurte natural', 'principal']]),
      m('Almoço', '🍽️', [['Arroz, feijão e proteína', 'principal'], ['Salada à vontade', 'acomp'], ['Legumes', 'acomp']]),
      m('Lanche da tarde', '🧁', [['Sanduíche natural', 'principal'], ['Shake de proteína', 'principal'], ['Fruta', 'acomp']]),
      m('Jantar', '🌙', [['Proteína com legumes', 'principal'], ['Omelete', 'principal'], ['Salada', 'acomp']]),
      m('Ceia', '🍵', [['Chá', 'principal'], ['Iogurte', 'principal']]),
    ],
  };
}

const active = s => s.plan.meals.filter(m => !m.archived);
const entry = (s, date, mid) => (s.mealLog[date] || {})[mid] || null;
const isDone = e => !!(e && ((e.opts && e.opts.length) || e.free));
function ensure(s, date, mid) {
  s.mealLog[date] = s.mealLog[date] || {};
  s.mealLog[date][mid] = s.mealLog[date][mid] || { opts: [], free: '', photo: null };
  return s.mealLog[date][mid];
}
function cleanup(s, date, mid) {
  const e = entry(s, date, mid);
  if (e && !isDone(e) && !e.photo) delete s.mealLog[date][mid];
  if (s.mealLog[date] && !Object.keys(s.mealLog[date]).length) delete s.mealLog[date];
}
function findOpt(s, oid) {
  for (const m of s.plan.meals) { const o = m.options.find(x => x.id === oid); if (o) return o; }
  return null;
}

function monthStats(s, ym) {
  let plan = 0, free = 0; const frees = [];
  for (const d of monthDays(ym)) {
    const log = s.mealLog[d]; if (!log) continue;
    for (const e of Object.values(log)) {
      if (e.free) { free++; frees.push({ d, name: e.free }); }
      else if (e.opts && e.opts.length) plan++;
    }
  }
  return { plan, free, total: plan + free, frees };
}

// Cartão de uma refeição (usado na aba e na folha aberta pelo "Hoje")
function mealCard(ctx, meal, date) {
  const s = ctx.state, e = entry(s, date, meal.id);
  const done = isDone(e);
  let body;
  if (e && e.free) {
    body = `<div class="free-tag">🍔 <b>Livre:</b> ${esc(e.free)}</div>
      <div class="row-btns left"><button class="btn small ghost" data-act="meals:free" data-m="${meal.id}">Editar</button>
      <button class="btn small ghost" data-act="meals:unfree" data-m="${meal.id}">Voltar ao plano</button></div>`;
  } else {
    const opts = meal.options.filter(o => !o.archived || (e && e.opts.includes(o.id)));
    const group = (kind, label) => {
      const list = opts.filter(o => o.kind === kind);
      if (!list.length) return '';
      return `<div class="opt-group"><div class="opt-label">${label}</div><div class="chips">${list.map(o =>
        `<button class="chip ${e && e.opts.includes(o.id) ? 'on' : ''}" data-act="meals:toggle" data-m="${meal.id}" data-o="${o.id}">${esc(o.name)}</button>`).join('')}</div></div>`;
    };
    body = (group('principal', 'Principal') + group('acomp', 'Acompanhamento')) || `<p class="muted small">Sem opções. Edite o plano para adicionar.</p>`;
    body += `<button class="link-btn" data-act="meals:free" data-m="${meal.id}">🍔 Foi uma refeição livre</button>`;
  }
  return `<div class="card meal ${done ? 'done' : ''}">
    <div class="card-h"><span class="ce">${meal.emoji || '🍽️'}</span><b>${esc(meal.name)}</b><span class="check ${done ? 'on' : ''}">${done ? '✓' : ''}</span></div>
    <div class="meal-body"><div class="meal-opts">${body}</div>
    <div class="meal-photo">${ctx.photoSlot(e && e.photo, 'meals:photo', `data-m="${meal.id}"`)}</div></div>
  </div>`;
}

// ---------- editor do plano ----------
function planEditor(ctx) {
  const s = ctx.state;
  const meals = active(s);
  return `<div class="subhead"><button class="btn small ghost" data-act="meals:closeedit">‹ Voltar</button><h2>Editar plano</h2></div>
  <div class="card soft">
    <div class="card-h"><span class="ce">📄</span><b>Plano da nutricionista</b></div>
    ${s.plan.pdfId ? `<p class="small">Arquivo: <b>${esc(s.plan.pdfName || 'plano.pdf')}</b></p>
      <div class="row-btns left wrap"><button class="btn small" data-act="meals:viewpdf">Ver PDF</button>
      <button class="btn small" data-act="meals:importpdf">Montar refeições a partir do PDF</button>
      <button class="btn small ghost" data-act="meals:uploadpdf">Trocar PDF</button></div>`
      : `<p class="small muted">Envie o PDF do plano. Ele fica guardado só neste aparelho, e o app sugere as refeições e opções a partir dele para você revisar.</p>
      <div class="row-btns left wrap"><button class="btn small" data-act="meals:uploadpdf">Enviar PDF do plano</button></div>`}
    <button class="link-btn" data-act="meals:pastetext">Ou colar/digitar o plano como texto</button>
  </div>
  ${meals.map((m, i) => `<div class="card edit-meal">
    <div class="edit-row">
      <button class="emoji-pick" data-act="meals:emoji" data-m="${m.id}">${m.emoji || '🍽️'}</button>
      <input class="grow" value="${esc(m.name)}" data-change="meals:rename" data-m="${m.id}" aria-label="Nome da refeição">
      <button class="icon-btn" data-act="meals:move" data-m="${m.id}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="icon-btn" data-act="meals:move" data-m="${m.id}" data-d="1" ${i === meals.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="icon-btn danger" data-act="meals:delmeal" data-m="${m.id}">🗑</button>
    </div>
    ${m.options.filter(o => !o.archived).map(o => `<div class="edit-row opt">
      <input class="grow" value="${esc(o.name)}" data-change="meals:renameopt" data-m="${m.id}" data-o="${o.id}" aria-label="Opção">
      <select data-change="meals:kind" data-m="${m.id}" data-o="${o.id}">
        <option value="principal" ${o.kind === 'principal' ? 'selected' : ''}>Principal</option>
        <option value="acomp" ${o.kind === 'acomp' ? 'selected' : ''}>Acomp.</option></select>
      <button class="icon-btn danger" data-act="meals:delopt" data-m="${m.id}" data-o="${o.id}">✕</button>
    </div>`).join('')}
    <div class="edit-row opt add">
      <input class="grow" id="new-${m.id}" placeholder="Nova opção…" data-change="meals:addopt" data-m="${m.id}">
      <button class="btn small" data-act="meals:addoptbtn" data-m="${m.id}">+</button>
    </div>
  </div>`).join('')}
  <button class="btn block ghost" data-act="meals:addmeal">+ Adicionar refeição</button>`;
}

function draftSheet(ctx, text, source) {
  ctx.sheet(`<h3>Revisar plano</h3>
    <p class="small muted">${source === 'pdf' ? 'Montei este rascunho a partir do texto do PDF. Confira e corrija antes de aplicar.' : 'Escreva o plano neste formato:'}<br>
    <code># Nome da refeição</code> · <code>- opção principal</code> · <code>+ acompanhamento</code></p>
    <textarea id="draft" rows="14" spellcheck="false">${esc(text)}</textarea>
    <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Cancelar</button>
    <button class="btn" data-act="meals:applydraft">Aplicar plano</button></div>`, { cls: 'tall' });
}

export default {
  id: 'meals', tabId: 'refeicoes', title: 'Refeições', short: 'Refeições', emoji: '🥗', color: 'var(--peach-d)',

  defaults(s) {
    s.plan = s.plan || examplePlan();
    s.mealLog = s.mealLog || {};
  },

  renderTab(ctx) {
    if (ctx.ui.mealsEdit) return planEditor(ctx);
    const s = ctx.state, date = ctx.ui.date, ym = mkey(new Date());
    const st = monthStats(s, ym);
    return `${ctx.dateNav()}
    ${s.plan.isExample ? `<div class="banner">🌷 Este é um plano de exemplo. Envie o PDF da nutricionista em <b>Editar plano</b> para montar o seu.</div>` : ''}
    <div class="card soft mini-stats">
      <div class="ms-row"><span>Neste mês</span><b>${st.plan} do plano · ${st.free} livres</b></div>
      ${progressBar(pct(st.plan, st.total), 'var(--mint-d)')}
      <div class="ms-row small muted"><span>${pct(st.plan, st.total)}% do plano</span><span>${pct(st.free, st.total)}% livres</span></div>
    </div>
    ${active(s).map(m => mealCard(ctx, m, date)).join('')}
    <button class="btn block ghost" data-act="meals:edit">✏️ Editar plano</button>`;
  },

  renderToday(ctx, date) {
    const s = ctx.state, meals = active(s);
    const done = meals.filter(m => isDone(entry(s, date, m.id))).length;
    return `<div class="card today-card" style="--c:var(--peach)">
      <div class="card-h"><span class="ce">🥗</span><b>Refeições</b><span class="pill">${done}/${meals.length}</span></div>
      <div class="meal-list">${meals.map(m => {
        const e = entry(s, date, m.id);
        const txt = e && e.free ? `🍔 ${esc(e.free)}` : e && e.opts.length ? esc(e.opts.map(o => findOpt(s, o)?.name).filter(Boolean).join(' + ')) : '<span class="muted">tocar para marcar</span>';
        return `<button class="meal-row ${isDone(e) ? 'on' : ''}" data-act="meals:open" data-m="${m.id}">
          <span class="mr-check">${isDone(e) ? '✓' : ''}</span><span class="mr-e">${m.emoji}</span>
          <span class="mr-t"><b>${esc(m.name)}</b><small>${txt}</small></span></button>`;
      }).join('')}</div></div>`;
  },

  todayChecks(ctx, date) {
    const meals = active(ctx.state);
    return { done: meals.filter(m => isDone(entry(ctx.state, date, m.id))).length, total: meals.length };
  },

  hasRecord(s, date) { return !!(s.mealLog[date] && Object.values(s.mealLog[date]).some(e => isDone(e) || e.photo)); },

  dayDetail(ctx, date) {
    const log = ctx.state.mealLog[date]; if (!log) return '';
    const items = Object.entries(log).filter(([, e]) => isDone(e)).map(([mid, e]) => {
      const m = ctx.state.plan.meals.find(x => x.id === mid);
      const what = e.free ? `🍔 livre: ${esc(e.free)}` : esc(e.opts.map(o => findOpt(ctx.state, o)?.name).filter(Boolean).join(' + '));
      return `<li><b>${esc(m ? m.name : 'Refeição')}</b>: ${what}</li>`;
    });
    return items.length ? `<div class="dd"><h4>🥗 Refeições</h4><ul>${items.join('')}</ul></div>` : '';
  },

  evolution(ctx, months) {
    const s = ctx.state;
    const data = months.map(ym => ({ ym, ...monthStats(s, ym) }));
    const cur = data[data.length - 1], prev = data[data.length - 2];
    return `<div class="card evo"><div class="card-h"><span class="ce">🥗</span><b>Refeições: plano × livre</b></div>
      ${stackChart(data.map(d => ({ label: monthShort(d.ym), parts: [{ value: d.plan, color: 'var(--mint-d)' }, { value: d.free, color: 'var(--peach-d)' }] })))}
      <div class="legend"><span><i style="background:var(--mint-d)"></i>Plano</span><span><i style="background:var(--peach-d)"></i>Livre</span></div>
      <div class="cmp">
        <div><small>${monthName(prev.ym)}</small><b>${pct(prev.plan, prev.total)}%</b><small>do plano · ${prev.free} livres</small></div>
        <div><small>${monthName(cur.ym)}</small><b>${pct(cur.plan, cur.total)}%</b><small>do plano · ${cur.free} livres</small></div>
      </div>
      ${cur.frees.length ? `<details><summary>Refeições livres de ${monthName(cur.ym)}</summary><ul class="small">${cur.frees.map(f => `<li>${f.d.slice(8)}/${f.d.slice(5, 7)}: ${esc(f.name)}</li>`).join('')}</ul></details>` : ''}
    </div>`;
  },

  actions: {
    open(ctx, el) {
      const mid = el.dataset.m;
      ctx.sheet(() => {
        const m = ctx.state.plan.meals.find(x => x.id === mid);
        return m ? mealCard(ctx, m, ctx.ui.date) + `<button class="btn block" data-act="app:closesheet">Pronto</button>` : '';
      });
    },
    toggle(ctx, el) {
      const e = ensure(ctx.state, ctx.ui.date, el.dataset.m);
      const o = el.dataset.o;
      e.opts = e.opts.includes(o) ? e.opts.filter(x => x !== o) : [...e.opts, o];
      cleanup(ctx.state, ctx.ui.date, el.dataset.m);
      ctx.save();
    },
    free(ctx, el) {
      const mid = el.dataset.m;
      const e = entry(ctx.state, ctx.ui.date, mid);
      const back = document.getElementById('sheet')._render;
      ctx.sheet(`<h3>🍔 Refeição livre</h3><p class="small muted">Um nome curto para lembrar depois.</p>
        <input id="freename" maxlength="60" placeholder="ex.: hambúrguer no restaurante X" value="${esc(e && e.free || '')}" autofocus>
        <div class="row-btns"><button class="btn ghost" data-act="app:closesheet">Cancelar</button>
        <button class="btn" data-enter data-act="meals:freesave" data-m="${mid}">Salvar</button></div>`);
      ctx._mealsBack = back;
    },
    freesave(ctx, el) {
      const name = ctx.sheetVal('freename').trim();
      if (!name) { ctx.toast('Escreva um nome curto'); return; }
      const e = ensure(ctx.state, ctx.ui.date, el.dataset.m);
      e.free = name; e.opts = [];
      ctx.closeSheet();
      if (ctx._mealsBack) { const b = ctx._mealsBack; ctx._mealsBack = null; ctx.sheet(b); }
      ctx.save();
    },
    unfree(ctx, el) {
      const e = ensure(ctx.state, ctx.ui.date, el.dataset.m);
      e.free = '';
      cleanup(ctx.state, ctx.ui.date, el.dataset.m);
      ctx.save();
    },
    async photo(ctx, el) {
      const mid = el.dataset.m, date = ctx.ui.date;
      const id = await ctx.pickPhoto();
      if (!id) return;
      const e = ensure(ctx.state, date, mid);
      if (e.photo) await deleteBlob(e.photo);
      e.photo = id;
      ctx.save();
    },
    photoRemove(ctx, el) {
      const e = entry(ctx.state, ctx.ui.date, el.dataset.m);
      if (e) { e.photo = null; cleanup(ctx.state, ctx.ui.date, el.dataset.m); }
    },

    // editor
    edit(ctx) { ctx.ui.mealsEdit = true; ctx.render(); window.scrollTo(0, 0); },
    closeedit(ctx) { ctx.ui.mealsEdit = false; ctx.render(); window.scrollTo(0, 0); },
    rename(ctx, el) { const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m); if (m && el.value.trim()) { m.name = el.value.trim(); ctx.state.plan.isExample = false; ctx.save(false); } },
    renameopt(ctx, el) { const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m); const o = m && m.options.find(x => x.id === el.dataset.o); if (o && el.value.trim()) { o.name = el.value.trim(); ctx.state.plan.isExample = false; ctx.save(false); } },
    kind(ctx, el) { const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m); const o = m && m.options.find(x => x.id === el.dataset.o); if (o) { o.kind = el.value; ctx.save(false); } },
    addopt(ctx, el) {
      const v = el.value.trim(); if (!v) return;
      const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m);
      m.options.push({ id: newId('o'), name: v, kind: 'principal' });
      ctx.state.plan.isExample = false;
      ctx.save();
      setTimeout(() => document.getElementById('new-' + m.id)?.focus(), 30);
    },
    addoptbtn(ctx, el) { const inp = document.getElementById('new-' + el.dataset.m); if (inp && inp.value.trim()) inp.dispatchEvent(new Event('change', { bubbles: true })); },
    async delopt(ctx, el) {
      const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m); const o = m.options.find(x => x.id === el.dataset.o);
      if (!(await ctx.confirm(`Remover a opção "${o.name}"? Os registros antigos continuam no histórico.`, { ok: 'Remover', danger: true }))) return;
      o.archived = true; ctx.save();
    },
    async delmeal(ctx, el) {
      const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m);
      if (!(await ctx.confirm(`Remover a refeição "${m.name}" do plano? Os registros antigos continuam no histórico.`, { ok: 'Remover', danger: true }))) return;
      m.archived = true; ctx.save();
    },
    addmeal(ctx) {
      ctx.state.plan.meals.push({ id: newId('m'), name: 'Nova refeição', emoji: '🍽️', options: [] });
      ctx.state.plan.isExample = false; ctx.save();
    },
    move(ctx, el) {
      const all = ctx.state.plan.meals, act = active(ctx.state);
      const i = act.findIndex(x => x.id === el.dataset.m), j = i + Number(el.dataset.d);
      if (j < 0 || j >= act.length) return;
      const a = all.indexOf(act[i]), b = all.indexOf(act[j]);
      [all[a], all[b]] = [all[b], all[a]];
      ctx.save();
    },
    emoji(ctx, el) {
      ctx.sheet(`<h3>Escolher ícone</h3><div class="emoji-grid">${EMOJIS.map(e => `<button data-act="meals:emojiset" data-m="${el.dataset.m}" data-e="${e}">${e}</button>`).join('')}</div>`);
    },
    emojiset(ctx, el) { const m = ctx.state.plan.meals.find(x => x.id === el.dataset.m); m.emoji = el.dataset.e; ctx.closeSheet(); ctx.save(); },

    async uploadpdf(ctx) {
      const f = await ctx.pickFile('application/pdf,.pdf');
      if (!f) return;
      if (ctx.state.plan.pdfId) await deleteBlob(ctx.state.plan.pdfId);
      ctx.state.plan.pdfId = await putBlob(f, 'pdf');
      ctx.state.plan.pdfName = f.name;
      ctx.save();
      ctx.toast('PDF guardado 💾');
      await this_import(ctx);
    },
    async viewpdf(ctx) {
      const w = window.open('', '_blank');
      const u = await blobURL(ctx.state.plan.pdfId);
      if (w) w.location.href = u; else location.href = u;
    },
    importpdf(ctx) { return this_import(ctx); },
    pastetext(ctx) {
      const cur = active(ctx.state).map(m => [`# ${m.name}`, ...m.options.filter(o => !o.archived).map(o => `${o.kind === 'acomp' ? '+' : '-'} ${o.name}`)].join('\n')).join('\n\n');
      draftSheet(ctx, cur, 'text');
    },
    async applydraft(ctx) {
      const { parseDraft } = await import('../pdfimport.js');
      const meals = parseDraft(ctx.sheetVal('draft'));
      if (!meals.length) { ctx.toast('Nenhuma refeição encontrada. Use # antes do nome.'); return; }
      ctx.closeSheet();
      if (!(await ctx.confirm(`Aplicar plano com ${meals.length} refeições? O plano atual será substituído (registros antigos continuam no histórico).`, { ok: 'Aplicar' }))) return;
      const old = ctx.state.plan.meals;
      // reaproveita refeições/opções com o mesmo nome para manter o histórico ligado
      const norm = t => t.toLowerCase().trim();
      const next = meals.map((nm, i) => {
        const prev = old.find(o => norm(o.name) === norm(nm.name));
        const m = prev || { id: newId('m'), name: nm.name, emoji: EMOJIS[i % EMOJIS.length], options: [] };
        m.archived = false; m.name = nm.name;
        const keep = [];
        for (const no of nm.options) {
          const po = m.options.find(o => norm(o.name) === norm(no.name));
          if (po) { po.archived = false; po.kind = no.kind; keep.push(po); }
          else keep.push({ id: newId('o'), name: no.name, kind: no.kind });
        }
        for (const o of m.options) if (!keep.includes(o)) { o.archived = true; keep.push(o); }
        m.options = keep;
        return m;
      });
      for (const o of old) if (!next.includes(o)) { o.archived = true; next.push(o); }
      ctx.state.plan.meals = next;
      ctx.state.plan.isExample = false;
      ctx.save();
      ctx.toast('Plano atualizado 🌸');
    },
  },
};

async function this_import(ctx) {
  const id = ctx.state.plan.pdfId;
  if (!id) return;
  ctx.toast('Lendo o PDF…');
  try {
    const { pdfToLines, linesToDraft } = await import('../pdfimport.js');
    const { getBlob } = await import('../store.js');
    const lines = await pdfToLines(await getBlob(id));
    const draft = linesToDraft(lines);
    if (!draft) {
      draftSheet(ctx, lines.length ? lines.join('\n') : '# Café da manhã\n- ', 'text');
      ctx.toast(lines.length ? 'Não reconheci as refeições: organize o texto' : 'O PDF parece ser uma imagem: digite o plano');
      return;
    }
    draftSheet(ctx, draft, 'pdf');
  } catch (e) {
    console.error(e);
    ctx.toast('Não consegui ler o PDF. Você pode digitar o plano.');
  }
}
