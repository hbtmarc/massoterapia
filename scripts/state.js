/**
 * state.js — Gerenciamento do estado do agendamento
 *
 * Usa sessionStorage para persistir os dados da sessão de agendamento.
 * O estado é limpo automaticamente quando o usuário fecha a aba.
 *
 * TODO (Firebase): Quando implementar autenticação, armazene o uid
 *       do usuário logado aqui e use-o nas requisições ao RTDB.
 */

const SESSION_KEY = 'massoterapia_booking';

/** Estado padrão (vazio) */
const defaultState = {
  servicoSelecionado: null,  // { id, nome, duracao, preco }
  dataSelecionada:    null,  // string "YYYY-MM-DD"
  horaSelecionada:    null,  // string "HH:MM"
  unidadeSlug:        null,  // string, ex: "raquel"
  nomeCliente:        '',
  telefoneCliente:    '',
};

/**
 * Lê o estado atual da sessionStorage.
 * @returns {object} estado atual
 */
export function getState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

/**
 * Atualiza parcialmente o estado (merge) e salva na sessionStorage.
 * @param {object} patch — campos a atualizar
 */
export function setState(patch) {
  const current = getState();
  const next    = { ...current, ...patch };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[state] Não foi possível salvar em sessionStorage:', err);
  }
}

/**
 * Limpa completamente o estado de agendamento.
 * Chamado após confirmação ou ao iniciar novo agendamento.
 */
export function clearState() {
  sessionStorage.removeItem(SESSION_KEY);
}
