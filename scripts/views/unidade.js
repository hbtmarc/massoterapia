/**
 * views/unidade.js — Página do profissional: lista de serviços com busca
 *
 * Parâmetros de rota: { slug }
 *
 * TODO (Firebase): substituir a importação abaixo por uma chamada
 *       assíncrona a firebase-repository.js para buscar os dados
 *       do profissional e serviços em tempo real.
 */

import { unidades, servicos, negocio } from '../data/mock-repository.js';
import { setState, clearState }        from '../state.js';
import { navegar }                     from '../router.js';

/* ---- Helpers ------------------------------------------------------- */

function formatarPreco(s) {
  if (s.precoTexto) return `<span class="service-price--consulta">${s.precoTexto}</span>`;
  if (s.preco !== null && s.preco !== undefined) {
    return `<span class="service-price">${s.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>`;
  }
  return '';
}

function formatarDuracao(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/* ---- Render --------------------------------------------------------- */

export function render({ slug } = {}) {
  const unidade = unidades.find(u => u.slug === slug);

  if (!unidade) {
    return `
      <div class="container">
        <div class="empty-state" style="padding: 3rem 0;">
          <p style="font-size:2rem;margin-bottom:.5rem;">😕</p>
          <p>Profissional "<strong>${slug}</strong>" não encontrado.</p>
          <a href="#/inicio" class="btn btn--outline" style="margin-top:1.25rem;display:inline-flex;">
            Ver profissionais
          </a>
        </div>
      </div>`;
  }

  const servicosDaUnidade = servicos.filter(s => unidade.servicosIds.includes(s.id));
  const bookableCount     = servicosDaUnidade.filter(s => s.bookable).length;

  const cardsHTML = servicosDaUnidade.map(s => {
    // Card institucional (não é para agendar)
    if (!s.bookable) {
      return `
        <div class="service-card service-card--highlight" role="listitem"
             aria-label="${s.nome} — informação institucional">
          <div class="service-icon" aria-hidden="true">${s.icone || '🌿'}</div>
          <div class="service-info">
            <p class="service-name" style="color:var(--gold);">${s.nome}</p>
            <p class="service-desc" style="color:var(--text-muted);-webkit-line-clamp:3;">${s.descricao}</p>
          </div>
        </div>`;
    }

    // Card agendável
    const duracaoHtml = s.duracao
      ? `<span>⏱ ${formatarDuracao(s.duracao)}</span>` : '';

    return `
      <button
        class="service-card"
        data-id="${s.id}"
        aria-label="${s.nome}${s.duracao ? ' — ' + formatarDuracao(s.duracao) : ''}"
        type="button"
        role="listitem"
      >
        <div class="service-icon" aria-hidden="true">${s.icone || '✦'}</div>
        <div class="service-info">
          <p class="service-name">${s.nome}</p>
          ${s.descricao ? `<p class="service-desc">${s.descricao}</p>` : ''}
          <div class="service-meta">
            ${duracaoHtml}
            ${formatarPreco(s)}
          </div>
        </div>
      </button>`;
  }).join('');

  return `
    <div class="container">
      <nav class="steps" aria-label="Localização na jornada">
        <a href="#/inicio">Início</a>
        <span class="steps-sep" aria-hidden="true">›</span>
        <span aria-current="page">${unidade.nome}</span>
      </nav>

      <div class="page-header">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.75rem;">
          <div class="unit-avatar" aria-hidden="true">${unidade.iniciais}</div>
          <div>
            <h1 class="page-title" style="font-size:1.3rem;">${unidade.nome}</h1>
            <p class="page-sub" style="margin:0;">${unidade.especialidade}</p>
          </div>
        </div>
        <p style="font-size:.9rem;color:var(--text-muted);line-height:1.6;">${unidade.bio}</p>
      </div>

      <!-- WhatsApp CTA rápido -->
      <a href="https://wa.me/${negocio.whatsapp}?text=Ol%C3%A1%2C+gostaria+de+agendar+uma+sess%C3%A3o!"
         target="_blank" rel="noopener"
         class="btn btn--whatsapp btn--full"
         style="margin-bottom:1.25rem;display:inline-flex;font-size:.92rem;">
        💬 Prefere agendar pelo WhatsApp?
      </a>

      <!-- Campo de busca -->
      <div class="search-wrap" role="search">
        <svg class="search-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          id="busca-servico"
          class="search-input"
          placeholder="Buscar serviço…"
          aria-label="Buscar serviço"
          autocomplete="off"
        />
      </div>

      <div class="section-header">
        <span class="section-title">Serviços</span>
        <span class="section-count" id="contagem-servicos">${bookableCount} para agendar</span>
      </div>

      <div class="service-list" id="lista-servicos" role="list">
        ${cardsHTML}
      </div>

      <p id="nenhum-servico" class="empty-state" hidden>
        Nenhum serviço encontrado para "<span id="busca-termo"></span>".
      </p>
    </div>`;
}

/* ---- Mount ---------------------------------------------------------- */

export function mount(container, { slug } = {}) {
  const unidade = unidades.find(u => u.slug === slug);
  if (!unidade) return;

  const servicosDaUnidade = servicos.filter(s => unidade.servicosIds.includes(s.id));
  const lista     = container.querySelector('#lista-servicos');
  const busca     = container.querySelector('#busca-servico');
  const nenhumMsg = container.querySelector('#nenhum-servico');
  const contagem  = container.querySelector('#contagem-servicos');

  // --- Busca / filtro ---
  busca.addEventListener('input', () => {
    const termo = busca.value.trim().toLowerCase();
    let visiveis = 0;

    lista.querySelectorAll('[data-id],.service-card--highlight').forEach(card => {
      const id      = card.dataset.id !== undefined ? Number(card.dataset.id) : -1;
      const servico = id >= 0 ? servicosDaUnidade.find(s => s.id === id) : null;

      // Highlight cards always show (skip quando há filtro ativo)
      if (!servico) {
        card.hidden = !!termo;
        return;
      }

      const corresponde = !termo || servico.nome.toLowerCase().includes(termo)
                                 || (servico.descricao || '').toLowerCase().includes(termo);
      card.hidden = !corresponde;
      if (corresponde && servico.bookable) visiveis++;
    });

    nenhumMsg.hidden = visiveis > 0 || !termo;
    if (!nenhumMsg.hidden) {
      container.querySelector('#busca-termo').textContent = busca.value.trim();
    }
    contagem.textContent = termo ? `${visiveis} resultado(s)` : `${servicosDaUnidade.filter(s => s.bookable).length} para agendar`;
  });

  // --- Seleção de serviço agendável ---
  lista.addEventListener('click', e => {
    const card = e.target.closest('button.service-card');
    if (!card) return;

    const id      = Number(card.dataset.id);
    const servico = servicosDaUnidade.find(s => s.id === id);
    if (!servico || !servico.bookable) return;

    clearState();
    setState({
      unidadeSlug:        slug,
      servicoSelecionado: servico,
    });

    navegar('/agendar');
  });
}

