/**
 * mock-repository.js — Dados locais para o MVP
 *
 * Profissional: Raquel Maia Massoterapeuta
 * Quando o Firebase estiver pronto, esses dados virão do RTDB.
 *
 * TODO (Firebase): remover este arquivo e usar firebase-repository.js.
 */

/* ============================================================
   Informações do negócio
   ============================================================ */
export const negocio = {
  nome:      'Raquel Maia Massoterapeuta',
  slogan:    'Desconecte do estresse. Conecte-se com você.',
  tagline:   'Recomeçar também é coragem ❤️',
  aviso:     'Somente com hora marcada',
  email:     'teraquelmaia@gmail.com',
  whatsapp:  '5531983388072',            // dígitos apenas — para wa.me/5531983388072
  whatsappDisplay: '+55 31 98338-8072', // exibido ao usuário
  instagram: '',
};

/* ============================================================
   Catálogo de serviços
   bookable: false = card institucional, não abre o fluxo de agendamento
   precoTexto: substitui o valor numérico na exibição
   ============================================================ */
export const servicos = [
  {
    id:         0,
    icone:      '🌿',
    nome:       'Especialista em Reabilitação e Bem-Estar Muscular',
    descricao:  'Seu corpo fala. Eu ajudo você a ouvir, tratar e restaurar.',
    duracao:    null,
    preco:      null,
    precoTexto: null,
    bookable:   false,   // card institucional — sem botão de agendar
  },
  {
    id:         1,
    icone:      '🩺',
    nome:       'Massagem Clínica',
    descricao:  'Técnicas específicas para tratamento de dores, pontos-gatilho e sobrecarga muscular. Resultados reais desde as primeiras sessões.',
    duracao:    60,
    preco:      null,
    precoTexto: 'Sob consulta',
    bookable:   true,
  },
  {
    id:         2,
    icone:      '✨',
    nome:       'Massagem Terapêutica',
    descricao:  'Alívio de dores, redução do estresse e relaxamento profundo. Agende o seu horário e sinta a diferença já na primeira sessão.',
    duracao:    60,
    preco:      null,
    precoTexto: 'Sob consulta',
    bookable:   true,
  },
  {
    id:         3,
    icone:      '🎋',
    nome:       'Bambuterapia',
    descricao:  'Massagem com bambus aquecidos que proporciona relaxamento profundo, melhora a circulação e alivia as tensões musculares.',
    duracao:    60,
    preco:      100,
    precoTexto: null,
    bookable:   true,
  },
  {
    id:         4,
    icone:      '💧',
    nome:       'Drenagem Linfática',
    descricao:  'Técnica leve e ritmíca que estimula o sistema linfático, reduz inchaço e melhora a imunidade.',
    duracao:    60,
    preco:      100,
    precoTexto: null,
    bookable:   true,
  },
  {
    id:         5,
    icone:      '🦶',
    nome:       'Spa dos Pés',
    descricao:  'Tratamento relaxante focado nos pés: hidratação, massagem e cuidado completo para aliviar o cansaço do dia a dia.',
    duracao:    45,
    preco:      80,
    precoTexto: null,
    bookable:   true,
  },
  {
    id:         6,
    icone:      '🌬️',
    nome:       'Ventosaterapia + Massagem',
    descricao:  'Combinação de ventosas e massagem para liberar tensões profundas, melhorar a circulação e aliviar dores crônicas.',
    duracao:    60,
    preco:      100,
    precoTexto: null,
    bookable:   true,
  },
  {
    id:         7,
    icone:      '🕊️',
    nome:       'Massagem Relaxante',
    descricao:  'Sessão de relaxamento total com movimentos suaves e contínuos para liberar a tensão e renovar as energias.',
    duracao:    60,
    preco:      100,
    precoTexto: null,
    bookable:   true,
  },
  {
    id:         8,
    icone:      '🏠',
    nome:       'Atendimento em Domicílio',
    descricao:  'Receba o atendimento no conforto da sua casa. Pacote de 5 sessões com agenda flexível.',
    duracao:    60,
    preco:      490,
    precoTexto: 'R$ 490 / 5 sessões',
    bookable:   true,
  },
];

/* ============================================================
   Profissionais / Unidades
   ============================================================ */
export const unidades = [
  {
    slug:          'raquel',
    nome:          'Raquel Maia',
    especialidade: 'Massoterapeuta • Reabilitação e Bem-Estar',
    iniciais:      'RM',
    bio:           'Especialista em reabilitação e bem-estar muscular. Seu corpo fala — eu ajudo você a ouvir, tratar e restaurar. Atendimento humanizado, somente com hora marcada.',
    servicosIds:   [0, 1, 2, 3, 4, 5, 6, 7, 8],
  },
];

/* ============================================================
   Horários já ocupados (mock)
   Formato: { data: "YYYY-MM-DD", hora: "HH:MM" }
   ============================================================ */
export const horariosMockOcupados = [
  // Preenche alguns slots nos próximos dias para simular ocupação
  ..._gerarOcupadosMock(),
];

/**
 * Gera alguns horários ocupados fictícios nos próximos 14 dias.
 * @private
 */
function _gerarOcupadosMock() {
  const ocupados = [];
  const hoje = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dataStr = _isoDate(d);

    // Ocupa 3 horários por dia de forma determinística
    ['10:00', '14:00', '16:30'].forEach(hora => {
      if (Math.abs(i * 7 + Number(hora.split(':')[0])) % 3 !== 0) {
        ocupados.push({ data: dataStr, hora });
      }
    });
  }

  return ocupados;
}

/* ============================================================
   Funções utilitárias de horários
   ============================================================ */

/**
 * Retorna os dias úteis dos próximos 14 dias como strings "YYYY-MM-DD".
 * @returns {string[]}
 */
/**
 * @param {number[]} diasAtivos  — índices de dias da semana ativos (0=Dom, 1=Seg, …)
 */
export function obterProximos14DiasUteis(diasAtivos = [1, 2, 3, 4, 5]) {
  const dias = [];
  const hoje = new Date();

  for (let i = 0; i < 90; i++) {
    if (dias.length >= 14) break;
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    if (diasAtivos.includes(d.getDay())) {
      dias.push(_isoDate(d));
    }
  }

  return dias;
}

/**
 * Gera todos os horários de um dia para um serviço específico,
 * marcando quais estão ocupados.
 *
 * Regras:
 *  - Segunda a sexta, 09:00 – 18:00
 *  - Intervalo de almoço: 12:00 – 13:00 (slot não inicia durante ou
 *    se terminar nesse período)
 *  - Intervalo entre slots: 15 min
 *  - Impede slot cujo horário de término ultrapassa 18:00
 *
 * @param {string} dataISO   — "YYYY-MM-DD"
 * @param {number} duracao   — duração do serviço em minutos
 * @param {Array}  ocupados  — array de { data, hora } mock/firebase
 * @returns {{ hora: string, disponivel: boolean }[]}
 */
/**
 * @param {string} dataISO   — "YYYY-MM-DD"
 * @param {number} duracao   — duração do serviço em minutos
 * @param {Array}  ocupados  — array de { hora } ou { data, hora }
 * @param {object|null} config — configuração de agenda (opcional, usa defaults se null)
 */
export function gerarHorarios(dataISO, duracao, ocupados = [], config = null) {
  function _hhmm(s) {
    const [h = 0, m = 0] = (s || '').split(':').map(Number);
    return h * 60 + m;
  }

  const diasAtivos = config?.diasAtivos ?? [1, 2, 3, 4, 5];
  const INICIO     = _hhmm(config?.horaInicio   ?? '09:00');
  const FIM        = _hhmm(config?.horaFim       ?? '18:00');
  const ALMOCO_INI = _hhmm(config?.almocoInicio  ?? '12:00');
  const ALMOCO_FIM = _hhmm(config?.almocoFim     ?? '13:00');
  // intervalo = 0 → sessões consecutivas (passo = duração do serviço)
  const raw        = config?.intervalo ?? 15;
  const INTERVALO  = raw === 0 ? duracao : raw;

  const date = new Date(dataISO + 'T00:00:00');
  if (!diasAtivos.includes(date.getDay())) return [];

  const horarios = [];

  for (let min = INICIO; min + duracao <= FIM; min += INTERVALO) {
    const fimSlot = min + duracao;

    // Pula slots que caem no horário de almoço
    if (min >= ALMOCO_INI && min < ALMOCO_FIM) continue;
    if (min < ALMOCO_INI && fimSlot > ALMOCO_INI) continue;

    const hora = _minToHH(min);
    const ocupado = ocupados.some(o => {
      if (o.data !== undefined) return o.data === dataISO && o.hora === hora;
      return o.hora === hora;
    });

    horarios.push({ hora, disponivel: !ocupado });
  }

  return horarios;
}

/* ============================================================
   Helpers privados
   ============================================================ */

/** Converte minutos (ex: 570) para string "HH:MM" */
function _minToHH(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Converte Date para "YYYY-MM-DD" usando timezone local */
function _isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
