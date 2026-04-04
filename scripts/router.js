/**
 * router.js — Roteamento via hash (#)
 *
 * Como funciona:
 *  - Escuta o evento "hashchange" e "load" da janela.
 *  - Faz o match da URL hash com as rotas registradas.
 *  - Suporta parâmetros dinâmicos (:slug, :id, …).
 *  - Injeta o HTML resultado no elemento #app.
 *  - Chama mount(container, params) se a view exportar essa função.
 */

const app = document.getElementById('app');

/**
 * Tabela de rotas.
 * Cada entrada mapeia um padrão de path para uma função
 * que retorna a importação dinâmica do módulo de view.
 *
 * Os padrões usam ":parametro" para segmentos dinâmicos.
 */
const rotas = [
  { path: '/inicio',          loader: () => import('./views/inicio.js')   },
  { path: '/unidade/:slug',   loader: () => import('./views/unidade.js')  },
  { path: '/agendar',         loader: () => import('./views/agendar.js')  },
  { path: '/confirmar',       loader: () => import('./views/confirmar.js') },
  { path: '/sucesso',         loader: () => import('./views/sucesso.js')  },
  { path: '/admin',           loader: () => import('./views/admin.js')    },
];

/**
 * Converte um padrão de rota em RegExp e extrai os nomes dos parâmetros.
 * Ex: "/unidade/:slug" → /^\/unidade\/([^/]+)$/  + params: ["slug"]
 */
function compilarRota(path) {
  const paramNames = [];
  const regexStr   = path.replace(/:([^/]+)/g, (_, nome) => {
    paramNames.push(nome);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

/**
 * Lê o hash atual e resolve qual rota deve ser carregada.
 * @returns {{ loader: Function, params: object } | null}
 */
function resolverRota() {
  const hash = window.location.hash || '#/inicio';
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  const pathLimpo = path.split('?')[0] || '/inicio';

  for (const rota of rotas) {
    const { regex, paramNames } = compilarRota(rota.path);
    const match = pathLimpo.match(regex);
    if (match) {
      const params = {};
      paramNames.forEach((nome, i) => { params[nome] = match[i + 1]; });
      return { loader: rota.loader, params };
    }
  }

  return null; // Rota não encontrada
}

/**
 * Navega para uma nova rota programaticamente.
 * @param {string} path — ex: "/agendar" ou "/unidade/raquel"
 */
export function navegar(path) {
  window.location.hash = '#' + path;
}

/**
 * Renderiza a view correspondente ao hash atual.
 * Chamada no load e em todo hashchange.
 */
async function renderizar() {
  const resultado = resolverRota();

  if (!resultado) {
    app.innerHTML = `
      <div class="container">
        <div class="empty-state" style="padding: 4rem 0;">
          <p style="font-size: 2rem; margin-bottom: .5rem;">🔍</p>
          <p>Página não encontrada.</p>
          <a href="#/inicio" class="btn btn--primary" style="margin-top: 1.25rem; display: inline-flex;">
            Ir para o início
          </a>
        </div>
      </div>`;
    return;
  }

  // Notifica a view atual antes de desmontá-la (ex.: admin.js limpa onAuthStateChanged)
  app.dispatchEvent(new CustomEvent('viewdestroy'));

  // Mostra um indicador mínimo de carregamento
  app.innerHTML = '<div class="container"><div class="empty-state">Carregando…</div></div>';

  try {
    const modulo = await resultado.loader();

    // Toda view deve exportar: render(params) → string HTML
    app.innerHTML = modulo.render(resultado.params);

    // Se a view exportar mount(), chama após injetar o HTML
    if (typeof modulo.mount === 'function') {
      modulo.mount(app, resultado.params);
    }

    // Rola para o topo a cada navegação
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    console.error('[router] Erro ao carregar view:', err);
    app.innerHTML = `
      <div class="container">
        <div class="empty-state">
          <p>Ocorreu um erro ao carregar a página.</p>
          <a href="#/inicio" class="btn btn--outline" style="margin-top: 1rem; display: inline-flex;">
            Voltar ao início
          </a>
        </div>
      </div>`;
  }
}

/**
 * Inicializa o roteador: registra os listeners e executa a primeira renderização.
 */
export function iniciarRouter() {
  window.addEventListener('hashchange', renderizar);
  renderizar(); // renderiza a rota atual ao carregar a página
}
