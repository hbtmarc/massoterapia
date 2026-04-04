/**
 * firebase-repository.js — Camada de dados real (Firebase RTDB + Auth)
 *
 * Esquema RTDB:
 *   /bookings/{bookingId}            — dado completo de cada agendamento
 *   /slotLocks/{unidadeSlug}/{date}/{time}
 *                                    — lock atômico do slot
 *                                      (date = "YYYY-MM-DD", time = "HH-MM")
 *
 * Regra de bloqueio:
 *   status "pending" ou "confirmed"  → slot bloqueado
 *   status "rejected" ou "cancelled" → lock removido, slot liberto
 *
 * Versão Firebase pinada: 12.11.0  (manter em sincronia com firebase-config.js)
 */

// ─── CDN imports ────────────────────────────────────────────────────────────
import {
  ref,
  push,
  get,
  set,
  update,
  remove,
  runTransaction,
  serverTimestamp,
  query,
  orderByChild,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

import { db } from '../firebase-config.js';

// ─── Constante da unidade ────────────────────────────────────────────────────
// Slug convertido para caminho RTDB: "raquel" → path "raquel"
// O caminho de lock usa o slug informado (ex.: "raquel")
const UNIDADE_PATH = slug => slug;          // extensível para multi-profissional

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Converte "HH:MM" em "HH-MM" para uso como chave RTDB (sem caracteres proibidos) */
function horaParaChave(hora) {
  return hora.replace(':', '-');
}

/** Inverte: "HH-MM" → "HH:MM" */
function chaveParaHora(chave) {
  return chave.replace('-', ':');
}

/** Referência de um lock específico */
function lockRef(unidadeSlug, dataISO, hora) {
  return ref(db, `slotLocks/${UNIDADE_PATH(unidadeSlug)}/${dataISO}/${horaParaChave(hora)}`);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Retorna os horários já bloqueados (pending ou confirmed) para uma data.
 *
 * @param {string} unidadeSlug  ex.: "raquel"
 * @param {string} dataISO      ex.: "2025-06-15"
 * @returns {Promise<{ hora: string }[]>}  lista de horários bloqueados
 */
export async function obterSlotsBloqueados(unidadeSlug, dataISO) {
  const snapshot = await get(
    ref(db, `slotLocks/${UNIDADE_PATH(unidadeSlug)}/${dataISO}`)
  );

  if (!snapshot.exists()) {
    console.log(`[slots] Nenhum lock encontrado para ${unidadeSlug}/${dataISO}`);
    return [];
  }

  // snapshot.val() = { "10-00": { bookingId, status }, "14-30": { … }, … }
  // Inclui data no retorno para compatibilidade com gerarHorarios()
  const ocupados = Object.keys(snapshot.val()).map(chave => ({
    data: dataISO,
    hora: chaveParaHora(chave),
  }));
  console.log(`[slots] ${ocupados.length} slot(s) bloqueado(s) em ${dataISO}:`, ocupados.map(o => o.hora));
  return ocupados;
}

/**
 * Cria um novo agendamento com prevenção de double-booking via transação.
 *
 * Algoritmo:
 *  1. runTransaction no slot lock
 *     - Se null  → escreve o lock (status: "pending")
 *     - Se ≠ null → aborta (slot já ocupado)
 *  2. Se committed → push dos dados em /bookings
 *
 * @param {{
 *   unidadeSlug:      string,
 *   servicoId:        number,
 *   servicoNome:      string,
 *   dataSelecionada:  string,
 *   horaSelecionada:  string,
 *   nomeCliente:      string,
 *   telefoneCliente:  string,
 * }} dados
 *
 * @returns {Promise<{ ok: true, bookingId: string } | { ok: false, conflito: boolean, erro: string }>}
 */
export async function criarAgendamento(dados) {
  const { unidadeSlug, dataSelecionada, horaSelecionada } = dados;
  const slotRef = lockRef(unidadeSlug, dataSelecionada, horaSelecionada);

  let bookingsRef;
  let committed  = false;

  try {
    // Reserva atômica do slot
    const resultado = await runTransaction(slotRef, currentData => {
      if (currentData !== null) {
        // Slot já ocupado — aborta a transação (retornando undefined)
        return undefined;
      }
      // Marcador temporário — será atualizado com o bookingId após push
      return { status: 'pending', bookingId: '__pendente__' };
    });

    committed = resultado.committed;
  } catch (err) {
    return { ok: false, conflito: false, erro: err.message };
  }

  if (!committed) {
    return {
      ok:       false,
      conflito: true,
      erro:     'Este horário acabou de ser reservado. Por favor, escolha outro.',
    };
  }

  // Persiste o agendamento completo
  try {
    bookingsRef = push(ref(db, 'bookings'));
    const bookingId = bookingsRef.key;

    await set(bookingsRef, {
      unidadeSlug,
      servicoId:       dados.servicoId,
      servicoNome:     dados.servicoNome,
      dataSelecionada,
      horaSelecionada,
      nomeCliente:     dados.nomeCliente,
      telefoneCliente: dados.telefoneCliente,
      status:          'pending',
      criadoEm:        serverTimestamp(),
    });

    // Atualiza o lock com o ID real
    await update(slotRef, { bookingId });

    return { ok: true, bookingId };
  } catch (err) {
    // Rollback do lock se o push falhou
    try { await remove(slotRef); } catch (_) { /* ignora */ }
    return { ok: false, conflito: false, erro: err.message };
  }
}

/**
 * Lista todos os agendamentos ordenados por data de criação (mais recentes primeiro).
 *
 * @returns {Promise<Array<{ id: string, [campo]: any }>>}
 */
export async function listarAgendamentos() {
  const snapshot = await get(
    query(ref(db, 'bookings'), orderByChild('criadoEm'))
  );

  if (!snapshot.exists()) return [];

  const lista = [];
  snapshot.forEach(child => {
    lista.push({ id: child.key, ...child.val() });
  });

  return lista.reverse();           // mais recentes primeiro
}

/**
 * Confirma um agendamento (admin): status → "confirmed".
 * O lock permanece ativo.
 *
 * @param {string} bookingId
 * @returns {Promise<void>}
 */
export async function confirmarAgendamento(bookingId) {
  await update(ref(db, `bookings/${bookingId}`), { status: 'confirmed' });

  // Atualiza o status no lock também (para futuras leituras de disponibilidade)
  const booking = (await get(ref(db, `bookings/${bookingId}`))).val();
  if (booking) {
    await update(
      lockRef(booking.unidadeSlug, booking.dataSelecionada, booking.horaSelecionada),
      { status: 'confirmed' }
    );
  }
}

/**
 * Rejeita um agendamento (admin): status → "rejected", lock removido.
 *
 * @param {string} bookingId
 * @returns {Promise<void>}
 */
export async function rejeitarAgendamento(bookingId) {
  await _finalizarAgendamento(bookingId, 'rejected');
}

/**
 * Cancela um agendamento (admin ou futuro fluxo de cliente):
 * status → "cancelled", lock removido.
 *
 * @param {string} bookingId
 * @returns {Promise<void>}
 */
export async function cancelarAgendamento(bookingId) {
  await _finalizarAgendamento(bookingId, 'cancelled');
}

// ─── Helpers privados ────────────────────────────────────────────────────────

// ─── Configuração de agenda ─────────────────────────────────────────────────

const CONFIG_PADRAO = {
  diasAtivos:   [1, 2, 3, 4, 5],   // 0=Dom … 6=Sáb
  horaInicio:   '09:00',
  horaFim:      '18:00',
  almocoInicio: '12:00',
  almocoFim:    '13:00',
  intervalo:    15,
};

/**
 * Busca a configuração de agenda do profissional no RTDB.
 * Retorna os valores padrão se não existir nenhuma configuração salva.
 * @param {string} unidadeSlug
 * @returns {Promise<object>}
 */
export async function obterConfigAgenda(unidadeSlug) {
  try {
    const snap = await get(ref(db, `config/${UNIDADE_PATH(unidadeSlug)}/agenda`));
    if (!snap.exists()) return { ...CONFIG_PADRAO };
    const val = snap.val();
    const diasAtivos = Array.isArray(val.diasAtivos)
      ? val.diasAtivos
      : Object.values(val.diasAtivos ?? {}).map(Number);
    return { ...CONFIG_PADRAO, ...val, diasAtivos };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

/**
 * Salva a configuração de agenda no RTDB (apenas admin autenticado).
 * @param {string} unidadeSlug
 * @param {object} config
 */
export async function salvarConfigAgenda(unidadeSlug, config) {
  await set(ref(db, `config/${UNIDADE_PATH(unidadeSlug)}/agenda`), config);
}

async function _finalizarAgendamento(bookingId, novoStatus) {
  const bookingSnap = await get(ref(db, `bookings/${bookingId}`));
  if (!bookingSnap.exists()) return;

  const b = bookingSnap.val();

  // Atualiza status do booking
  await update(ref(db, `bookings/${bookingId}`), { status: novoStatus });

  // Remove o lock → libera o slot
  await remove(lockRef(b.unidadeSlug, b.dataSelecionada, b.horaSelecionada));
}
