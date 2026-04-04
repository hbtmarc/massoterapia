/**
 * views/sucesso.js — Confirmação de agendamento realizado
 *
 * Lê os dados do state, exibe o comprovante e limpa o state.
 *
 * TODO (Firebase): exibir o ID do agendamento gerado pelo RTDB
 *       (ex: número de protocolo) quando a integração estiver ativa.
 */

import { getState, clearState } from '../state.js';
import { negocio }              from '../data/mock-repository.js';

/* ---- Helpers ---------------------------------------------------------------- */

const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const mesNome   = ['janeiro','fevereiro','março','abril','maio','junho',
                   'julho','agosto','setembro','outubro','novembro','dezembro'];

function formatarDataBR(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${diaSemana[date.getDay()]}, ${d} de ${mesNome[m - 1]} de ${y}`;
}

function formatarPreco(s) {
  if (s.precoTexto) return s.precoTexto;
  if (s.preco !== null && s.preco !== undefined)
    return s.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return 'A combinar';
}

function formatarDuracao(min) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/* ---- Render ----------------------------------------------------------------- */

export function render() {
  const estado = getState();
  const { servicoSelecionado, dataSelecionada, horaSelecionada,
          nomeCliente, unidadeSlug }  = estado;

  if (!servicoSelecionado || !dataSelecionada || !horaSelecionada) {
    return `
      <div class="container">
        <div class="empty-state" style="padding:3rem 0;">
          <p>Nenhum agendamento ativo para exibir.</p>
          <a href="#/inicio" class="btn btn--primary" style="margin-top:1rem;display:inline-flex;">
            Fazer um agendamento
          </a>
        </div>
      </div>`;
  }

  /* Mensagem do WhatsApp pré-preenchida */
  const waMensagem = encodeURIComponent(
    `Olá, Raquel! Confirmei meu agendamento pelo site:\n` +
    `\u25aa Serviço: ${servicoSelecionado.nome}\n` +
    `\u25aa Data: ${formatarDataBR(dataSelecionada)}\n` +
    `\u25aa Horário: ${horaSelecionada}\n` +
    `\u25aa Nome: ${nomeCliente || '(não informado)'}`,
  );

  return `
    <div class="container">
      <div class="success-page">
        <div class="success-icon" aria-hidden="true">✅</div>
        <h1 class="success-title">Agendado com sucesso!</h1>
        <p class="success-sub">
          ${nomeCliente ? `Olá, <strong>${nomeCliente}</strong>! ` : ''}
          Seu horário está reservado. Até lá! ❤️
        </p>
      </div>

      <!-- Comprovante -->
      <div class="summary-card success-card">
        <p class="summary-title">Comprovante de agendamento</p>
        <div class="summary-row">
          <span class="summary-label">Serviço</span>
          <span class="summary-value">${servicoSelecionado.nome}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Duração</span>
          <span class="summary-value">${formatarDuracao(servicoSelecionado.duracao)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Data</span>
          <span class="summary-value">${formatarDataBR(dataSelecionada)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Horário</span>
          <span class="summary-value">${horaSelecionada}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Valor</span>
          <span class="summary-value" style="color:var(--primary);">
            ${formatarPreco(servicoSelecionado)}
          </span>
        </div>
      </div>

      <div class="success-actions">
        <!-- WhatsApp CTA com dados pré-preenchidos -->
        <a href="https://wa.me/${negocio.whatsapp}?text=${waMensagem}"
           target="_blank" rel="noopener"
           class="btn btn--whatsapp btn--full btn--large">
          💬 Confirmar pelo WhatsApp
        </a>
        <a href="#/unidade/${unidadeSlug || 'raquel'}" id="btn-novo-agendamento"
           class="btn btn--primary btn--full">
          Fazer novo agendamento
        </a>
        <a href="#/inicio" class="btn btn--outline btn--full">
          Ir para o início
        </a>
      </div>
    </div>`;
}

/* ---- Mount ------------------------------------------------------------------ */

export function mount(container) {
  setTimeout(() => clearState(), 200);

  const btnNovo = container.querySelector('#btn-novo-agendamento');
  if (btnNovo) btnNovo.addEventListener('click', () => clearState());
}
