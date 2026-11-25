// Bloqueio por senha numérica (4 dígitos). A senha é guardada como hash, nunca em texto.
import { sha256 } from '../util.js';

let mode = null; // 'unlock' | 'create' | 'confirm'
let buf = '', first = '', onDone = null, ctxRef = null;

function salt() { return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join(''); }

function draw(msg = '', err = false) {
  const el = document.getElementById('lock');
  const titles = { unlock: 'Digite sua senha', verify: 'Digite a senha atual', create: 'Crie uma senha de 4 números', confirm: 'Repita a senha' };
  el.innerHTML = `<div class="lock-inner ${err ? 'shake' : ''}">
    <div class="lock-logo">🌸</div><h2>Hábitos</h2>
    <p>${titles[mode]}</p>
    <div class="pin-dots">${[0, 1, 2, 3].map(i => `<i class="${i < buf.length ? 'on' : ''}"></i>`).join('')}</div>
    <p class="lock-msg ${err ? 'err' : ''}">${msg || '&nbsp;'}</p>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
      ${mode === 'unlock' ? '<span></span>' : '<button data-k="x" class="txt">Cancelar</button>'}<button data-k="0">0</button><button data-k="del" class="txt" aria-label="Apagar">⌫</button></div>
  </div>`;
}

async function press(k) {
  if (k === 'del') { buf = buf.slice(0, -1); draw(); return; }
  if (k === 'x') { hide(); onDone && onDone(false); return; }
  if (buf.length >= 4) return;
  buf += k; draw();
  if (buf.length < 4) return;
  const s = ctxRef.state.settings;
  if (mode === 'unlock' || mode === 'verify') {
    const h = await sha256(s.pin.salt + buf);
    if (h === s.pin.hash) { hide(); onDone && onDone(true); }
    else { buf = ''; setTimeout(() => draw('Senha incorreta', true), 120); }
  } else if (mode === 'create') {
    first = buf; buf = ''; mode = 'confirm'; setTimeout(() => draw(), 120);
  } else if (mode === 'confirm') {
    if (buf !== first) { buf = ''; first = ''; mode = 'create'; setTimeout(() => draw('As senhas não conferem, tente de novo', true), 120); return; }
    const sl = salt();
    s.pin = { salt: sl, hash: await sha256(sl + buf) };
    await ctxRef.flush();
    hide(); onDone && onDone(true);
  }
}

function open(ctx, m, cb) {
  ctxRef = ctx; mode = m; buf = ''; first = ''; onDone = cb;
  const el = document.getElementById('lock');
  draw();
  el.classList.add('open');
  document.body.classList.add('locked');
}
function hide() {
  const el = document.getElementById('lock');
  el.classList.remove('open');
  document.body.classList.remove('locked');
  el.innerHTML = '';
}

document.addEventListener('click', e => {
  const b = e.target.closest('#lock [data-k]');
  if (b) { e.preventDefault(); press(b.dataset.k); }
});
document.addEventListener('keydown', e => {
  if (!document.getElementById('lock')?.classList.contains('open')) return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
});

export default {
  id: 'lock', title: 'Bloqueio', emoji: '🔒', color: 'var(--pink)',
  render: () => '',
  show(ctx) { if (!document.getElementById('lock').classList.contains('open')) open(ctx, 'unlock', () => ctx.render()); },
  create(ctx) { return new Promise(res => open(ctx, 'create', res)); },
  verify(ctx) { return new Promise(res => open(ctx, 'verify', res)); },
};
