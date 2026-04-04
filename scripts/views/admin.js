/**
 * views/admin.js — Painel administrativo
 *
 * Fluxo:
 *  1. onAuthStateChanged determina se exibe login ou dashboard.
 *  2. Login: email + senha via Firebase Auth Email/Password.
 *  3. Dashboard: lista todos os agendamentos com abas por status.
 *     Ações disponíveis por card:
 *       Pendente   → Confirmar | Rejeitar
 *       Confirmado → Cancelar
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

import { auth }                                              from '../firebase-config.js';
import {
  listarAgendamentos,
  confirmarAgendamento,
  rejeitarAgendamento,
  cancelarAgendamento,
  deletarAgendamento,
  obterConfigAgenda,
  salvarConfigAgenda,
}                                                            from '../data/firebase-repository.js';

/* ---- Helpers -------------------------------------------------------- */

const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const mesNome   = ['jan','fev','mar','abr','mai','jun',
                   'jul','ago','set','out','nov','dez'];

function formatarDataCurta(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${diaSemana[date.getDay()]}, ${d} ${mesNome[m - 1]}`;
}

/** Minutos → "1h", "45 min", "1h 30min" */
function _formatMin(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h)      return `${h}h`;
  return `${m} min`;
}

const LABEL_STATUS = {
  pending:   'Pendente',
  confirmed: 'Confirmado',
  rejected:  'Rejeitado',
  cancelled: 'Cancelado',
};

const COR_STATUS = {
  pending:   '#9e7c3f',
  confirmed: '#3b7a64',
  rejected:  '#c0392b',
  cancelled: '#888',
};

const NOME_DIA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const CONFIG_PADRAO = {
  diasAtivos:   [1, 2, 3, 4, 5],
  horaInicio:   '09:00',
  horaFim:      '18:00',
  almocoInicio: '12:00',
  almocoFim:    '13:00',
  intervalo:    15,
};

/* ---- Templates HTML ------------------------------------------------- */

function _htmlLogin(erroMsg = '') {
  return `
    <div class="container" style="max-width:420px;margin:0 auto;padding-top:3rem;">
      <div style="text-align:center;margin-bottom:2rem;">
        <div class="unit-avatar" aria-hidden="true"
             style="margin:0 auto .75rem;">RM</div>
        <h1 class="page-title" style="font-size:1.2rem;">Painel Administrativo</h1>
        <p class="page-sub">Raquel Maia Massoterapeuta</p>
      </div>

      <form id="form-login" novalidate>
        <div class="form-group">
          <label for="campo-email">E-mail</label>
          <input type="email" id="campo-email" name="email"
                 placeholder="admin@exemplo.com"
                 autocomplete="email" required />
        </div>
        <div class="form-group">
          <label for="campo-senha">Senha</label>
          <input type="password" id="campo-senha" name="senha"
                 placeholder="••••••••"
                 autocomplete="current-password" required />
        </div>

        ${erroMsg ? `
          <p role="alert" style="font-size:.85rem;color:var(--danger);
            background:#fff1f1;border:1px solid #f5c6c6;border-radius:.5rem;
            padding:.55rem .75rem;margin-bottom:.75rem;">${erroMsg}</p>` : ''}

        <button type="submit" id="btn-login"
                class="btn btn--primary btn--full btn--large">
          Entrar
        </button>
      </form>
    </div>`;
}

function _htmlDashboard(agendamentos, abaAtiva, secao, configAgenda, erroBookings) {
  const pendentes = agendamentos.filter(a => a.status === 'pending').length;

  return `
    <div class="container">
      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;justify-content:space-between;
                  flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem;">
        <div>
          <h1 class="page-title" style="font-size:1.2rem;margin-bottom:.15rem;">Painel Admin</h1>
          <p class="page-sub" style="margin:0;">Raquel Maia Massoterapeuta</p>
        </div>
        <div style=\"display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;\">\n
          <button id="nav-agendamentos"
                  class="admin-tab${secao === 'agendamentos' ? ' admin-tab--ativo' : ''}"
                  type="button">
            📋 Agenda
            ${pendentes > 0 ? `<span class="admin-badge">${pendentes}</span>` : ''}
          </button>
          <button id="nav-config"
                  class="admin-tab${secao === 'config' ? ' admin-tab--ativo' : ''}"
                  type="button">
            ⚙️ Config
          </button>
          <button id="btn-logout" class="btn btn--outline btn--sm" type="button">Sair</button>
        </div>
      </div>

      ${secao === 'agendamentos'
        ? _htmlAgendamentosSection(agendamentos, abaAtiva, erroBookings)
        : _htmlConfigSection(configAgenda)}
    </div>`;
}

function _htmlAgendamentosSection(agendamentos, abaAtiva, erroBookings) {
  // Banner de erro quando o Firebase negou a leitura
  if (erroBookings) {
    return `
      <div style="background:#fff8f0;border:1px solid #f5d6a6;border-radius:.6rem;
                  padding:.85rem 1rem;font-size:.85rem;color:#a0620a;line-height:1.5;">
        ⚠️ <strong>Erro ao carregar agendamentos</strong><br/>${erroBookings}
      </div>`;
  }
  const abas = [
    { key: 'pending',   label: 'Pendentes'   },
    { key: 'confirmed', label: 'Confirmados' },
    { key: 'rejected',  label: 'Rejeitados'  },
    { key: 'cancelled', label: 'Cancelados'  },
  ];
  const filtrados = agendamentos.filter(a => a.status === abaAtiva);
  const abasHTML = abas.map(a => {
    const count = agendamentos.filter(ag => ag.status === a.key).length;
    return `
      <button class="admin-tab${a.key === abaAtiva ? ' admin-tab--ativo' : ''}"
              data-aba="${a.key}" type="button">
        ${a.label}${count > 0 ? ` <span class="admin-badge">${count}</span>` : ''}
      </button>`;
  }).join('');
  const cardsHTML = filtrados.length === 0
    ? `<p style="color:var(--text-muted);font-size:.9rem;padding:1.25rem 0;">
         Nenhum agendamento nesta categoria.
       </p>`
    : filtrados.map(_htmlCard).join('');

  return `
    <div class="admin-tabs" role="tablist">${abasHTML}</div>
    <div id="admin-lista">${cardsHTML}</div>`;
}

function _htmlConfigSection(config) {
  const cfg = { ...CONFIG_PADRAO, ...(config || {}) };
  const diasAtivos = cfg.diasAtivos ?? [1, 2, 3, 4, 5];

  const diasHTML = NOME_DIA.map((nome, idx) => `
    <label class="dia-check">
      <input type="checkbox" name="dias" value="${idx}"
             ${diasAtivos.includes(idx) ? 'checked' : ''} />
      <span>${nome}</span>
    </label>`).join('');

  return `
    <form id="form-config" novalidate>

      <!-- Dias -->
      <div class="cfg-section">
        <p class="cfg-section-title">&#x1F4C5; Dias de atendimento</p>
        <div style="display:flex;flex-wrap:wrap;gap:.45rem;">${diasHTML}</div>
      </div>

      <!-- Horários -->
      <div class="cfg-section">
        <p class="cfg-section-title">&#x1F550; Horário de trabalho</p>

        <p class="cfg-row-label">Expediente</p>
        <div class="cfg-pair" style="margin-bottom:1rem;">
          <span class="cfg-pair-de">Das</span>
          <input type="time" id="cf-ini" name="horaInicio"
                 class="cfg-time" value="${cfg.horaInicio}" />
          <span class="cfg-pair-sep">às</span>
          <input type="time" id="cf-fim" name="horaFim"
                 class="cfg-time" value="${cfg.horaFim}" />
        </div>

        <p class="cfg-row-label">Interrupção (almoço)</p>
        <div class="cfg-pair">
          <span class="cfg-pair-de">Das</span>
          <input type="time" id="cf-alm-ini" name="almocoInicio"
                 class="cfg-time" value="${cfg.almocoInicio}" />
          <span class="cfg-pair-sep">às</span>
          <input type="time" id="cf-alm-fim" name="almocoFim"
                 class="cfg-time" value="${cfg.almocoFim}" />
        </div>
      </div>

      <!-- Intervalo -->
      <div class="cfg-section">
        <p class="cfg-section-title">&#x23F1; Intervalo entre sessões</p>
        <select id="cf-intervalo" name="intervalo" class="cfg-select">
          <option value="0"${cfg.intervalo === 0  ? ' selected' : ''}>Sem intervalo (sessões consecutivas)</option>
          ${[15,30,45,60].map(v =>
            `<option value="${v}"${cfg.intervalo === v ? ' selected' : ''}>${v} min de intervalo</option>`
          ).join('')}
        </select>
      </div>

      <p id="cfg-msg" role="alert" style="display:none;font-size:.85rem;padding:.5rem .75rem;
         border-radius:.5rem;margin-bottom:.75rem;"></p>

      <button type="submit" id="btn-salvar-config" class="btn btn--primary btn--full">
        Salvar configurações de agenda
      </button>
    </form>`;
}

function _htmlCard(a) {
  const cor   = COR_STATUS[a.status]   || '#888';
  const label = LABEL_STATUS[a.status] || a.status;

  const acoesHTML = (() => {
    if (a.status === 'pending') return `
      <div class="admin-card-acoes">
        <button class="btn btn--primary btn--sm admin-acao"
                data-id="${a.id}" data-acao="confirmar" type="button">
          Confirmar
        </button>
        <button class="btn btn--outline btn--sm admin-acao"
                data-id="${a.id}" data-acao="rejeitar" type="button"
                style="color:var(--danger);border-color:var(--danger);">
          Rejeitar
        </button>
      </div>`;
    if (a.status === 'confirmed') return `
      <div class="admin-card-acoes">
        <button class="btn btn--outline btn--sm admin-acao"
                data-id="${a.id}" data-acao="cancelar" type="button"
                style="color:var(--danger);border-color:var(--danger);">
          Cancelar
        </button>
      </div>`;
    if (a.status === 'rejected') return `
      <div class="admin-card-acoes">
        <button class="btn btn--outline btn--sm admin-acao"
                data-id="${a.id}" data-acao="deletar" type="button"
                style="color:var(--danger);border-color:var(--danger);">
          🗑 Excluir
        </button>
      </div>`;
    return '';
  })();

  return `
    <div class="admin-card" data-booking-id="${a.id}">
      <div class="admin-card-header">
        <span class="admin-card-servico">${a.servicoNome || '—'}</span>
        <span class="admin-card-status" style="color:${cor};">${label}</span>
      </div>
      <div class="admin-card-info">
        <span>📅 ${a.dataSelecionada ? formatarDataCurta(a.dataSelecionada) : '—'}</span>
        <span>🕘 ${a.horaSelecionada || '—'}${a.horaFim ? `&nbsp;→&nbsp;${a.horaFim}` : ''}${a.duracao ? ` (${_formatMin(a.duracao)})` : ''}</span>
      </div>
      <div class="admin-card-info" style="margin-top:.25rem;">
        <span>👤 ${a.nomeCliente || '—'}</span>
        <span>📱 ${a.telefoneCliente || '—'}</span>
      </div>
      ${acoesHTML}
    </div>`;
}

/* ---- Render --------------------------------------------------------- */

export function render() {
  return `
    <div class="container" style="padding-top:4rem;text-align:center;">
      <p style="color:var(--text-muted);">Carregando painel…</p>
    </div>`;
}

/* ---- Mount ---------------------------------------------------------- */

export function mount(container) {
  let agendamentos = [];
  let abaAtiva     = 'pending';
  let secao        = 'agendamentos';
  let configAgenda = null;
  let erroBookings = null;   // null = ok, string = mensagem de erro
  let unsubAuth    = null;

  unsubAuth = onAuthStateChanged(auth, async user => {
    if (!user) _renderLogin();
    else       await _carregarEExibir();
  });

  container.addEventListener('viewdestroy', () => { if (unsubAuth) unsubAuth(); });

  /* ------------------------------------------------------------------ */

  function _renderLogin(erroMsg = '') {
    container.innerHTML = _htmlLogin(erroMsg);
    const form     = container.querySelector('#form-login');
    const btnLogin = container.querySelector('#btn-login');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      btnLogin.disabled    = true;
      btnLogin.textContent = 'Entrando…';
      try {
        const email = container.querySelector('#campo-email').value.trim();
        const senha = container.querySelector('#campo-senha').value;
        await signInWithEmailAndPassword(auth, email, senha);
      } catch (err) {
        _renderLogin(_traduzirErroAuth(err.code));
      }
    });
  }

  async function _carregarEExibir() {
    container.innerHTML = `<div class="container" style="padding-top:3rem;text-align:center;"><p style="color:var(--text-muted);">Carregando…</p></div>`;

    // Carrega agendamentos e config de forma independente:
    // uma falha em um não derruba o outro.
    try {
      agendamentos = await listarAgendamentos();
      erroBookings = null;
    } catch (err) {
      console.error('[admin] Erro ao listar agendamentos:', err);
      agendamentos  = [];
      erroBookings  = `Não foi possível carregar os agendamentos. Verifique as regras do Firebase RTDB (bookings: .read auth!=null) e recarregue a página. Detalhe: ${err.message}`;
    }

    try { configAgenda = await obterConfigAgenda('raquel'); }
    catch (err) { console.error('[admin] Erro ao carregar config:', err); configAgenda = null; }

    _renderDashboard();
  }

  function _renderDashboard() {
    container.innerHTML = _htmlDashboard(agendamentos, abaAtiva, secao, configAgenda, erroBookings);
    _bindDashboard();
  }

  function _bindDashboard() {
    container.querySelector('#btn-logout')?.addEventListener('click', () => signOut(auth));

    container.querySelector('#nav-agendamentos')?.addEventListener('click', () => {
      secao = 'agendamentos'; _renderDashboard();
    });
    container.querySelector('#nav-config')?.addEventListener('click', () => {
      secao = 'config'; _renderDashboard();
    });

    if (secao === 'agendamentos') {
      container.querySelectorAll('[data-aba]').forEach(btn => {
        btn.addEventListener('click', () => { abaAtiva = btn.dataset.aba; _renderDashboard(); });
      });
      container.querySelectorAll('.admin-acao').forEach(btn => {
        btn.addEventListener('click', async () => {
          const { id, acao } = btn.dataset;
          const card = btn.closest('.admin-card');
          card.querySelectorAll('button').forEach(b => { b.disabled = true; });
          try {
            if (acao === 'confirmar') await confirmarAgendamento(id);
            if (acao === 'rejeitar')  await rejeitarAgendamento(id);
            if (acao === 'cancelar')  await cancelarAgendamento(id);
            if (acao === 'deletar')   await deletarAgendamento(id);
            agendamentos = await listarAgendamentos();
            erroBookings = null;
            _renderDashboard();
          } catch (err) {
            console.error('[admin] Erro na ação:', err);
            card.querySelectorAll('button').forEach(b => { b.disabled = false; });
            alert('Erro ao processar ação. Tente novamente.');
          }
        });
      });
    }

    if (secao === 'config') {
      const form      = container.querySelector('#form-config');
      const msgEl     = container.querySelector('#cfg-msg');
      const btnSalvar = container.querySelector('#btn-salvar-config');

      form?.addEventListener('submit', async e => {
        e.preventDefault();
        const diasAtivos = [...form.querySelectorAll('[name="dias"]:checked')]
          .map(cb => Number(cb.value));

        if (diasAtivos.length === 0) {
          _mostrarMsg(msgEl, 'Selecione ao menos um dia de atendimento.', 'danger');
          return;
        }

        const novaConfig = {
          diasAtivos,
          horaInicio:   form.querySelector('[name="horaInicio"]').value,
          horaFim:      form.querySelector('[name="horaFim"]').value,
          almocoInicio: form.querySelector('[name="almocoInicio"]').value,
          almocoFim:    form.querySelector('[name="almocoFim"]').value,
          intervalo:    Number(form.querySelector('[name="intervalo"]').value),
        };

        btnSalvar.disabled    = true;
        btnSalvar.textContent = 'Salvando…';
        try {
          await salvarConfigAgenda('raquel', novaConfig);
          configAgenda = novaConfig;
          _mostrarMsg(msgEl, '✅ Configurações salvas!', 'success');
        } catch (err) {
          console.error('[admin] Erro ao salvar config:', err);
          _mostrarMsg(msgEl, 'Erro ao salvar. Tente novamente.', 'danger');
        } finally {
          btnSalvar.disabled    = false;
          btnSalvar.textContent = 'Salvar configurações de agenda';
        }
      });
    }
  }

  function _mostrarMsg(el, texto, tipo) {
    el.textContent          = texto;
    el.style.display        = 'block';
    el.style.background     = tipo === 'success' ? '#eaf4ee' : '#fff8f8';
    el.style.border         = `1px solid ${tipo === 'success' ? '#b2d8c4' : '#f5c6c6'}`;
    el.style.color          = tipo === 'success' ? 'var(--success)' : 'var(--danger)';
    if (tipo === 'success') setTimeout(() => { el.style.display = 'none'; }, 3500);
  }
}

/* ---- Helper de auth ----------------------------------------------- */

function _traduzirErroAuth(code) {
  const erros = {
    'auth/invalid-credential':     'E-mail ou senha incorretos.',
    'auth/invalid-email':          'E-mail inválido.',
    'auth/user-not-found':         'Usuário não encontrado.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  };
  return erros[code] || `Erro de autenticação (${code}).`;
}

