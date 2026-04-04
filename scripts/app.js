/**
 * app.js — Ponto de entrada da aplicação
 *
 * Importa e inicializa o router.
 * Adiciona redirecionamento padrão caso a URL não tenha hash.
 *
 * TODO (Firebase): Inicializar o SDK do Firebase aqui quando
 *       a integração real for implementada:
 *         import { initializeApp } from "https://...firebase-app.js";
 *         initializeApp(firebaseConfig);
 */

import { iniciarRouter } from './router.js';

// Se não houver hash, redireciona para #/inicio
if (!window.location.hash || window.location.hash === '#') {
  window.location.hash = '#/inicio';
}

iniciarRouter();
