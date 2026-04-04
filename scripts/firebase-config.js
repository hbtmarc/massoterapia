/**
 * firebase-config.js — Inicialização do Firebase (CDN ESM, browser-only)
 *
 * ⚠️  Preencha o objeto firebaseConfig com os valores do seu projeto.
 *     Firebase Console → Configurações do projeto → Seus aplicativos
 *
 * Versão pinada: 12.11.0  (atualize também em firebase-repository.js)
 */

// ─── CDN imports ────────────────────────────────────────────────────────────
import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';

import { getDatabase }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

import { getAuth }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

// ─── Configuração do projeto ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAuZ_RWLLn26CqUy3zpyz75_IuQSVQti2k',
  authDomain:        'projectshub-marc35.firebaseapp.com',
  databaseURL:       'https://projectshub-marc35-default-rtdb.firebaseio.com',
  projectId:         'projectshub-marc35',
  storageBucket:     'projectshub-marc35.firebasestorage.app',
  messagingSenderId: '949883815683',
  appId:             '1:949883815683:web:5587323363e09957b34b36',
  measurementId:     'G-K941SY93Z8',
};

// ─── Instâncias exportadas ────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);
