/**
 * views/confirmar.js — Resumo do agendamento + dados do cliente
 *
 * Mostra o resumo (serviço, data, hora) e coleta nome/telefone.
 * Cria o agendamento no Firebase RTDB via transação atômica (double-booking safe).
 * Só navega para #/sucesso após confirmação do servidor.
 */

import { getState, setState }    from '../state.js';
import { navegar }               from '../router.js';
import { criarAgendamento }      from '../data/firebase-repository.js';

/* ---- Helpers -------------------------------------------------------- */

const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const mesNome   = ['janeiro','fevereiro','março','abril','maio','junho',
                   'julho','agosto','setembro','outubro','novembro','dezembro'];

function formatarDataBR(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${diaSemana[date.getDay()]}, ${d} de ${mesNome[m - 1]} de ${y}`;
}

function formatarPreco(s) {
  if (!s) return '—';
  if (s.precoTexto) return s.precoTexto;
  if (s.preco !== null && s.preco !== undefined)
    return s.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return 'A combinar';
}

function formatarDuracao(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/* ---- Render --------------------------------------------------------- */

export function render() {
  const { servicoSelecionado, dataSelecionada, horaSelecionada, unidadeSlug } = getState();

  // Guarda: todos os passos anteriores devem estar preenchidos
  if (!servicoSelecionado || !dataSelecionada || !horaSelecionada) {
    return `
      <div class="container">
        <div class="empty-state" style="padding:3rem 0;">
          <p>Parece que você pulou alguma etapa.</p>
          <a href="#/inicio" class="btn btn--primary" style="margin-top:1rem;display:inline-flex;">
            Recomeçar agendamento
          </a>
        </div>
      </div>`;
  }

  return `
    <div class="container">
      <nav class="steps" aria-label="Localização na jornada">
        <a href="#/inicio">Início</a>
        <span class="steps-sep" aria-hidden="true">›</span>
        <a href="#/unidade/${unidadeSlug || 'raquel'}">Serviços</a>
        <span class="steps-sep" aria-hidden="true">›</span>
        <a href="#/agendar">Horário</a>
        <span class="steps-sep" aria-hidden="true">›</span>
        <span aria-current="page">Confirmar</span>
      </nav>

      <div class="page-header">
        <h1 class="page-title">Confirme o agendamento</h1>
        <p class="page-sub">Revise os detalhes e informe seus dados para finalizar.</p>
      </div>

      <!-- Resumo -->
      <div class="summary-card">
        <p class="summary-title">Resumo do agendamento</p>
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
          <span class="summary-value" style="color:var(--primary);font-size:1.05rem;">
            ${formatarPreco(servicoSelecionado)}
          </span>
        </div>
      </div>

      <!-- Formulário -->
      <form id="form-confirmar" novalidate>
        <div class="form-group">
          <label for="campo-nome">Seu nome completo</label>
          <input
            type="text"
            id="campo-nome"
            name="nome"
            placeholder="Ex: Maria Oliveira"
            autocomplete="name"
            required
            maxlength="80"
          />
          <span class="form-error" id="erro-nome" role="alert" style="display:none;
            font-size:.82rem;color:var(--danger);margin-top:.2rem;"></span>
        </div>

        <div class="form-group">
          <label for="campo-telefone">WhatsApp / Telefone</label>
          <input
            type="tel"
            id="campo-telefone"
            name="telefone"
            placeholder="(11) 90000-0000"
            autocomplete="tel"
            required
            maxlength="20"
          />
          <span class="form-error" id="erro-tel" role="alert" style="display:none;
            font-size:.82rem;color:var(--danger);margin-top:.2rem;"></span>
        </div>

        <!-- Erro de conflito de horário -->
        <p id="erro-conflito" role="alert" style="display:none;
          font-size:.88rem;color:var(--danger);text-align:center;
          padding:.6rem .75rem;background:#fff1f1;border:1px solid #f5c6c6;
          border-radius:.5rem;margin-bottom:.75rem;"></p>

        <div style="margin-top:.75rem;">
          <button type="submit" id="btn-confirmar"
                  class="btn btn--primary btn--full btn--large">
            Confirmar agendamento
          </button>
          <a href="#/agendar" class="btn btn--outline btn--full"
             style="margin-top:.65rem;display:inline-flex;">
            ← Voltar e alterar horário
          </a>
        </div>
      </form>
    </div>`;
}

/* ---- Mount ---------------------------------------------------------- */

export function mount(container) {
  const form          = container.querySelector('#form-confirmar');
  const campoNome     = container.querySelector('#campo-nome');
  const campoTel      = container.querySelector('#campo-telefone');
  const erroNome      = container.querySelector('#erro-nome');
  const erroTel       = container.querySelector('#erro-tel');
  const erroConflito  = container.querySelector('#erro-conflito');
  const btnConfirmar  = container.querySelector('#btn-confirmar');

  // Pré-preenche se o usuário voltou
  const estado = getState();
  if (estado.nomeCliente)    campoNome.value = estado.nomeCliente;
  if (estado.telefoneCliente) campoTel.value  = estado.telefoneCliente;

  // Formata telefone enquanto digita
  campoTel.addEventListener('input', () => {
    let v = campoTel.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) {
      v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (v.length > 6) {
      v = v.replace(/^(\d{2})(\d{4})(\d*)$/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/^(\d{2})(\d*)$/, '($1) $2');
    }
    campoTel.value = v;
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const nome = campoNome.value.trim();
    const tel  = campoTel.value.trim();
    let valido = true;

    // Validação simples
    if (nome.length < 3) {
      erroNome.textContent = 'Informe seu nome completo (mínimo 3 caracteres).';
      erroNome.style.display = 'block';
      campoNome.focus();
      valido = false;
    } else {
      erroNome.style.display = 'none';
    }

    const somenteNumeros = tel.replace(/\D/g, '');
    if (somenteNumeros.length < 10) {
      erroTel.textContent = 'Informe um telefone válido com DDD.';
      erroTel.style.display = 'block';
      if (valido) campoTel.focus();
      valido = false;
    } else {
      erroTel.style.display = 'none';
    }

    if (!valido) return;

    // Salva os dados do cliente no state
    setState({ nomeCliente: nome, telefoneCliente: tel });

    // Desabilita botão durante a operação
    btnConfirmar.disabled    = true;
    btnConfirmar.textContent = 'Confirmando…';
    erroConflito.style.display = 'none';

    const estado = getState();

    try {
      const resultado = await criarAgendamento({
        unidadeSlug:     estado.unidadeSlug || 'raquel',
        servicoId:       estado.servicoSelecionado.id,
        servicoNome:     estado.servicoSelecionado.nome,
        dataSelecionada: estado.dataSelecionada,
        horaSelecionada: estado.horaSelecionada,
        nomeCliente:     nome,
        telefoneCliente: tel,
      });

      if (resultado.ok) {
        // Guarda o ID do agendamento para exibir no comprovante
        setState({ bookingId: resultado.bookingId });
        navegar('/sucesso');
      } else if (resultado.conflito) {
        // Slot foi tomado por outro usuário entre a seleção e a confirmação
        erroConflito.textContent = resultado.erro;
        erroConflito.style.display = 'block';
        btnConfirmar.disabled    = false;
        btnConfirmar.textContent = 'Confirmar agendamento';
        erroConflito.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        erroConflito.textContent = 'Erro ao confirmar agendamento. Tente novamente.';
        erroConflito.style.display = 'block';
        btnConfirmar.disabled    = false;
        btnConfirmar.textContent = 'Confirmar agendamento';
      }
    } catch (err) {
      console.error('[confirmar] Erro inesperado:', err);
      erroConflito.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
      erroConflito.style.display = 'block';
      btnConfirmar.disabled    = false;
      btnConfirmar.textContent = 'Confirmar agendamento';
    }
  });
}
