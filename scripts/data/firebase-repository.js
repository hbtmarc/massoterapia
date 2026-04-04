/**
 * firebase-repository.js — Camada de dados real (Firebase RTDB + Auth)
 *
 * Esquema RTDB:
 *   /bookings/{bookingId}                      — registro completo do agendamento
 *     ├ duracao        (minutos)
 *     ├ horaSelecionada / horaFim
 *     ├ slots          (["09-00","09-15","09-30","09-45"]) — chaves reservadas
 *     └ status         pending | confirmed | rejected | cancelled
 *
 *   /slotLocks/{unidadeSlug}/{YYYY-MM-DD}/{HH-MM}
 *                                              — lock at\u00f4mico de cada fatia de 15 min
 *                                                ex.: 09:00 + 60 min \u2192 4 chaves
 *
 * Prote\u00e7\u00e3o contra double-booking:
 *   A transa\u00e7\u00e3o em criarAgendamento opera no n\u00f3 do DIA inteiro,
 *   verificando E reservando todas as fatias atomicamente.
 *
 * Libera\u00e7\u00e3o de slots:
 *   status "pending" ou "confirmed"   \u2192 fatias bloqueadas
 *   status "rejected" ou "cancelled"  \u2192 TODAS as fatias removidas (bloco liberado)
 *
 * Vers\u00e3o Firebase pinada: 12.11.0  (manter em sincronia com firebase-config.js)
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

import {
  hhmm,
  minToHH,
  horaParaChave,
  chaveParaHora,
  expandirSlots,
} from './slot-utils.js';

// ─── Constante da unidade ────────────────────────────────────────────────────
// Slug convertido para caminho RTDB: "raquel" → path "raquel"
// O caminho de lock usa o slug informado (ex.: "raquel")
const UNIDADE_PATH = slug => slug;          // extensível para multi-profissional

// ─── Helpers internos ────────────────────────────────────────────────────────
// horaParaChave / chaveParaHora / expandirSlots vêm de slot-utils.js

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
  const { unidadeSlug, dataSelecionada, horaSelecionada, duracao } = dados;

  // Todas as fatias de 15 min que este agendamento ocupa
  // Ex.: 09:00 + 60 min → ["09-00","09-15","09-30","09-45"]
  const slots   = expandirSlots(horaSelecionada, duracao);
  const horaFim = minToHH(hhmm(horaSelecionada) + duracao);
  const dayRef  = ref(db, `slotLocks/${UNIDADE_PATH(unidadeSlug)}/${dataSelecionada}`);

  let committed = false;

  // Transação atômica no nó do DIA inteiro:
  // verifica E reserva todas as fatias de uma só vez.
  // Se qualquer fatia estiver ocupada → aborta (retorna undefined).
  try {
    const resultado = await runTransaction(dayRef, currentDay => {
      const day = currentDay || {};

      // Verificar: todas as fatias devem estar livres
      for (const key of slots) {
        if (day[key] != null) return undefined; // aborta — slot já tomado
      }

      // Reservar: marca cada fatia como pendente
      const newDay = { ...day };
      for (const key of slots) {
        newDay[key] = { bookingId: '__pendente__', status: 'pending' };
      }
      return newDay;
    });

    committed = resultado.committed;
  } catch (err) {
    return { ok: false, conflito: false, erro: err.message };
  }

  if (!committed) {
    return {
      ok:       false,
      conflito: true,
      erro:     'Este horário foi reservado agora por outro cliente. Por favor, escolha outro.',
    };
  }

  // Persiste o agendamento completo
  let bookingId;
  try {
    const bookingsRef = push(ref(db, 'bookings'));
    bookingId = bookingsRef.key;

    await set(bookingsRef, {
      unidadeSlug,
      servicoId:       dados.servicoId,
      servicoNome:     dados.servicoNome,
      duracao,
      dataSelecionada,
      horaSelecionada,
      horaFim,
      slots,               // ex.: ["09-00","09-15","09-30","09-45"]
      nomeCliente:     dados.nomeCliente,
      telefoneCliente: dados.telefoneCliente,
      status:          'pending',
      criadoEm:        serverTimestamp(),
    });

    // Atualiza cada fatia com o ID real do agendamento
    const lockUpdates = {};
    for (const key of slots) {
      lockUpdates[key] = { bookingId, status: 'pending' };
    }
    await update(dayRef, lockUpdates);

    return { ok: true, bookingId };
  } catch (err) {
    // Rollback: libera todas as fatias reservadas
    try {
      const rollback = {};
      for (const key of slots) { rollback[key] = null; }
      await update(dayRef, rollback);
    } catch (rollbackErr) {
      console.error('[booking] rollback falhou, slots podem estar presos:', rollbackErr);
    }
    return { ok: false, conflito: false, erro: err.message };
  }
}

/**
 * Lista todos os agendamentos ordenados por data de criação (mais recentes primeiro).
 *
 * @returns {Promise<Array<{ id: string, [campo]: any }>>}
 */
export async function listarAgendamentos() {
  let snapshot;
  try {
    snapshot = await get(query(ref(db, 'bookings'), orderByChild('criadoEm')));
  } catch (err) {
    if (err.message && err.message.includes('Index not defined')) {
      console.warn('[bookings] Índice ausente no Firebase — ordenando em memória...');
      snapshot = await get(ref(db, 'bookings'));
    } else {
      throw err;
    }
  }

  if (!snapshot.exists()) {
    console.log('[bookings] Nó /bookings vazio ou ausente no RTDB.');
    return [];
  }

  const lista = [];
  snapshot.forEach(child => lista.push({ id: child.key, ...child.val() }));
  lista.sort((a, b) => (b.criadoEm ?? 0) - (a.criadoEm ?? 0));
  console.log(`[bookings] ${lista.length} agendamento(s) carregado(s).`);
  return lista;
}

/**
 * Exclui permanentemente um agendamento rejeitado do RTDB.
 * Só deve ser chamada para bookings com status "rejected".
 *
 * @param {string} bookingId
 * @returns {Promise<void>}
 */
export async function deletarAgendamento(bookingId) {
  await remove(ref(db, `bookings/${bookingId}`));
  console.log(`[bookings] Agendamento ${bookingId} excluído.`);
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

  const booking = (await get(ref(db, `bookings/${bookingId}`))).val();
  if (booking) {
    const dayRef = ref(db, `slotLocks/${UNIDADE_PATH(booking.unidadeSlug)}/${booking.dataSelecionada}`);
    const slots  = _resolverSlots(booking);
    const lockUpdates = {};
    for (const key of slots) {
      lockUpdates[key] = { bookingId, status: 'confirmed' };
    }
    await update(dayRef, lockUpdates);
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

/**
 * Retorna o array de chaves de fatias ("HH-MM") de um agendamento.
 * Usa booking.slots quando disponível (novos); reconstrói via duracao para legados.
 */
function _resolverSlots(booking) {
  if (Array.isArray(booking.slots) && booking.slots.length > 0) return booking.slots;
  return expandirSlots(booking.horaSelecionada, booking.duracao || 60);
}

async function _finalizarAgendamento(bookingId, novoStatus) {
  const bookingSnap = await get(ref(db, `bookings/${bookingId}`));
  if (!bookingSnap.exists()) return;

  const b = bookingSnap.val();

  // Atualiza status do booking
  await update(ref(db, `bookings/${bookingId}`), { status: novoStatus });

  // Remove TODAS as fatias reservadas — libera o bloco inteiro
  const slots  = _resolverSlots(b);
  const dayRef = ref(db, `slotLocks/${UNIDADE_PATH(b.unidadeSlug)}/${b.dataSelecionada}`);
  const removes = {};
  for (const key of slots) { removes[key] = null; }
  await update(dayRef, removes);
}

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
  } catch (err) {
    console.error('[config] Erro ao ler configAgenda — verifique as regras do RTDB:', err.message);
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
