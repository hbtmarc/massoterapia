/**
 * views/agendar.js — Escolha de data e horário
 *
 * Depende de state.servicoSelecionado e state.unidadeSlug.
 * Redireciona se não há serviço selecionado.
 *
 * Disponibilidade: lida do Firebase RTDB com timeout de 5 s.
 * Em caso de falha, exibe todos os slots como disponíveis —
 * a transação em confirmar.js garante proteção contra double-booking.
 * A grade de horários e os dias exibidos respeitam as configurações
 * de agenda salvas pelo admin (carregadas com timeout de 4 s).
 */

import {
  gerarHorarios,
  obterProximos14DiasUteis,
} from '../data/mock-repository.js';

import {
  obterSlotsBloqueados,
  obterConfigAgenda,
} from '../data/firebase-repository.js';

import { getState, setState } from '../state.js';
import { navegar }            from '../router.js';

/* ---- Helpers de formatação ----------------------------------------- */

const diaDaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const mesCurto    = ['Jan','Fev','Mar','Abr','Mai','Jun',
                     'Jul','Ago','Set','Out','Nov','Dez'];

function formatarData(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dia:    String(d).padStart(2, '0'),
    mes:    mesCurto[m - 1],
    semana: diaDaSemana[date.getDay()],
  };
}

function formatarPreco(s) {
  if (!s) return '';
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
  const { servicoSelecionado, unidadeSlug } = getState();

  // Guarda de navegação
  if (!servicoSelecionado) {
    return `
      <div class="container">
        <div class="empty-state" style="padding:3rem 0;">
          <p>Nenhum serviço selecionado.</p>
          <a href="#/inicio" class="btn btn--primary" style="margin-top:1rem;display:inline-flex;">
            Ir para o início
          </a>
        </div>
      </div>`;
  }

  const dias = obterProximos14DiasUteis();

  const diasHTML = dias.map(iso => {
    const { dia, mes, semana } = formatarData(iso);
    return `
      <button class="date-btn" data-iso="${iso}" type="button"
              aria-label="${semana}, ${dia} de ${mes}">
        <span class="d-week">${semana}</span>
        <span class="d-day">${dia}</span>
        <span class="d-month">${mes}</span>
      </button>`;
  }).join('');

  return `
    <div class="container">
      <nav class="steps" aria-label="Localização na jornada">
        <a href="#/inicio">Início</a>
        <span class="steps-sep" aria-hidden="true">›</span>
        <a href="#/unidade/${unidadeSlug || 'raquel'}">Serviços</a>
        <span class="steps-sep" aria-hidden="true">›</span>
        <span aria-current="page">Agendar</span>
      </nav>

      <div class="page-header">
        <h1 class="page-title">Escolha o horário</h1>
        <p class="page-sub">Selecione um dia e depois um horário disponível.</p>
      </div>

      <!-- Resumo do serviço -->
      <div class="summary-card" style="margin-bottom:1.5rem;">
        <p class="summary-title">Serviço selecionado</p>
        <div class="summary-row">
          <span class="summary-label">Serviço</span>
          <span class="summary-value">${servicoSelecionado.nome}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Duração</span>
          <span class="summary-value">${formatarDuracao(servicoSelecionado.duracao)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Valor</span>
          <span class="summary-value">${formatarPreco(servicoSelecionado)}</span>
        </div>
      </div>

      <!-- Seletor de data -->
      <section aria-labelledby="data-titulo">
        <h2 id="data-titulo" class="section-title" style="margin-bottom:.75rem;">
          📅 Escolha o dia
        </h2>
        <div class="date-scroll" role="listbox" aria-label="Dias disponíveis" id="date-scroll">
          ${diasHTML}
        </div>
      </section>

      <!-- Grade de horários (renderizada via JS após escolha de data) -->
      <section id="secao-horarios" aria-labelledby="hora-titulo" hidden>
        <h2 id="hora-titulo" class="section-title" style="margin-bottom:.75rem;">
          🕘 Escolha o horário
        </h2>
        <div class="time-grid" id="time-grid" role="listbox" aria-label="Horários disponíveis">
        </div>
      </section>

      <!-- Ação -->
      <div id="acoes-agendar" style="margin-top:1.75rem;" hidden>
        <button id="btn-continuar" class="btn btn--primary btn--full btn--large" type="button">
          Continuar
        </button>
      </div>
    </div>`;
}

/* ---- Mount ---------------------------------------------------------- */

export function mount(container) {
  const { servicoSelecionado, unidadeSlug } = getState();
  if (!servicoSelecionado) return;

  const dateScroll   = container.querySelector('#date-scroll');
  const secaoHoras   = container.querySelector('#secao-horarios');
  const timeGrid     = container.querySelector('#time-grid');
  const acoes        = container.querySelector('#acoes-agendar');
  const btnContinuar = container.querySelector('#btn-continuar');

  let dataSelecionada = null;
  let horaSelecionada = null;
  let agendaConfig    = null;

  // --- Clique em data ---
  dateScroll.addEventListener('click', e => {
    const btn = e.target.closest('.date-btn');
    if (!btn) return;
    _selecionarData(btn.dataset.iso);
  });

  // --- Clique em horário ---
  timeGrid.addEventListener('click', e => {
    const btn = e.target.closest('.time-btn');
    if (!btn || btn.disabled) return;
    timeGrid.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    horaSelecionada = btn.dataset.hora;
    acoes.hidden = false;
  });

  // --- Continuar ---
  btnContinuar.addEventListener('click', () => {
    if (!dataSelecionada || !horaSelecionada) return;
    setState({ dataSelecionada, horaSelecionada });
    navegar('/confirmar');
  });

  // Inicia: carrega config e reconstrói o seletor de datas
  _inicializar();

  /* ------------------------------------------------------------------ */

  async function _inicializar() {
    const slug = unidadeSlug || 'raquel';

    try {
      agendaConfig = await _withTimeout(obterConfigAgenda(slug), 4000);
    } catch {
      agendaConfig = null;   // usa defaults
    }

    const diasAtivos = agendaConfig?.diasAtivos ?? [1, 2, 3, 4, 5];
    const dias = obterProximos14DiasUteis(diasAtivos);

    // Reconstrói o date scroll com os dias corretos
    if (dateScroll) {
      dateScroll.innerHTML = dias.map(iso => {
        const { dia, mes, semana } = formatarData(iso);
        return `
          <button class="date-btn" data-iso="${iso}" type="button"
                  aria-label="${semana}, ${dia} de ${mes}">
            <span class="d-week">${semana}</span>
            <span class="d-day">${dia}</span>
            <span class="d-month">${mes}</span>
          </button>`;
      }).join('');
    }

    const primeiroDia = dateScroll?.querySelector('.date-btn');
    if (primeiroDia) _selecionarData(primeiroDia.dataset.iso);
  }

  async function _selecionarData(isoStr) {
    dataSelecionada = isoStr;
    horaSelecionada = null;
    acoes.hidden    = true;

    dateScroll.querySelectorAll('.date-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.iso === isoStr);
      b.setAttribute('aria-selected', b.dataset.iso === isoStr ? 'true' : 'false');
    });

    const btnAtivo = dateScroll.querySelector('.date-btn.selected');
    if (btnAtivo) btnAtivo.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });

    secaoHoras.hidden = false;
    timeGrid.innerHTML = `
      <p style="grid-column:1/-1;font-size:.88rem;color:var(--text-muted);padding:.5rem 0;">
        Verificando disponibilidade…
      </p>`;

    // Busca slots bloqueados com timeout de 5 s
    let ocupados = [];
    try {
      const slug = unidadeSlug || 'raquel';
      ocupados = await _withTimeout(obterSlotsBloqueados(slug, isoStr), 5000);
    } catch (err) {
      console.warn('[agendar] RTDB indisponível, exibindo todos os slots:', err.message);
    }

    const horarios = gerarHorarios(
      isoStr,
      servicoSelecionado.duracao,
      ocupados,
      agendaConfig,
    );

    if (horarios.length === 0) {
      timeGrid.innerHTML = `
        <p style="grid-column:1/-1;font-size:.88rem;color:var(--text-muted);">
          Nenhum horário disponível neste dia.
        </p>`;
    } else {
      timeGrid.innerHTML = horarios.map(h => `
        <button
          class="time-btn"
          data-hora="${h.hora}"
          type="button"
          ${h.disponivel ? '' : 'disabled'}
          aria-label="${h.hora}${h.disponivel ? '' : ' — ocupado'}"
          aria-disabled="${h.disponivel ? 'false' : 'true'}"
        >${h.hora}</button>
      `).join('');
    }
  }
}

/* ---- Timeout helper ----------------------------------------------- */

function _withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}
