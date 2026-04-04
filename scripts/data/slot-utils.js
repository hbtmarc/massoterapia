/**
 * slot-utils.js — Utilitários de tempo e slots de 15 min
 *
 * Fonte única de verdade para toda a lógica de grade de horários.
 * Importado por mock-repository.js e firebase-repository.js.
 *
 * Granularidade: 15 minutos (cada "fatia" de agendamento equivale a 15 min).
 * Uma reserva de 60 min ocupa 4 fatias; de 90 min, 6 fatias; etc.
 */

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Granularidade fixa da agenda em minutos. */
export const GRANULARITY = 15;

// ─── Conversões de tempo ─────────────────────────────────────────────────────

/**
 * "HH:MM" → total de minutos desde meia-noite.
 * @param {string} s — ex.: "09:30"
 * @returns {number} ex.: 570
 */
export function hhmm(s) {
  const [h = 0, m = 0] = (s || '00:00').split(':').map(Number);
  return h * 60 + m;
}

/**
 * Minutos desde meia-noite → "HH:MM".
 * @param {number} min — ex.: 570
 * @returns {string} ex.: "09:30"
 */
export function minToHH(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * "HH:MM" → "HH-MM"  (chave segura para uso como nó no Firebase RTDB).
 * @param {string} hora — ex.: "09:30"
 * @returns {string}    — ex.: "09-30"
 */
export function horaParaChave(hora) {
  return hora.replace(':', '-');
}

/**
 * "HH-MM" → "HH:MM"
 * @param {string} chave — ex.: "09-30"
 * @returns {string}     — ex.: "09:30"
 */
export function chaveParaHora(chave) {
  return chave.replace('-', ':');
}

// ─── Lógica de fatias ────────────────────────────────────────────────────────

/**
 * Expande um agendamento em todas as chaves RTDB ("HH-MM") das fatias de 15 min.
 *
 * Exemplo: expandirSlots("09:00", 60) → ["09-00","09-15","09-30","09-45"]
 * Exemplo: expandirSlots("09:00", 90) → ["09-00","09-15","09-30","09-45","10-00","10-15"]
 *
 * @param {string} horaSelecionada — início em "HH:MM"
 * @param {number} duracaoMin      — duração do serviço em minutos
 * @returns {string[]}             — chaves RTDB de cada fatia
 */
export function expandirSlots(horaSelecionada, duracaoMin) {
  const startMin = hhmm(horaSelecionada);
  const keys = [];
  for (let m = startMin; m < startMin + duracaoMin; m += GRANULARITY) {
    keys.push(horaParaChave(minToHH(m)));
  }
  return keys;
}

/**
 * Verifica se um horário de início é válido pelas regras de negócio:
 *  - A duração não ultrapassa o fim do expediente
 *  - O serviço não cruza o intervalo de almoço
 *
 * Não considera bookings existentes. Use junto com `slotEstaLivre`.
 *
 * @param {number} startMin
 * @param {number} duracaoMin
 * @param {number} almocoIniMin
 * @param {number} almocoFimMin
 * @param {number} fimExpedienteMin
 * @returns {boolean}
 */
export function validarNegocio(startMin, duracaoMin, almocoIniMin, almocoFimMin, fimExpedienteMin) {
  const endMin = startMin + duracaoMin;

  // Não ultrapassar o fim do expediente
  if (endMin > fimExpedienteMin) return false;

  // Não cruzar o intervalo de almoço (desativado quando almocoIni >= almocoFim)
  if (almocoIniMin < almocoFimMin) {
    if (startMin < almocoFimMin && endMin > almocoIniMin) return false;
  }

  return true;
}

/**
 * Verifica se um horário de início está livre de bookings existentes.
 * Checa cada fatia de 15 min contra o set de bloqueados.
 *
 * @param {number}      startMin
 * @param {number}      duracaoMin
 * @param {Set<number>} bloqueadosMin
 * @returns {boolean}
 */
export function slotEstaLivre(startMin, duracaoMin, bloqueadosMin) {
  for (let m = startMin; m < startMin + duracaoMin; m += GRANULARITY) {
    if (bloqueadosMin.has(m)) return false;
  }
  return true;
}

/**
 * Combina ambas as validações (negócio + disponibilidade).
 * Mantido por compatibilidade com código legado.
 *
 * @deprecated Prefira validarNegocio + slotEstaLivre individualmente.
 */
export function inicioValido(
  startMin,
  duracaoMin,
  almocoIniMin,
  almocoFimMin,
  fimExpedienteMin,
  bloqueadosMin,
) {
  return (
    validarNegocio(startMin, duracaoMin, almocoIniMin, almocoFimMin, fimExpedienteMin) &&
    slotEstaLivre(startMin, duracaoMin, bloqueadosMin)
  );
}

/**
 * Constrói um Set<number> de minutos bloqueados a partir de um array
 * de objetos ocupados (formato { hora } ou { data, hora }).
 *
 * Usado em gerarHorarios() para validação eficiente.
 *
 * @param {Array<{hora:string}|{data:string,hora:string}>} ocupados
 * @param {string} dataISO — filtra apenas os bloqueios deste dia
 * @returns {Set<number>}
 */
export function bloqueadosParaSet(ocupados, dataISO) {
  const bloqueados = new Set();
  for (const o of ocupados) {
    // Aceita objetos sem data (mock legado) e com data (Firebase)
    if (o.data !== undefined && o.data !== dataISO) continue;
    bloqueados.add(hhmm(o.hora));
  }
  return bloqueados;
}
