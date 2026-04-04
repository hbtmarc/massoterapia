/**
 * views/inicio.js — Página inicial
 *
 * Hero com mensagem da marca + bloco de informações + card da profissional.
 */

import { unidades, negocio } from '../data/mock-repository.js';

export function render() {
  const cardsHTML = unidades.map(u => `
    <a href="#/unidade/${u.slug}" class="unit-card" aria-label="Ver serviços de ${u.nome}">
      <div class="unit-avatar" aria-hidden="true">${u.iniciais}</div>
      <div class="unit-info">
        <p class="unit-name">${u.nome}</p>
        <p class="unit-role">${u.especialidade}</p>
        <p class="unit-role" style="margin-top:.2rem;color:var(--primary);font-weight:500;">
          ${u.servicosIds.length - 1} serviços disponíveis
        </p>
      </div>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"
           style="flex-shrink:0;color:var(--text-muted)">
        <path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
  `).join('');

  return `
    <div class="container">

      <!-- Hero -->
      <section class="hero" aria-labelledby="hero-title">
        <span class="hero-eyebrow">❖ Bem-vinda ao seu espaço de cuidado</span>
        <h1 class="hero-title" id="hero-title">
          Desconecte do<br><span>estresse</span>
        </h1>
        <p class="hero-subtitle">
          Conecte-se com você. Atendimento humanizado,<br>
          <em>somente com hora marcada.</em>
        </p>
        <p class="hero-tagline">${negocio.tagline}</p>
        <div class="hero-cta">
          <a href="#/unidade/raquel" class="btn btn--primary btn--large">
            Agendar horário
          </a>
        </div>
      </section>

      <!-- Informações do negócio -->
      <div class="biz-info" aria-label="Informações de contato">
        <p class="biz-info-title">Contato &amp; informações</p>

        <div class="biz-row">
          <span class="biz-icon" aria-hidden="true">🗓️</span>
          <span><strong>${negocio.aviso}</strong></span>
        </div>

        <div class="biz-row">
          <span class="biz-icon" aria-hidden="true">📱</span>
          <span>
            <a href="https://wa.me/${negocio.whatsapp}?text=Ol%C3%A1%2C+gostaria+de+agendar!"
               target="_blank" rel="noopener">${negocio.whatsappDisplay}</a>
            &nbsp;— WhatsApp
          </span>
        </div>

        <div class="biz-row">
          <span class="biz-icon" aria-hidden="true">✉️</span>
          <span><a href="mailto:${negocio.email}">${negocio.email}</a></span>
        </div>

        <p class="biz-note">“Recomeçar também é coragem ❤️”</p>
      </div>

      <!-- Profissional -->
      <section aria-labelledby="profissionais-title" style="margin-top:1.5rem;">
        <h2 id="profissionais-title" class="section-title" style="margin-bottom:.75rem;">
          Nossa profissional
        </h2>
        <div class="unit-grid" role="list">
          ${cardsHTML}
        </div>
      </section>

    </div>`;
}
