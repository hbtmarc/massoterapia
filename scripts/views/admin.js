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

const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const mesNome   = ['janeiro','fevereiro','março','abril','maio','junho',
                   'julho','agosto','setembro','outubro','novembro','dezembro'];

const diaSemana2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const mesNome2   = ['jan','fev','mar','abr','mai','jun',
                    'jul','ago','set','out','nov','dez'];

function formatarDataCurta(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${diaSemana2[date.getDay()]}, ${d} ${mesNome2[m - 1]}`;
}

function formatarDataBR(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${diaSemana[date.getDay()]}, ${d} de ${mesNome[m - 1]} de ${y}`;
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

/** Monta o link wa.me com mensagem personalizada por status */
function _waConfirmLink(b, status) {
  const digits = (b.telefoneCliente || '').replace(/\D/g, '');
  if (!digits) return null;
  const waNum  = digits.startsWith('55') ? digits : '55' + digits;
  const nome   = b.nomeCliente || 'cliente';
  const data   = b.dataSelecionada ? formatarDataBR(b.dataSelecionada) : '—';
  const hora   = b.horaSelecionada || '—';
  const fim    = b.horaFim  ? ` até ${b.horaFim}` : '';
  const dur    = b.duracao  ? ` (${_formatMin(b.duracao)})` : '';
  const servico = b.servicoNome || '—';

  const st = status ?? b.status ?? 'confirmed';

  let texto;
  if (st === 'confirmed') {
    texto =
      `Olá, ${nome}! 🎉 Seu agendamento está confirmado!\n\n` +
      `✅ Serviço: ${servico}\n` +
      `📅 Data: ${data}\n` +
      `🕘 Horário: ${hora}${fim}${dur}\n\n` +
      `Lembre-se de chegar com alguns minutinhos de antecedência. Qualquer dúvida, pode me chamar aqui! 💚\n— Raquel`;
  } else if (st === 'pending') {
    texto =
      `Olá, ${nome}! Recebemos a sua solicitação de agendamento 🙌\n\n` +
      `📋 Serviço: ${servico}\n` +
      `📅 Data: ${data}\n` +
      `🕘 Horário: ${hora}${fim}${dur}\n\n` +
      `Vou analisar e em breve confirmo! Qualquer dúvida, é só me chamar. 😊\n— Raquel`;
  } else if (st === 'cancelled') {
    texto =
      `Olá, ${nome}. Informamos que o seu agendamento foi cancelado.\n\n` +
      `❌ Serviço: ${servico}\n` +
      `📅 Data: ${data}\n` +
      `🕘 Horário: ${hora}${fim}${dur}\n\n` +
      `Lamentamos o inconveniente. Entre em contato para reagendarmos! 💚\n— Raquel`;
  } else if (st === 'rejected') {
    texto =
      `Olá, ${nome}. Infelizmente não conseguimos encaixar o seu pedido de agendamento no momento.\n\n` +
      `📋 Serviço: ${servico}\n` +
      `📅 Data solicitada: ${data}\n` +
      `🕘 Horário solicitado: ${hora}${dur}\n\n` +
      `Por favor, entre em contato para verificarmos uma nova data disponível. 💚\n— Raquel`;
  } else {
    texto = `Olá, ${nome}! Entre em contato para mais informações sobre seu agendamento.\n— Raquel`;
  }

  return `https://wa.me/${waNum}?text=${encodeURIComponent(texto)}`;
}

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

  let conteudoHTML;
  if (filtrados.length === 0) {
    conteudoHTML = `<p style="color:var(--text-muted);font-size:.9rem;padding:1.25rem 0;">
      Nenhum agendamento nesta categoria.
    </p>`;
  } else if (abaAtiva === 'confirmed') {
    conteudoHTML = _htmlAgendaConfirmados(filtrados);
  } else {
    conteudoHTML = filtrados.map(_htmlCard).join('');
  }

  return `
    <div class="admin-tabs" role="tablist">${abasHTML}</div>
    <div id="admin-lista">${conteudoHTML}</div>`;
}

/* Agenda inteligente para confirmados — agrupada por dia */
function _htmlAgendaConfirmados(confirmados) {
  const sorted = [...confirmados].sort((a, b) => {
    const d = (a.dataSelecionada || '').localeCompare(b.dataSelecionada || '');
    return d !== 0 ? d : (a.horaSelecionada || '').localeCompare(b.horaSelecionada || '');
  });

  const porDia = {};
  for (const b of sorted) {
    const key = b.dataSelecionada || 'sem-data';
    (porDia[key] = porDia[key] || []).push(b);
  }

  return Object.entries(porDia).map(([data, bookings]) => {
    const dataFmt = data !== 'sem-data' ? formatarDataCurta(data) : 'Data não definida';
    const total   = bookings.length;

    const itens = bookings.map(b => {
      const waLink = _waConfirmLink(b);

      return `
        <div class="aag-item">
          <div class="aag-time">
            <span class="aag-hora">${b.horaSelecionada || '--:--'}</span>
            ${b.horaFim ? `<span class="aag-seta">→</span><span class="aag-hora-fim">${b.horaFim}</span>` : ''}
            ${b.duracao ? `<span class="aag-dur">${_formatMin(b.duracao)}</span>` : ''}
          </div>
          <div class="aag-detail">
            <div class="aag-servico">${b.servicoNome || '—'}</div>
            <div class="aag-cliente">
              <span>👤 ${b.nomeCliente || '—'}</span>
              ${waLink
                ? `<a class="admin-wa-link" href="${waLink}" target="_blank" rel="noopener">📱 ${b.telefoneCliente} <span class="admin-wa-badge">WA ↗</span></a>`
                : (b.telefoneCliente ? `<span>📱 ${b.telefoneCliente}</span>` : '')}
            </div>
          </div>
          <div style="display:flex;gap:.4rem;align-items:center;">
            <button class="btn btn--outline btn--sm admin-acao aag-cancel-btn"
                    data-id="${b.id}" data-acao="cancelar" type="button">
              Cancelar
            </button>
            <button class="btn btn--ghost btn--sm admin-acao"
                    data-id="${b.id}" data-acao="deletar" type="button"
                    title="Excluir permanentemente">
              🗑
            </button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="aag-day">
        <div class="aag-day-hdr">
          <span class="aag-day-label">📅 ${dataFmt}</span>
          <span class="aag-day-count">${total} sessão${total !== 1 ? 'ões' : ''}</span>
        </div>
        <div class="aag-items">${itens}</div>
      </div>`;
  }).join('');
}

function _htmlConfigSection(config) {
  const cfg = { ...CONFIG_PADRAO, ...(config || {}) };
  const diasAtivos    = cfg.diasAtivos ?? [1, 2, 3, 4, 5];
  const horariosPorDia = cfg.horariosPorDia ?? {};

  const diasHTML = NOME_DIA.map((nome, idx) => `
    <label class="dia-check">
      <input type="checkbox" name="dias" value="${idx}"
             ${diasAtivos.includes(idx) ? 'checked' : ''} />
      <span>${nome}</span>
    </label>`).join('');

  /* Seção de exceções por dia — só mostra dias que estão ativos */
  const excecoesDiasHTML = NOME_DIA.map((nome, idx) => {
    const ovr = horariosPorDia[idx] ?? {};
    const ativo = diasAtivos.includes(idx);
    if (!ativo) return `<div class="cfg-day-row cfg-day-row--inactive" data-weekday="${idx}" hidden></div>`;
    const hasOvr = ovr.horaInicio || ovr.horaFim;
    return `
      <div class="cfg-day-row" data-weekday="${idx}">
        <label class="cfg-day-toggle">
          <input type="checkbox" class="dia-override-check" data-dia="${idx}"
                 name="dia-override-${idx}" ${hasOvr ? 'checked' : ''} />
          <span class="cfg-day-name">${nome}</span>
          <span class="cfg-day-default">${hasOvr ? '' : 'Usa horário padrão'}</span>
        </label>
        <div class="cfg-day-times" ${hasOvr ? '' : 'hidden'}>
          <div class="cfg-pair cfg-pair--sm">
            <span class="cfg-pair-de">Das</span>
            <input type="time" class="cfg-time" name="dia-ini-${idx}"
                   value="${ovr.horaInicio ?? cfg.horaInicio}" />
            <span class="cfg-pair-sep">às</span>
            <input type="time" class="cfg-time" name="dia-fim-${idx}"
                   value="${ovr.horaFim ?? cfg.horaFim}" />
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <form id="form-config" novalidate>

      <!-- Dias -->
      <div class="cfg-section">
        <p class="cfg-section-title">&#x1F4C5; Dias de atendimento</p>
        <div style="display:flex;flex-wrap:wrap;gap:.45rem;">${diasHTML}</div>
      </div>

      <!-- Horários padrão -->
      <div class="cfg-section">
        <p class="cfg-section-title">&#x1F550; Horário padrão de trabalho</p>

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

      <!-- Exceções por dia -->
      <div class="cfg-section">
        <p class="cfg-section-title">&#x1F4CC; Exceções por dia</p>
        <p class="cfg-row-label" style="margin-bottom:.75rem;">
          Personalize o horário de dias específicos (ex.: quarta até 21h)
        </p>
        <div id="cfg-excecoes">${excecoesDiasHTML}</div>
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

  // WhatsApp link
  const waLink = _waConfirmLink(a);

  const dataFmt = a.dataSelecionada ? formatarDataCurta(a.dataSelecionada) : '—';

  const _btnExcluir = `
        <button class="btn btn--ghost btn--sm admin-acao"
                data-id="${a.id}" data-acao="deletar" type="button"
                title="Excluir permanentemente">
          🗑
        </button>`;

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
        ${_btnExcluir}
      </div>`;
    if (a.status === 'confirmed') return `
      <div class="admin-card-acoes">
        <button class="btn btn--outline btn--sm admin-acao"
                data-id="${a.id}" data-acao="cancelar" type="button"
                style="color:var(--danger);border-color:var(--danger);">
          Cancelar
        </button>
        ${_btnExcluir}
      </div>`;
    if (a.status === 'rejected' || a.status === 'cancelled') return `
      <div class="admin-card-acoes">
        ${_btnExcluir}
      </div>`;
    return '';
  })();

  return `
    <div class="admin-card" data-booking-id="${a.id}">
      <div class="admin-card-accent" style="background:${cor};"></div>
      <div class="admin-card-inner">
        <div class="admin-card-header">
          <div style="flex:1;min-width:0;">
            <span class="admin-card-servico">${a.servicoNome || '—'}</span>
            ${a.duracao ? `<span class="admin-card-dur">${_formatMin(a.duracao)}</span>` : ''}
          </div>
          <span class="admin-card-pill" style="background:${cor}20;color:${cor};">${label}</span>
        </div>
        <div class="admin-card-meta">
          <div class="admin-card-meta-row">
            <span class="acm-ic">📅</span>
            <span class="acm-lbl">Data</span>
            <span class="acm-val">${dataFmt}</span>
          </div>
          <div class="admin-card-meta-row">
            <span class="acm-ic">🕘</span>
            <span class="acm-lbl">Horário</span>
            <span class="acm-val">${a.horaSelecionada || '—'}${a.horaFim ? ` → ${a.horaFim}` : ''}${a.duracao ? ` <em>(${_formatMin(a.duracao)})</em>` : ''}</span>
          </div>
          <div class="admin-card-meta-row">
            <span class="acm-ic">👤</span>
            <span class="acm-lbl">Cliente</span>
            <span class="acm-val"><strong>${a.nomeCliente || '—'}</strong></span>
          </div>
          <div class="admin-card-meta-row">
            <span class="acm-ic">📱</span>
            <span class="acm-lbl">Contato</span>
            <span class="acm-val">${waLink
              ? `<a class="admin-wa-link" href="${waLink}" target="_blank" rel="noopener noreferrer">${a.telefoneCliente} <span class="admin-wa-badge">WhatsApp ↗</span></a>`
              : (a.telefoneCliente || '—')}</span>
          </div>
        </div>
        ${acoesHTML}
      </div>
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
          const card = btn.closest('.admin-card') ?? btn.closest('.aag-item');
          card?.querySelectorAll('button').forEach(b => { b.disabled = true; });
          try {
            if (acao === 'confirmar') {
              await confirmarAgendamento(id);
              // Encontra o booking para montar o link de resposta ao cliente
              const booking = agendamentos.find(a => a.id === id);
              if (booking) _mostrarModalWA(container, booking);
            }
            if (acao === 'rejeitar')  await rejeitarAgendamento(id);
            if (acao === 'cancelar')  await cancelarAgendamento(id);
            if (acao === 'deletar')   await deletarAgendamento(id);
            agendamentos = await listarAgendamentos();
            erroBookings = null;
            _renderDashboard();
          } catch (err) {
            console.error('[admin] Erro na ação:', err);
            card?.querySelectorAll('button').forEach(b => { b.disabled = false; });
            alert('Erro ao processar ação. Tente novamente.');
          }
        });
      });
    }

    if (secao === 'config') {
      const form      = container.querySelector('#form-config');
      const msgEl     = container.querySelector('#cfg-msg');
      const btnSalvar = container.querySelector('#btn-salvar-config');

      // Toggles de exceção por dia: mostrar/ocultar inputs de horário
      form?.querySelectorAll('.dia-override-check').forEach(cb => {
        cb.addEventListener('change', () => {
          const row = cb.closest('.cfg-day-row');
          const times = row?.querySelector('.cfg-day-times');
          const lbl   = row?.querySelector('.cfg-day-default');
          if (!times) return;
          times.hidden = !cb.checked;
          if (lbl) lbl.textContent = cb.checked ? '' : 'Usa horário padrão';
        });
      });

      // Quando altera os dias ativos, mostra/oculta as linhas de exceção
      form?.querySelectorAll('[name="dias"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const idx = Number(cb.value);
          const row = form.querySelector(`.cfg-day-row[data-weekday="${idx}"]`);
          if (row) row.hidden = !cb.checked;
        });
      });

      form?.addEventListener('submit', async e => {
        e.preventDefault();
        const diasAtivos = [...form.querySelectorAll('[name="dias"]:checked')]
          .map(cb => Number(cb.value));

        if (diasAtivos.length === 0) {
          _mostrarMsg(msgEl, 'Selecione ao menos um dia de atendimento.', 'danger');
          return;
        }

        // Coleta exceções por dia
        const horariosPorDia = {};
        diasAtivos.forEach(idx => {
          const ovrCb = form.querySelector(`[name="dia-override-${idx}"]`);
          if (ovrCb?.checked) {
            const ini = form.querySelector(`[name="dia-ini-${idx}"]`)?.value;
            const fim = form.querySelector(`[name="dia-fim-${idx}"]`)?.value;
            if (ini && fim) horariosPorDia[idx] = { horaInicio: ini, horaFim: fim };
          }
        });

        const novaConfig = {
          diasAtivos,
          horaInicio:      form.querySelector('[name="horaInicio"]').value,
          horaFim:         form.querySelector('[name="horaFim"]').value,
          almocoInicio:    form.querySelector('[name="almocoInicio"]').value,
          almocoFim:       form.querySelector('[name="almocoFim"]').value,
          intervalo:       Number(form.querySelector('[name="intervalo"]').value),
          horariosPorDia,
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

  function _mostrarModalWA(container, booking) {
    const digits = (booking.telefoneCliente || '').replace(/\D/g, '');
    if (!digits) return;   // sem telefone, não exibe

    const waNum      = digits.startsWith('55') ? digits : '55' + digits;
    const dataFmt    = booking.dataSelecionada ? formatarDataBR(booking.dataSelecionada) : '—';
    const horaFmt    = booking.horaSelecionada || '—';
    const horaFimFmt = booking.horaFim ? ` – ${booking.horaFim}` : '';
    const nome       = booking.nomeCliente || 'cliente';

    const msg = encodeURIComponent(
      `Olá, ${nome}! 🎉 Seu agendamento foi confirmado!\n\n` +
      `✅ Serviço: ${booking.servicoNome || '—'}\n` +
      `📅 Data: ${dataFmt}\n` +
      `🕘 Horário: ${horaFmt}${horaFimFmt}\n\n` +
      `Aguardo você com prazer! 💚\n— Raquel`
    );
    const waLink = `https://wa.me/${waNum}?text=${msg}`;

    // Remove modal anterior se existir
    container.querySelector('.admin-wa-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'admin-wa-modal';
    modal.innerHTML = `
      <div class="admin-wa-modal-inner">
        <p class="admin-wa-modal-title">✅ Agendamento confirmado!</p>
        <p class="admin-wa-modal-sub">
          Clique abaixo para enviar a confirmação para <strong>${nome}</strong>:
        </p>
        <a class="btn btn--whatsapp btn--full" href="${waLink}"
           target="_blank" rel="noopener noreferrer">
          💬 Avisar ${nome} pelo WhatsApp
        </a>
        <button class="btn btn--outline btn--full btn--sm" id="admin-wa-modal-close"
                type="button" style="margin-top:.5rem;">
          Fechar
        </button>
      </div>`;
    container.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('admin-wa-modal--show'));
    modal.querySelector('#admin-wa-modal-close').addEventListener('click', () => {
      modal.classList.remove('admin-wa-modal--show');
      setTimeout(() => modal.remove(), 250);
    });
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

