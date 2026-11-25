// Nutri: avaliações da consulta (bioimpedância, medidas). Importa o PDF, extrai os dados,
// compara com referências gerais e com a avaliação anterior, e cruza com os hábitos do app.
import { esc, todayKey, shortDate, fmtNum, pct, monthDays, parseKey, addDays, lineChart } from '../util.js';
import { newId, putBlob, blobURL, deleteBlob, getBlob } from '../store.js';

// better: 'down' = diminuir é bom, 'up' = aumentar é bom
export const FIELDS = [
  { k: 'peso', l: 'Peso', u: 'kg', re: /\bpeso\b/i, not: /ideal|alvo|meta|controle|ajuste|[óo]sse|magr|gord|livre/i, min: 30, max: 250 },
  { k: 'altura', l: 'Altura', u: 'cm', re: /altura|estatura/i, min: 1, max: 230 },
  { k: 'imc', l: 'IMC', u: 'kg/m²', re: /\bimc\b|[íi]ndice de massa corporal/i, min: 10, max: 70 },
  { k: 'gord_pct', l: 'Gordura corporal', u: '%', re: /(percentual|porcentagem|%)\s*(de\s*)?gordura|gordura\s*(corporal\s*)?(\(%\)|%|percentual)|\bpgc\b|%\s*gc\b|body fat/i, not: /visceral/i, min: 3, max: 70, better: 'down' },
  { k: 'gord_kg', l: 'Massa de gordura', u: 'kg', re: /massa\s*(de\s*)?gordura|massa gorda|gordura\s*(corporal\s*)?\(kg\)/i, not: /%|percent|visceral|livre/i, min: 2, max: 150, better: 'down' },
  { k: 'magra_kg', l: 'Massa magra', u: 'kg', re: /massa\s*(livre\s*de\s*gordura|magra)|\bmlg\b/i, min: 20, max: 130, better: 'up' },
  { k: 'musc_kg', l: 'Massa muscular', u: 'kg', re: /massa\s*muscular|m[úu]sculo\s*esquel|\bmme\b|\bsmm\b/i, min: 10, max: 90, better: 'up' },
  { k: 'agua_pct', l: 'Água corporal', u: '%', re: /[áa]gua\s*corporal|\bact\b|total body water|hidrata/i, need: /%/, min: 30, max: 80 },
  { k: 'agua_l', l: 'Água corporal total', u: 'L', re: /[áa]gua\s*corporal|\bact\b|total body water/i, not: /%/, min: 15, max: 75 },
  { k: 'visceral', l: 'Gordura visceral', u: 'nível', re: /visceral/i, min: 1, max: 30, better: 'down' },
  { k: 'tmb', l: 'Taxa metabólica basal', u: 'kcal', re: /metab[óo]lica\s*basal|\btmb\b|metabolismo\s*basal|\bbmr\b/i, min: 700, max: 4000 },
  { k: 'idade_met', l: 'Idade metabólica', u: 'anos', re: /idade\s*metab/i, min: 10, max: 100, better: 'down' },
  { k: 'ossea', l: 'Massa óssea', u: 'kg', re: /massa\s*[óo]ssea|minerais|conte[úu]do mineral/i, min: 0.5, max: 8 },
  { k: 'cintura', l: 'Cintura', u: 'cm', re: /cintura/i, not: /rela[çc]|\/|quadril/i, min: 40, max: 170, better: 'down' },
  { k: 'quadril', l: 'Quadril', u: 'cm', re: /quadril/i, not: /rela[çc]|cintura/i, min: 60, max: 190 },
  { k: 'abdomen', l: 'Abdômen', u: 'cm', re: /abd[ôo]m/i, min: 40, max: 180, better: 'down' },
  { k: 'braco', l: 'Braço', u: 'cm', re: /bra[çc]o/i, min: 15, max: 65 },
  { k: 'coxa', l: 'Coxa', u: 'cm', re: /coxa/i, min: 30, max: 95 },
  { k: 'rcq', l: 'Relação cintura/quadril', u: '', re: /rela[çc][ãa]o\s*cintura|\brcq\b/i, min: 0.5, max: 1.4, better: 'down' },
];
const F = Object.fromEntries(FIELDS.map(f => [f.k, f]));

const num = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const fmtV = (v, k) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: k === 'tmb' }));

// ---------- extração ----------
export function extract(lines) {
  const out = { values: {}, meta: {} };
  const numsIn = t => [...t.matchAll(/(\d{1,4}(?:[.,]\d{1,3})?)/g)].map(m => m[1]);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const f of FIELDS) {
      if (out.values[f.k] != null) continue;
      const m = line.match(f.re);
      if (!m) continue;
      const end = m.index + m[0].length;
      const after = line.slice(end);
      const fn = after.search(/\d/);
      // janela: rótulo + logo depois do número (evita "Peso ideal", "% x L" etc.)
      const win = fn < 0 ? line : line.slice(0, end + fn + 9);
      if (f.not && f.not.test(win)) continue;
      if (f.need && !f.need.test(fn < 0 ? line + ' ' + (lines[i + 1] || '').slice(0, 14) : win)) continue;
      const cands = [...numsIn(after), ...numsIn(lines[i + 1] || '').slice(0, 1)];
      for (const c of cands) {
        let v = num(c);
        if (f.k === 'altura' && v > 1 && v < 2.5) v = Math.round(v * 100);
        if (v >= f.min && v <= f.max) { out.values[f.k] = v; break; }
      }
    }
  }
  const all = lines.join('\n');
  const d = all.match(/(\d{2})[\/.](\d{2})[\/.](\d{4})/);
  if (d) { const k = `${d[3]}-${d[2]}-${d[1]}`; if (k <= todayKey() && k > '2000') out.meta.date = k; }
  const nm = all.match(/nome(?:\s+d[oa]\s+paciente|\s+paciente)?\s*[:\-]\s*([A-Za-zÀ-ú' ]{3,60})/i) || all.match(/paciente\s*[:\-]\s*([A-Za-zÀ-ú' ]{3,60})/i);
  if (nm) out.meta.name = nm[1].trim().replace(/\s+(idade|sexo|data|altura).*$/i, '');
  const id = all.match(/idade(?!\s*metab)\s*[:\-]?\s*(\d{1,3})/i);
  if (id) out.meta.age = Number(id[1]);
  const sx = all.match(/sexo\s*[:\-]?\s*(feminino|masculino|f\b|m\b)/i);
  if (sx) out.meta.sex = /^f/i.test(sx[1]) ? 'F' : 'M';
  return out;
}

// ---------- análise ----------
export function ageOf(birth, at = todayKey()) {
  if (!birth) return null;
  const b = parseKey(birth), d = parseKey(at);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a;
}

function fatRange(sex, age) {
  // Gallagher et al., 2000 (faixas saudáveis de % de gordura)
  const a = age || 30;
  if (sex === 'M') return a < 40 ? [8, 20] : a < 60 ? [11, 22] : [13, 25];
  return a < 40 ? [21, 33] : a < 60 ? [23, 34] : [24, 36];
}

export function analyze(a, ctx) {
  const prof = ctx.state.profile || {};
  const sex = prof.sex || 'F';
  const v = { ...a.values };
  const h = v.altura || prof.height;
  const age = a.age || ageOf(prof.birth, a.date);
  if (v.imc == null && v.peso && h) v.imc = Math.round((v.peso / ((h / 100) ** 2)) * 10) / 10;
  if (v.rcq == null && v.cintura && v.quadril) v.rcq = Math.round((v.cintura / v.quadril) * 100) / 100;
  if (v.gord_pct == null && v.gord_kg && v.peso) v.gord_pct = Math.round((v.gord_kg / v.peso) * 1000) / 10;

  const items = [];
  const add = (k, status, text, ref = '') => items.push({ k, status, text, ref });
  if (v.imc != null) {
    const x = v.imc;
    if (x < 18.5) add('imc', 'melhorar', 'Abaixo da faixa adequada.', '18,5 a 24,9');
    else if (x < 25) add('imc', 'bom', 'Dentro da faixa adequada.', '18,5 a 24,9');
    else if (x < 30) add('imc', 'melhorar', 'Faixa de sobrepeso. O IMC não separa músculo de gordura: olhe junto com a % de gordura.', '18,5 a 24,9');
    else add('imc', 'melhorar', 'Faixa de obesidade. Vale acompanhar junto com a composição corporal.', '18,5 a 24,9');
  }
  if (v.gord_pct != null) {
    const [lo, hi] = fatRange(sex, age);
    const r = `${lo}% a ${hi}%`;
    if (v.gord_pct < lo) add('gord_pct', 'melhorar', 'Abaixo da faixa saudável para sua idade.', r);
    else if (v.gord_pct <= hi) add('gord_pct', 'bom', 'Dentro da faixa saudável para sua idade.', r);
    else add('gord_pct', 'melhorar', `Acima da faixa: ${fmtNum(v.gord_pct - hi, 1)} pontos além do limite. Treino de força e constância no plano ajudam a reduzir gordura preservando músculo.`, r);
  }
  if (v.visceral != null) {
    if (v.visceral <= 9) add('visceral', 'bom', 'Nível saudável.', 'até 9');
    else if (v.visceral <= 14) add('visceral', 'melhorar', 'Nível elevado. Atividade aeróbica, sono e menos ultraprocessados costumam reduzir.', 'até 9');
    else add('visceral', 'melhorar', 'Nível alto. Converse com a nutricionista sobre prioridades.', 'até 9');
  }
  if (v.cintura != null) {
    const [ok, hi] = sex === 'M' ? [94, 102] : [80, 88];
    if (v.cintura < ok) add('cintura', 'bom', 'Risco cardiometabólico baixo.', `abaixo de ${ok} cm`);
    else if (v.cintura < hi) add('cintura', 'melhorar', 'Risco aumentado (OMS).', `abaixo de ${ok} cm`);
    else add('cintura', 'melhorar', 'Risco muito aumentado (OMS).', `abaixo de ${ok} cm`);
  }
  if (v.rcq != null) {
    const lim = sex === 'M' ? 0.9 : 0.85;
    add('rcq', v.rcq < lim ? 'bom' : 'melhorar', v.rcq < lim ? 'Dentro do recomendado.' : 'Acima do recomendado (OMS), indica gordura concentrada no abdômen.', `abaixo de ${fmtNum(lim, 2)}`);
  }
  if (v.agua_pct != null) {
    const [lo, hi] = sex === 'M' ? [50, 65] : [45, 60];
    if (v.agua_pct < lo) add('agua_pct', 'melhorar', `Abaixo do esperado. Sua meta de água no app é ${fmtNum(ctx.state.water.goalMl / 1000, 1)} L por dia.`, `${lo}% a ${hi}%`);
    else if (v.agua_pct <= hi) add('agua_pct', 'bom', 'Hidratação dentro do esperado.', `${lo}% a ${hi}%`);
    else add('agua_pct', 'info', 'Acima da faixa usual, o que pode refletir boa massa muscular.', `${lo}% a ${hi}%`);
  }
  if (v.idade_met != null && age) {
    add('idade_met', v.idade_met <= age ? 'bom' : 'melhorar', v.idade_met <= age ? `Igual ou abaixo da sua idade (${age}).` : `Acima da sua idade (${age}). Ganhar massa muscular costuma baixar esse número.`, `até ${age} anos`);
  }
  if (v.musc_kg != null && v.peso) add('musc_kg', 'info', `Representa ${fmtNum((v.musc_kg / v.peso) * 100, 1)}% do seu peso.`);
  for (const k of ['peso', 'magra_kg', 'gord_kg', 'agua_l', 'tmb', 'ossea', 'quadril', 'abdomen', 'braco', 'coxa', 'altura'])
    if (v[k] != null && !items.some(i => i.k === k)) add(k, 'info', k === 'tmb' ? 'Energia que o corpo gasta em repouso.' : '');

  return { values: v, items, age, sex };
}

function trend(k, cur, prev) {
  if (cur == null || prev == null) return null;
  const d = Math.round((cur - prev) * 100) / 100;
  if (!d) return { d, good: null };
  const b = F[k] && F[k].better;
  return { d, good: b ? (b === 'down' ? d < 0 : d > 0) : null };
}

// hábitos entre duas datas
function habitsBetween(s, from, to) {
  let days = 0, trained = 0, waterSum = 0, waterDays = 0, plan = 0, free = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    days++;
    const w = s.workoutLog[d]; if (w && w.acts.length) trained++;
    const wa = s.water.log[d]; if (wa) { waterDays++; waterSum += Math.min(150, pct(wa.ml, wa.goal)); }
    for (const e of Object.values(s.mealLog[d] || {})) { if (e.free) free++; else if ((e.opts && e.opts.length) || e.other) plan++; }
    if (days > 400) break;
  }
  return { days, trained, waterAvg: waterDays ? Math.round(waterSum / waterDays) : null, planPct: plan + free ? pct(plan, plan + free) : null, free };
}

const sorted = s => [...s.assessments].sort((a, b) => a.date.localeCompare(b.date));

function reportHTML(ctx, a) {
  const list = sorted(ctx.state);
  const i = list.indexOf(a), prev = i > 0 ? list[i - 1] : null;
  const R = analyze(a, ctx), P = prev ? analyze(prev, ctx) : null;
  const good = [], improve = [], info = [];
  for (const it of R.items) {
    const t = P ? trend(it.k, R.values[it.k], P.values[it.k]) : null;
    const row = { ...it, t };
    if (it.status === 'bom') good.push(row);
    else if (it.status === 'melhorar') improve.push(row);
    else if (t && t.good === true) good.push(row);
    else if (t && t.good === false) improve.push(row);
    else info.push(row);
  }
  const line = r => {
    const f = F[r.k];
    const tr = r.t && r.t.d ? `<span class="delta ${r.t.good === true ? 'up' : r.t.good === false ? 'down' : ''}">${r.t.d > 0 ? '▲' : '▼'} ${fmtV(Math.abs(r.t.d), r.k)}</span>` : '';
    return `<li class="an-item ${r.status}"><div class="an-top"><b>${f.l}</b><span class="an-v">${fmtV(R.values[r.k], r.k)} <small>${f.u}</small>${tr}</span></div>
      ${r.text ? `<p>${esc(r.text)}</p>` : ''}${r.ref ? `<small class="muted">Referência: ${esc(r.ref)}</small>` : ''}</li>`;
  };
  let habits = '';
  if (prev) {
    const hb = habitsBetween(ctx.state, prev.date, a.date);
    habits = `<div class="card soft"><div class="card-h"><span class="ce">🔗</span><b>Seus hábitos entre as consultas</b></div>
      <p class="small muted">${shortDate(prev.date)} → ${shortDate(a.date)} · ${hb.days} dias</p>
      <div class="trio"><div><b>${hb.trained}</b><small>dias de treino</small></div>
      <div><b>${hb.waterAvg == null ? '—' : hb.waterAvg + '%'}</b><small>média da meta de água</small></div>
      <div><b>${hb.planPct == null ? '—' : hb.planPct + '%'}</b><small>refeições do plano</small></div></div></div>`;
  }
  return `<div class="card an-head">
      <div class="card-h"><span class="ce">🩺</span><b>Avaliação de ${shortDate(a.date)}</b>
      <button class="icon-btn pencil" data-act="nutri:edit" data-id="${a.id}" aria-label="Editar">✏️</button></div>
      <div class="an-score"><div class="sc good"><b>${good.length}</b><small>pontos bons</small></div><div class="sc imp"><b>${improve.length}</b><small>para melhorar</small></div>
      ${prev ? `<div class="sc"><b>${Math.round((parseKey(a.date) - parseKey(prev.date)) / 86400000)}</b><small>dias desde a anterior</small></div>` : ''}</div>
      ${a.pdfId ? `<button class="link-btn" data-act="nutri:viewpdf" data-id="${a.id}">📄 Ver PDF da consulta</button>` : ''}
    </div>
    ${good.length ? `<div class="card"><div class="card-h"><span class="ce" style="--c:var(--mint)">✅</span><b>O que está bom</b></div><ul class="an-list">${good.map(line).join('')}</ul></div>` : ''}
    ${improve.length ? `<div class="card"><div class="card-h"><span class="ce" style="--c:var(--peach)">🌱</span><b>O que pode melhorar</b></div><ul class="an-list">${improve.map(line).join('')}</ul></div>` : ''}
    ${info.length ? `<div class="card"><div class="card-h"><span class="ce" style="--c:var(--sky)">📋</span><b>Outros dados</b></div><ul class="an-list">${info.map(line).join('')}</ul></div>` : ''}
    ${habits}
    ${a.notes ? `<div class="card soft"><div class="card-h"><span class="ce">📝</span><b>Anotações</b></div><p class="small">${esc(a.notes)}</p></div>` : ''}
    <p class="small muted center">${prev ? '▲▼ comparam com a avaliação anterior. ' : ''}Referências gerais (OMS e estudos de composição corporal). Sua nutricionista pode definir outras metas para você.</p>`;
}

function formSheet(ctx, a, { draft = null, raw = '' } = {}) {
  const v = draft ? draft.values : a ? a.values : {};
  const date = draft ? draft.meta.date || todayKey() : a ? a.date : todayKey();
  const prof = ctx.state.profile || {};
  const found = draft ? Object.keys(draft.values).length : null;
  const profHints = draft && ((draft.meta.name && !prof.name) || (draft.values.altura && !prof.height) || (draft.meta.sex && !prof.sex));
  ctx.sheet(`<h3>${a ? 'Editar avaliação' : '🩺 Nova avaliação'}</h3>
    ${draft ? `<p class="small ${found ? 'muted' : ''}">${found ? `Encontrei <b>${found}</b> valores no PDF. Confira e complete o que faltar.` : '<b>Não reconheci os valores automaticamente</b> (o PDF pode ser uma imagem). Preencha abaixo; o PDF fica guardado junto.'}</p>` : ''}
    <label class="field"><span>Data da consulta</span><input type="date" id="nv-date" max="${todayKey()}" value="${date}"></label>
    <div class="nv-grid">${FIELDS.map(f => `<label class="field nv"><span>${f.l} ${f.u ? `<small>(${f.u})</small>` : ''}</span>
      <input type="text" inputmode="decimal" id="nv-${f.k}" value="${v[f.k] != null ? Number(v[f.k]).toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false }) : ''}" class="${draft && v[f.k] != null ? 'found' : ''}"></label>`).join('')}</div>
    <label class="field"><span>Anotações da consulta</span><textarea id="nv-notes" rows="3" placeholder="Orientações, metas combinadas…">${esc(a ? a.notes || '' : '')}</textarea></label>
    <label class="check-line"><input type="checkbox" id="nv-w" ${a ? '' : 'checked'}> Registrar o peso também na aba Corpo</label>
    ${profHints ? `<label class="check-line"><input type="checkbox" id="nv-prof" checked> Completar meu perfil com ${[draft.meta.name && !prof.name ? 'nome' : '', draft.values.altura && !prof.height ? 'altura' : '', draft.meta.sex && !prof.sex ? 'sexo' : ''].filter(Boolean).join(', ')} do PDF</label>` : ''}
    ${raw ? `<details><summary>Ver texto lido do PDF</summary><pre class="raw">${esc(raw)}</pre></details>` : ''}
    <div class="row-btns">${a ? `<button class="btn ghost danger" data-act="nutri:del" data-id="${a.id}">Excluir</button>` : `<button class="btn ghost" data-act="app:closesheet">Cancelar</button>`}
    <button class="btn" data-act="nutri:save" data-id="${a ? a.id : ''}">Salvar</button></div>`, { cls: 'tall' });
  ctx._nutriDraft = draft;
}

export default {
  id: 'nutri', tabId: 'nutri', title: 'Nutri', short: 'Nutri', emoji: '🩺', color: 'var(--mint-d)',

  defaults(s) { s.assessments = s.assessments || []; },

  renderTab(ctx) {
    const s = ctx.state, list = sorted(s);
    const sel = list.find(a => a.id === ctx.ui.nutriSel) || list[list.length - 1];
    const prof = s.profile || {};
    const next = prof.nextVisit && prof.nextVisit >= todayKey() ? Math.round((parseKey(prof.nextVisit) - parseKey(todayKey())) / 86400000) : null;
    const chart = (k, color) => {
      const pts = list.slice(-8).map(a => ({ label: shortDate(a.date).slice(0, 5), value: analyze(a, ctx).values[k] ?? null }));
      return pts.filter(p => p.value != null).length >= 2 ? `<h4 class="sub">${F[k].l} (${F[k].u})</h4>${lineChart(pts, { color })}` : '';
    };
    const charts = list.length >= 2 ? chart('peso', 'var(--rose-d)') + chart('gord_pct', 'var(--peach-d)') + chart('musc_kg', 'var(--lilac-d)') + chart('cintura', 'var(--sky-d)') : '';
    return `<div class="card">
      <div class="card-h"><span class="ce">📄</span><b>Importar consulta</b></div>
      <p class="small muted">Envie o PDF da avaliação da nutricionista (bioimpedância, medidas). O app lê os dados neste aparelho, compara com referências e com a consulta anterior.</p>
      <div class="row-btns left wrap"><button class="btn" data-act="nutri:import">Enviar PDF</button>
      <button class="btn ghost" data-act="nutri:manual">Digitar valores</button></div>
      ${next != null ? `<p class="small">📅 Próxima consulta: <b>${shortDate(prof.nextVisit)}</b> (${next === 0 ? 'hoje' : `em ${next} dia${next > 1 ? 's' : ''}`})</p>` : ''}
    </div>
    ${list.length > 1 ? `<div class="chips nutri-pick">${list.slice().reverse().map(a => `<button class="chip ${a === sel ? 'on' : ''}" data-act="nutri:sel" data-id="${a.id}">${shortDate(a.date)}</button>`).join('')}</div>` : ''}
    ${sel ? reportHTML(ctx, sel) : `<div class="card soft center"><div class="big-emoji">🩺</div><p class="muted">Nenhuma avaliação ainda. Envie o PDF da sua última consulta para ver a análise.</p></div>`}
    ${charts ? `<div class="card evo"><div class="card-h"><span class="ce">📈</span><b>Evolução entre consultas</b></div>${charts}</div>` : ''}`;
  },

  hasRecord(s, d) { return s.assessments.some(a => a.date === d); },
  dayDetail(ctx, d) {
    const a = ctx.state.assessments.find(x => x.date === d);
    return a ? `<div class="dd"><h4>🩺 Consulta</h4><p>${a.values.peso ? fmtV(a.values.peso) + ' kg' : 'Avaliação registrada'}${a.values.gord_pct ? ` · ${fmtV(a.values.gord_pct)}% gordura` : ''}</p></div>` : '';
  },

  actions: {
    sel(ctx, el) { ctx.ui.nutriSel = el.dataset.id; ctx.render(); },
    manual(ctx) { formSheet(ctx, null); },
    async import(ctx) {
      const f = await ctx.pickFile('application/pdf,.pdf');
      if (!f) return;
      ctx.toast('Lendo o PDF…');
      const pdfId = await putBlob(f, 'pdf');
      let draft = { values: {}, meta: {} }, raw = '';
      try {
        const { pdfToLines } = await import('../pdfimport.js');
        const lines = await pdfToLines(f);
        raw = lines.join('\n');
        draft = extract(lines);
      } catch (e) { console.error(e); }
      draft.pdfId = pdfId; draft.pdfName = f.name;
      formSheet(ctx, null, { draft, raw });
    },
    save(ctx, el) {
      const s = ctx.state;
      const values = {};
      for (const f of FIELDS) {
        const raw = ctx.sheetVal('nv-' + f.k).trim();
        if (!raw) continue;
        let v = num(raw);
        if (f.k === 'altura' && v > 1 && v < 2.5) v = Math.round(v * 100);
        if (isNaN(v) || v < f.min || v > f.max) { ctx.toast(`Confira o valor de ${f.l}`); document.querySelector('#nv-' + f.k)?.focus(); return; }
        values[f.k] = v;
      }
      if (!Object.keys(values).length) { ctx.toast('Preencha pelo menos um valor'); return; }
      const date = ctx.sheetVal('nv-date') || todayKey();
      const notes = ctx.sheetVal('nv-notes').trim();
      const regW = document.getElementById('nv-w')?.checked;
      const fillProf = document.getElementById('nv-prof')?.checked;
      const draft = ctx._nutriDraft;
      let a = el.dataset.id && s.assessments.find(x => x.id === el.dataset.id);
      if (!a) {
        a = { id: newId('av'), date, values, notes, pdfId: draft && draft.pdfId || null, pdfName: draft && draft.pdfName || null, age: draft && draft.meta.age || null };
        s.assessments.push(a);
      } else Object.assign(a, { date, values, notes });
      if (regW && values.peso) {
        const w = a.wid && s.weights.find(x => x.id === a.wid);
        if (w) { w.kg = values.peso; w.date = date; }
        else { const nw = { id: newId('w'), date, kg: values.peso, ts: Date.now(), fromVisit: true }; s.weights.push(nw); a.wid = nw.id; }
      }
      if (fillProf && draft) {
        s.profile = s.profile || {};
        if (draft.meta.name && !s.profile.name) s.profile.name = draft.meta.name;
        if (values.altura && !s.profile.height) s.profile.height = values.altura;
        if (draft.meta.sex && !s.profile.sex) s.profile.sex = draft.meta.sex;
      }
      ctx._nutriDraft = null;
      ctx.ui.nutriSel = a.id;
      ctx.closeSheet(); ctx.save(); window.scrollTo(0, 0);
      ctx.toast('Avaliação salva 🩺');
    },
    edit(ctx, el) { formSheet(ctx, ctx.state.assessments.find(x => x.id === el.dataset.id)); },
    async del(ctx, el) {
      const a = ctx.state.assessments.find(x => x.id === el.dataset.id);
      ctx.closeSheet();
      if (!(await ctx.confirm(`Excluir a avaliação de ${shortDate(a.date)}?`, { ok: 'Excluir', danger: true }))) return;
      if (a.pdfId) await deleteBlob(a.pdfId);
      ctx.state.assessments = ctx.state.assessments.filter(x => x !== a);
      ctx.save();
    },
    async viewpdf(ctx, el) {
      const a = ctx.state.assessments.find(x => x.id === el.dataset.id);
      const w = window.open('', '_blank');
      const u = await blobURL(a.pdfId);
      if (w) w.location.href = u; else location.href = u;
    },
  },
};
