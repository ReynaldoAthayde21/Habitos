// Lê o texto de um PDF (no próprio aparelho) e monta um rascunho do plano.
// Formato do rascunho (editável pela usuária):
//   # Nome da refeição
//   - opção principal
//   + acompanhamento

export async function pdfToLines(blob) {
  const pdfjs = await import('../vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // agrupa itens pela linha (coordenada y)
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      let row = rows.find(r => Math.abs(r.y - y) <= 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      const text = r.items.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
  }
  return lines;
}

const MEAL_RE = /(caf[ée] da manh[ãa]|desjejum|cola[çc][ãa]o|lanche|almo[çc]o|jantar|ceia|pr[ée][- ]?treino|p[óo]s[- ]?treino|refei[çc][ãa]o\s*\d+|merenda)/i;

export function linesToDraft(lines) {
  const out = [];
  let inMeal = false;
  for (let raw of lines) {
    let l = raw.replace(/ /g, ' ').trim();
    if (!l) continue;
    if (/^(p[áa]gina|page)\s*\d+/i.test(l)) continue;
    const clean = l.replace(/^[\d\s:h.()-]+(?=[A-Za-zÀ-ú])/, '').replace(/[:–-]\s*$/, '').trim();
    if (MEAL_RE.test(l) && l.length <= 60 && !/^[-•*+]/.test(l)) {
      const name = clean.replace(/\(?\d{1,2}[:h]\d{0,2}\)?/g, '').replace(/\s{2,}/g, ' ').replace(/[:\-–]\s*$/, '').trim();
      const nice = name === name.toUpperCase() ? name.toLowerCase() : name;
      out.push('', '# ' + (nice.charAt(0).toUpperCase() + nice.slice(1)));
      inMeal = true;
      continue;
    }
    if (!inMeal) continue;
    let kind = '-';
    if (/^\+/.test(l) || /acompanha|complemento/i.test(l)) kind = '+';
    l = l.replace(/^[-•*+–▪●◦]\s*/, '').replace(/^(op[çc][ãa]o|op\.?)\s*\d+\s*[:.)-]?\s*/i, '').replace(/^(acompanhamentos?|complementos?)\s*[:\-–]\s*/i, '').trim();
    if (!l) continue;
    // continuação de linha quebrada (começa com minúscula)
    const prev = out[out.length - 1];
    if (/^[a-zà-ú(]/.test(l) && prev && /^[-+] /.test(prev) && !/^[-•*+–]/.test(raw.trim())) {
      out[out.length - 1] = prev + ' ' + l;
      continue;
    }
    out.push(`${kind} ${l}`);
  }
  return out.join('\n').trim();
}

export function parseDraft(text) {
  const meals = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith('#')) { cur = { name: l.replace(/^#+\s*/, ''), options: [] }; meals.push(cur); continue; }
    if (!cur) { cur = { name: 'Refeição', options: [] }; meals.push(cur); }
    const kind = l.startsWith('+') ? 'acomp' : 'principal';
    const name = l.replace(/^[-+•*]\s*/, '').trim();
    if (name) cur.options.push({ name, kind });
  }
  return meals.filter(m => m.name);
}
