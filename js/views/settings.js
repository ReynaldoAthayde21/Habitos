// Ajustes: senha, backup manual (exportar/importar), armazenamento.
import { esc, todayKey, fmtNum } from '../util.js';
import { exportBackup, importBackup, storageEstimate, requestPersist } from '../store.js';
import lock from './lock.js';

let est = null;

export default {
  id: 'settings', tabId: 'ajustes', title: 'Ajustes', emoji: '⚙️', color: 'var(--gray)',
  render(ctx) {
    const s = ctx.state.settings;
    if (!est) storageEstimate().then(e => { est = e || {}; if (ctx.ui.tab === 'ajustes') ctx.render(); });
    return `<div class="card">
      <div class="card-h"><span class="ce">🔒</span><b>Senha</b><span class="pill ${s.pin ? 'ok' : ''}">${s.pin ? 'ativada' : 'desligada'}</span></div>
      <p class="small muted">Pede a senha ao abrir o app e quando ele volta do segundo plano.</p>
      ${s.pin ? `<div class="row-btns left wrap"><button class="btn small" data-act="settings:changepin">Trocar senha</button>
        <button class="btn small ghost danger" data-act="settings:removepin">Desligar senha</button></div>
        <label class="field inline"><span>Bloquear após sair do app</span>
        <select data-change="settings:lockafter">${[[0, 'na hora'], [30, '30 segundos'], [60, '1 minuto'], [300, '5 minutos']].map(([v, l]) =>
          `<option value="${v}" ${Number(s.lockAfterSec ?? 30) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`
        : `<button class="btn" data-act="settings:createpin">Criar senha</button>`}
      <p class="small muted">Se esquecer a senha, não há como recuperar sem apagar os dados do app. Guarde um backup.</p>
    </div>
    <div class="card">
      <div class="card-h"><span class="ce">💾</span><b>Backup</b></div>
      <p class="small muted">Seus dados ficam só neste aparelho. Faça backups de vez em quando e guarde o arquivo no app Arquivos. O backup inclui as fotos e não tem senha: guarde em lugar seguro.</p>
      ${s.lastBackup ? `<p class="small">Último backup: <b>${esc(s.lastBackup.split('-').reverse().join('/'))}</b></p>` : `<p class="small"><b>Nenhum backup feito ainda.</b></p>`}
      <div class="row-btns left wrap"><button class="btn" data-act="settings:export">Exportar backup</button>
      <button class="btn ghost" data-act="settings:import">Importar backup</button></div>
    </div>
    <div class="card soft">
      <div class="card-h"><span class="ce">📱</span><b>Armazenamento</b></div>
      <p class="small">${est && est.usage != null ? `Usando ${fmtNum(est.usage / 1048576, 1)} MB neste aparelho.` : 'Calculando…'}</p>
      <p class="small muted">Para não perder dados, use o app pelo ícone da Tela de Início (Safari › Compartilhar › Adicionar à Tela de Início).</p>
    </div>
    <p class="center small muted">Hábitos · feito com 💖 · sem conta, sem nuvem</p>`;
  },

  onboarding(ctx) {
    ctx.sheet(`<div class="center"><div class="big-emoji">🌸</div><h3>Bem-vinda ao Hábitos!</h3>
      <p class="small">Seus registros e fotos ficam só neste aparelho. Para proteger as fotos do corpo, crie uma senha de 4 números.</p></div>
      <div class="row-btns"><button class="btn ghost" data-act="settings:skipob">Depois</button><button class="btn" data-act="settings:obpin">Criar senha</button></div>`);
  },

  actions: {
    skipob(ctx) { ctx.state.settings.onboarded = true; ctx.closeSheet(); ctx.save(); },
    async obpin(ctx) {
      ctx.state.settings.onboarded = true; ctx.closeSheet();
      if (await lock.create(ctx)) ctx.toast('Senha criada 🔒');
      ctx.save();
    },
    async createpin(ctx) { if (await lock.create(ctx)) { ctx.toast('Senha criada 🔒'); ctx.save(); } },
    async changepin(ctx) {
      if (!(await lock.verify(ctx))) return;
      if (await lock.create(ctx)) { ctx.toast('Senha trocada'); ctx.save(); }
    },
    async removepin(ctx) {
      if (!(await lock.verify(ctx))) return;
      ctx.state.settings.pin = null; ctx.save(); ctx.toast('Senha desligada');
    },
    lockafter(ctx, el) { ctx.state.settings.lockAfterSec = Number(el.value); ctx.save(false); },
    async export(ctx) {
      ctx.toast('Preparando backup…');
      await ctx.flush();
      ctx.state.settings.lastBackup = todayKey();
      const json = await exportBackup(ctx.state);
      const name = `habitos-backup-${todayKey()}.json`;
      const file = new File([json], name, { type: 'application/json' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Backup do Hábitos' });
          ctx.save(); ctx.toast('Backup exportado 💾');
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') { ctx.state.settings.lastBackup = null; ctx.render(); return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      ctx.save(); ctx.toast('Backup exportado 💾');
    },
    async import(ctx) {
      const f = await ctx.pickFile('');
      if (!f) return;
      if (!(await ctx.confirm('Importar este backup? Todos os dados atuais deste aparelho serão substituídos pelos do arquivo.', { ok: 'Importar', danger: true }))) return;
      try {
        const st = await importBackup(await f.text());
        await ctx.replaceState(st);
        await requestPersist();
        ctx.toast('Backup importado ✨');
      } catch (e) {
        console.error(e);
        ctx.toast('Não consegui importar: ' + e.message);
      }
    },
  },
};
