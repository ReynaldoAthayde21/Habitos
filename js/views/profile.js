// Perfil: dados pessoais, usados também nas análises (idade, altura, sexo).
import { esc, todayKey, shortDate, fmtNum, parseKey } from '../util.js';
import { deleteBlob } from '../store.js';
import { ageOf } from '../habits/nutri.js';

const OBJ = ['Emagrecer', 'Ganhar massa muscular', 'Manter o peso', 'Saúde e bem-estar', 'Performance no esporte'];
const ATIV = ['Sedentária', 'Leve (1–2x/semana)', 'Moderada (3–4x/semana)', 'Intensa (5x ou mais)'];

const lastKg = s => { const w = [...s.weights].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts); return w.length ? w[w.length - 1] : null; };

function field(label, id, input) { return `<label class="field"><span>${label}</span>${input}</label>`; }
const txt = (k, v, ph = '', type = 'text', extra = '') => `<input type="${type}" ${extra} value="${esc(v ?? '')}" placeholder="${esc(ph)}" data-change="profile:set" data-k="${k}">`;
const sel = (k, v, opts) => `<select data-change="profile:set" data-k="${k}"><option value="">—</option>${opts.map(([val, l]) => `<option value="${esc(val)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

export function avatarHTML(s) {
  const p = s.profile || {};
  if (p.photo) return `<img data-photo="${p.photo}" alt="">`;
  if (p.name) return `<span>${esc(p.name.trim()[0].toUpperCase())}</span>`;
  return '<span>👤</span>';
}

export default {
  id: 'profile', tabId: 'perfil', title: 'Perfil', emoji: '👤', color: 'var(--pink)',
  render(ctx) {
    const s = ctx.state, p = s.profile || {};
    const age = ageOf(p.birth);
    const w = lastKg(s);
    const h = p.height;
    const imc = w && h ? w.kg / ((h / 100) ** 2) : null;
    const imcTxt = imc == null ? '' : imc < 18.5 ? 'abaixo do adequado' : imc < 25 ? 'adequado' : imc < 30 ? 'sobrepeso' : 'obesidade';
    const range = h ? [18.5 * (h / 100) ** 2, 24.9 * (h / 100) ** 2] : null;
    const toGoal = w && p.goalKg ? w.kg - p.goalKg : null;
    const next = p.nextVisit && p.nextVisit >= todayKey() ? Math.round((parseKey(p.nextVisit) - parseKey(todayKey())) / 86400000) : null;
    return `<div class="card profile-head">
      <button class="avatar big" data-act="profile:photo">${avatarHTML(s)}<i>📷</i></button>
      <div><h2>${esc(p.name || 'Seu nome')}</h2><p class="muted small">${[age != null ? `${age} anos` : '', h ? `${fmtNum(h)} cm` : '', w ? `${fmtNum(w.kg, 1)} kg` : ''].filter(Boolean).join(' · ') || 'Complete seus dados abaixo'}</p>
      ${p.goal ? `<span class="pill">🎯 ${esc(p.goal)}</span>` : ''}</div>
    </div>
    <div class="card soft">
      <div class="prof-stats">
        <div><small>IMC</small><b>${imc ? fmtNum(imc, 1) : '—'}</b><small>${imcTxt || 'precisa de altura e peso'}</small></div>
        <div><small>Peso saudável para sua altura</small><b>${range ? `${fmtNum(range[0], 1)}–${fmtNum(range[1], 1)}` : '—'}</b><small>kg (IMC 18,5–24,9)</small></div>
        <div><small>Até a meta</small><b>${toGoal == null ? '—' : toGoal === 0 ? '🎉' : `${fmtNum(Math.abs(toGoal), 1)} kg`}</b><small>${toGoal == null ? 'defina uma meta de peso' : toGoal > 0 ? 'para perder' : toGoal < 0 ? 'para ganhar' : 'meta atingida!'}</small></div>
        <div><small>Próxima consulta</small><b>${next == null ? '—' : next === 0 ? 'hoje' : `${next} dias`}</b><small>${p.nextVisit && next != null ? shortDate(p.nextVisit) : 'sem data'}</small></div>
      </div>
      <p class="small muted">Peso atual vem do último registro na aba Corpo${w ? ` (${shortDate(w.date)})` : ''}.</p>
    </div>
    <div class="card"><div class="card-h"><span class="ce">🌸</span><b>Sobre você</b></div>
      ${field('Nome', 'name', txt('name', p.name, 'Como quer ser chamada'))}
      <div class="two">${field('Data de nascimento', 'birth', txt('birth', p.birth, '', 'date', `max="${todayKey()}"`))}
      ${field('Sexo', 'sex', sel('sex', p.sex || 'F', [['F', 'Feminino'], ['M', 'Masculino']]))}</div>
      <div class="two">${field('Altura (cm)', 'height', txt('height', p.height, 'ex.: 165', 'text', 'inputmode="decimal"'))}
      ${field('Meta de peso (kg)', 'goalKg', txt('goalKg', p.goalKg != null ? fmtNum(p.goalKg, 1) : '', 'ex.: 60', 'text', 'inputmode="decimal"'))}</div>
      ${field('Objetivo principal', 'goal', sel('goal', p.goal, OBJ.map(o => [o, o])))}
      ${field('Nível de atividade', 'activity', sel('activity', p.activity, ATIV.map(o => [o, o])))}
    </div>
    <div class="card"><div class="card-h"><span class="ce">🩺</span><b>Saúde e acompanhamento</b></div>
      ${field('Nutricionista', 'nutri', txt('nutri', p.nutri, 'Nome da nutricionista'))}
      <div class="two">${field('Contato', 'nutriContact', txt('nutriContact', p.nutriContact, 'WhatsApp ou e-mail'))}
      ${field('Próxima consulta', 'nextVisit', txt('nextVisit', p.nextVisit, '', 'date'))}</div>
      ${field('Alergias e intolerâncias', 'allergies', txt('allergies', p.allergies, 'ex.: lactose'))}
      ${field('Restrições ou preferências', 'restrictions', txt('restrictions', p.restrictions, 'ex.: não come carne vermelha'))}
      ${field('Condições de saúde e medicamentos', 'health', txt('health', p.health, 'Opcional'))}
      ${field('Suplementos', 'supplements', txt('supplements', p.supplements, 'ex.: whey, creatina'))}
      ${field('Sono (horas por noite)', 'sleep', txt('sleep', p.sleep, 'ex.: 7', 'text', 'inputmode="decimal"'))}
      <label class="field"><span>Observações</span><textarea rows="3" data-change="profile:set" data-k="notes" placeholder="Qualquer coisa importante">${esc(p.notes || '')}</textarea></label>
    </div>
    <p class="center small muted">Idade, altura e sexo são usados na análise das consultas (aba Nutri). Tudo fica só neste aparelho.</p>`;
  },
  actions: {
    set(ctx, el) {
      const p = ctx.state.profile = ctx.state.profile || {};
      const k = el.dataset.k;
      let v = el.value.trim();
      if (k === 'height' || k === 'goalKg' || k === 'sleep') {
        if (!v) v = null;
        else {
          let n = parseFloat(v.replace(',', '.'));
          if (k === 'height' && n > 1 && n < 2.5) n = Math.round(n * 100);
          const ok = k === 'height' ? n >= 100 && n <= 230 : k === 'goalKg' ? n >= 30 && n <= 250 : n >= 0 && n <= 16;
          if (!ok) { ctx.toast('Valor inválido'); ctx.render(); return; }
          v = n;
        }
      }
      p[k] = v || (v === 0 ? 0 : null);
      ctx.save();
    },
    async photo(ctx) {
      const id = await ctx.pickPhoto(); if (!id) return;
      const p = ctx.state.profile = ctx.state.profile || {};
      if (p.photo) await deleteBlob(p.photo);
      p.photo = id; ctx.save();
    },
  },
};
