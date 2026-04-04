/**
 * firebase-repository.example.js — Modelo para integração com Firebase RTDB
 *
 * ⚠️  Este arquivo NÃO é importado pela aplicação atual.
 *     Ele serve como guia para implementar a camada real de dados
 *     quando o Firebase Realtime Database estiver configurado.
 *
 * Como usar:
 *  1. Configure o Firebase no arquivo firebase.js (a criar) via CDN.
 *  2. Substitua as importações de mock-repository.js por este arquivo
 *     nos views que buscam dados.
 *  3. Remova os dados mock.
 *
 * TODO (Firebase): Importar o SDK via CDN no index.html:
 *   <script type="module">
 *     import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
 *     import { getDatabase }   from "https://www.gstatic.com/firebasejs/10.x.x/firebase-database.js";
 *   </script>
 */

// TODO (Firebase): Preencher com os dados do seu projeto Firebase Console
const firebaseConfig = {
  apiKey:            'SUA_API_KEY',
  authDomain:        'SEU_PROJETO.firebaseapp.com',
  databaseURL:       'https://SEU_PROJETO-default-rtdb.firebaseio.com',
  projectId:         'SEU_PROJETO',
  storageBucket:     'SEU_PROJETO.appspot.com',
  messagingSenderId: 'SEU_SENDER_ID',
  appId:             'SUA_APP_ID',
};

// TODO (Firebase): Inicializar o app —
//   import { initializeApp } from "firebase/app";
//   import { getDatabase, ref, get, set, push } from "firebase/database";
//   const app = initializeApp(firebaseConfig);
//   const db  = getDatabase(app);

/* ============================================================
   Leitura de dados
   ============================================================ */

/**
 * Busca todos os serviços de uma unidade no RTDB.
 *
 * Estrutura esperada no RTDB:
 *   /unidades/{slug}/servicos/{id}: { nome, duracao, preco }
 *
 * TODO (Firebase): descomentar e usar:
 *
 *   export async function obterServicos(slug) {
 *     const snapshot = await get(ref(db, `unidades/${slug}/servicos`));
 *     if (!snapshot.exists()) return [];
 *     return Object.entries(snapshot.val()).map(([id, val]) => ({ id, ...val }));
 *   }
 */
export function obterServicos(_slug) {
  throw new Error('firebase-repository.example.js não está ativo. Use mock-repository.js.');
}

/**
 * Busca os horários ocupados para uma data específica.
 *
 * Estrutura esperada no RTDB:
 *   /agendamentos/{slug}/{dataISO}/{hora}: { nomeCliente, servicoId, ... }
 *
 * TODO (Firebase): descomentar e usar:
 *
 *   export async function obterOcupados(slug, dataISO) {
 *     const snapshot = await get(ref(db, `agendamentos/${slug}/${dataISO}`));
 *     if (!snapshot.exists()) return [];
 *     return Object.keys(snapshot.val()).map(hora => ({ data: dataISO, hora }));
 *   }
 */
export function obterOcupados(_slug, _dataISO) {
  throw new Error('firebase-repository.example.js não está ativo.');
}

/* ============================================================
   Escrita de dados
   ============================================================ */

/**
 * Cria um novo agendamento no RTDB.
 *
 * TODO (Firebase): descomentar e usar:
 *
 *   export async function criarAgendamento(slug, agendamento) {
 *     // agendamento: { nomeCliente, telefone, servicoId, data, hora }
 *     const caminho = `agendamentos/${slug}/${agendamento.data}/${agendamento.hora}`;
 *     await set(ref(db, caminho), agendamento);
 *   }
 */
export function criarAgendamento(_slug, _agendamento) {
  throw new Error('firebase-repository.example.js não está ativo.');
}
