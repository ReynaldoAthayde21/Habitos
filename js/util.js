// Utilidades: datas, texto, gráficos SVG.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad = n => String(n).padStart(2, '0');
export const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const mkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const todayKey = () => dkey(new Date());
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
export const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return mkey(d); };
export const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const monthDays = ym => Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${pad(i + 1)}`);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const SEMANA_CURTA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const monthName = ym => { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
export const monthShort = ym => MES_CURTO[Number(ym.split('-')[1]) - 1];
export function dayLabel(k) {
  const t = todayKey();
  if (k === t) return 'Hoje';
  if (k === addDays(t, -1)) return 'Ontem';
  if (k === addDays(t, 1)) return 'Amanhã';
  const d = parseKey(k);
  return `${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
export const shortDate = k => { if (!k) return ''; const d = parseKey(k); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtNum = (n, dec = 0) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtL = ml => `${fmtNum(ml / 1000, ml % 1000 === 0 ? 0 : 1)} L`;
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- gráficos SVG simples ----------

// Barras verticais. items: [{label, value, color?, sub?}]
export function barChart(items, { max, unit = '', height = 150, color = 'var(--pink)', decimals = 0 } = {}) {
  const W = 320, H = height, top = 18, bottom = 22;
  const m = max ?? Math.max(1, ...items.map(i => i.value));
  const n = Math.max(1, items.length);
  const slot = W / n, bw = Math.min(34, slot * 0.6);
  const bars = items.map((it, i) => {
    const h = m ? Math.max(it.value > 0 ? 3 : 0, (it.value / m) * (H - top - bottom)) : 0;
    const x = i * slot + (slot - bw) / 2, y = H - bottom - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="7" fill="${it.color || color}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" class="cv">${it.value ? fmtNum(it.value, decimals) + unit : ''}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" class="cl">${esc(it.label)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" class="axis"/>${bars}</svg>`;
}

// Barras empilhadas 100%. items: [{label, parts:[{value,color}]}]
let clipSeq = 0;
export function stackChart(items, { height = 150 } = {}) {
  const cid = 'sc' + (++clipSeq);
  const W = 320, H = height, top = 8, bottom = 22;
  const n = Math.max(1, items.length);
  const slot = W / n, bw = Math.min(34, slot * 0.6);
  const out = items.map((it, i) => {
    const total = it.parts.reduce((a, p) => a + p.value, 0);
    const x = i * slot + (slot - bw) / 2;
    let y = H - bottom;
    const full = H - top - bottom;
    let rects = '';
    if (!total) rects = `<rect x="${x}" y="${top}" width="${bw}" height="${full}" rx="7" fill="var(--empty)"/>`;
    else it.parts.forEach(p => {
      const h = (p.value / total) * full;
      y -= h;
      if (h > 0) rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${p.color}"/>`;
    });
    return `<g clip-path="url(#${cid}_${i})"><clipPath id="${cid}_${i}"><rect x="${x}" y="${top}" width="${bw}" height="${full}" rx="7"/></clipPath>${rects}</g>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" class="cl">${esc(it.label)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
}

// Linha. points: [{label, value}] (value pode ser null)
export function lineChart(points, { height = 150, unit = '', decimals = 1, color = 'var(--lilac-d)' } = {}) {
  const W = 320, H = height, top = 22, bottom = 22, left = 14, right = 14;
  const vals = points.map(p => p.value).filter(v => v != null);
  if (!vals.length) return `<div class="empty-chart">Sem dados ainda</div>`;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const n = points.length;
  const X = i => left + (n === 1 ? (W - left - right) / 2 : (i * (W - left - right)) / (n - 1));
  const Y = v => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const pts = points.map((p, i) => (p.value == null ? null : [X(i), Y(p.value), p])).filter(Boolean);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#fff" stroke="${color}" stroke-width="2.5"/>
    <text x="${p[0].toFixed(1)}" y="${(p[1] - 9).toFixed(1)}" class="cv">${fmtNum(p[2].value, decimals)}${unit}</text>`).join('');
  const labels = points.map((p, i) => `<text x="${X(i).toFixed(1)}" y="${H - 6}" class="cl">${esc(p.label)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

// Anel de progresso
export function ring(p, { size = 120, stroke = 12, color = 'var(--sky-d)', label = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, p / 100));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--empty)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="${label ? size / 2 - 6 : size / 2 + 1}" class="ring-t">${p}%</text>
    ${label ? `<text x="50%" y="${size / 2 + 18}" class="ring-s">${esc(label)}</text>` : ''}
  </svg>`;
}

export function progressBar(p, color = 'var(--pink)') {
  return `<div class="pbar"><span style="width:${Math.max(0, Math.min(100, p))}%;background:${color}"></span></div>`;
}
