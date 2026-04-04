# Raquel Maia Massoterapeuta — Agendamento Online (MVP)

SPA estática de agendamento para **Raquel Maia Massoterapeuta**.
Funciona 100% no navegador, sem back-end, sem npm e sem bundlers.

---

## Como executar

### Opção 1 — VS Code Live Server (recomendado)

1. Instale a extensão **Live Server** (Ritwick Dey) no VS Code.
2. Abra a pasta `massoterapia/` no VS Code.
3. Clique com o botão direito em `index.html` → **Open with Live Server**.
4. Acesse `http://127.0.0.1:5500` no navegador.

> ⚠️ O projeto usa ES Modules (`type="module"`). Abrir o `index.html`
> diretamente como `file://` **não funcionará** — é necessário um servidor.

### Opção 2 — Python (qualquer sistema)

```bash
# Python 3
python3 -m http.server 8080
# Acesse: http://localhost:8080
```

### Opção 3 — Node.js (sem instalar nada extra)

```bash
npx serve .
# Acesse: http://localhost:3000
```

---

## Estrutura do projeto

```
massoterapia/
├── index.html                          # Shell HTML da SPA
├── styles/
│   └── main.css                        # Estilos globais (tema claro/escuro)
├── scripts/
│   ├── app.js                          # Ponto de entrada — inicializa o router
│   ├── router.js                       # Roteamento por hash (#)
│   ├── state.js                        # Estado da sessão (sessionStorage)
│   ├── data/
│   │   ├── mock-repository.js          # Dados fictícios (MVP)
│   │   ├── mock-repository.js          # Catálogo de serviços e helpers de horário
│   │   ├── firebase-repository.js      # Camada RTDB: bookings + slot locks
│   │   └── firebase-repository.example.js  # Arquivo legado (pode remover)
│   ├── firebase-config.js              # Inicialização do Firebase (preencher credenciais)
│   └── views/
│       ├── inicio.js                   # Página inicial — lista de profissionais
│       ├── unidade.js                  # Serviços do profissional + busca
│       ├── agendar.js                  # Escolha de data e horário (async RTDB)
│       ├── confirmar.js                # Resumo + formulário + transação anti-duplo
│       ├── sucesso.js                  # Confirmação de agendamento
│       └── admin.js                    # Painel admin (Auth + dashboard)
├── database.rules.json.example        # Regras de segurança RTDB (exemplo)
└── README.md
```

---

## Rotas disponíveis

| Hash              | Descrição                                |
|-------------------|------------------------------------------|
| `#/inicio`        | Página inicial com a profissional           |
| `#/unidade/raquel`| Serviços de Raquel Maia                  |
| `#/agendar`       | Picker de data + grade de horários       |
| `#/confirmar`     | Resumo e dados do cliente                |
| `#/sucesso`       | Comprovante de agendamento               |
| `#/admin`         | Painel admin — login + dashboard         |

---

## Fluxo de agendamento

```
#/inicio → #/unidade/raquel → #/agendar → #/confirmar → #/sucesso
```

1. **Início:** escolha o profissional.
2. **Serviços:** veja os serviços disponíveis, use a busca, selecione um.
3. **Agendar:** escolha o dia (próximos 14 dias úteis) e o horário disponível.
4. **Confirmar:** revise o resumo, informe nome e telefone, confirme.
5. **Sucesso:** comprovante exibido; state é limpo automaticamente.

---

## Regras de horário (mock)

- Segunda a sexta, **09:00 – 18:00**
- Intervalo de almoço: **12:00 – 13:00** (sem agendamentos)
- Intervalos de **15 minutos** entre os slots
- Duração do serviço é respeitada (slot não ultrapassa 18:00)
- Alguns horários são marcados como ocupados via `mock-repository.js`

---

## Configuração do Firebase

O projeto usa **Firebase Realtime Database** para persistência e **Firebase Auth
(Email/Password)** para o painel administrativo.

### 1. Criar o projeto

1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Clique em **Adicionar projeto** e siga o assistente.
3. Na visão geral do projeto, clique em **</>** (Web) para registrar o app.
4. Copie o objeto `firebaseConfig` gerado.

### 2. Habilitar o Realtime Database

1. No console → **Build → Realtime Database → Criar banco de dados**.
2. Escolha a região (ex.: `southamerica-east1`) e inicie em **modo de teste**.
3. Configure as regras de segurança (veja o próximo passo).

### 3. Configurar as regras de segurança

Copie o conteúdo de `database.rules.json.example` para o editor de regras
do Firebase Console (ou use o Firebase CLI):

```bash
# Com Firebase CLI instalado:
cp database.rules.json.example database.rules.json
firebase deploy --only database
```

Essas regras garantem:
- Leituras de `slotLocks` por qualquer visitante (disponibilidade).
- Escrita de novos agendamentos por qualquer visitante (fluxo de booking).
- Leitura e atualização de agendamentos somente por admin autenticado.

### 4. Habilitar Authentication (Email/Password)

1. No console → **Build → Authentication → Primeiros passos**.
2. Vá em **Método de login → E-mail/senha → Habilitar**.
3. Vá em **Usuários → Adicionar usuário** e crie a conta da Raquel:
   - E-mail: (ex.: `raquel@raquelmaia.com.br`)
   - Senha: (defina uma senha forte)

### 5. Preencher as credenciais no código

Edite `scripts/firebase-config.js` e substitua os placeholders pelo objeto
`firebaseConfig` copiado no passo 1:

```js
const firebaseConfig = {
  apiKey:            'AIzaSy...',
  authDomain:        'meu-projeto.firebaseapp.com',
  databaseURL:       'https://meu-projeto-default-rtdb.firebaseio.com',
  projectId:         'meu-projeto',
  storageBucket:     'meu-projeto.appspot.com',
  messagingSenderId: '123456789',
  appId:             '1:123...',
};
```

### 6. Testar localmente

Inicie com Live Server (ou `python3 -m http.server 8080`) e acesse `#/admin`.
Faça login com a conta criada no passo 4. Agendamentos criados por clientes
aparecerão automaticamente no dashboard.

---

## Esquema do Realtime Database

```
/bookings/{bookingId}
  unidadeSlug:      "raquel"
  servicoId:        3
  servicoNome:      "Bambuterapia"
  dataSelecionada:  "2025-07-10"
  horaSelecionada:  "10:00"
  nomeCliente:      "Maria Oliveira"
  telefoneCliente:  "(31) 99000-0001"
  status:           "pending" | "confirmed" | "rejected" | "cancelled"
  criadoEm:         <serverTimestamp>

/slotLocks/{unidadeSlug}/{date}/{time}
  bookingId: "-NxABCDEF..."
  status:    "pending" | "confirmed"
  (ausente = slot livre)
```

O campo `time` usa `HH-MM` (hífen) como chave RTDB (ex.: `10-00` para 10h).

---

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub.
2. Faça `git push` da pasta `massoterapia/` para `main`.
3. Vá em **Settings → Pages → Source: Deploy from branch → main / root**.
4. Acesse `https://seu-usuario.github.io/nome-do-repo/`.

> O roteamento por hash (`#/rota`) funciona nativamente em páginas estáticas
> sem nenhuma configuração extra de servidor.

---

## Tecnologias usadas

- HTML5 semântico
- CSS3 com Custom Properties (tema claro/escuro automático)
- JavaScript ES Modules (vanilla, sem frameworks)
- sessionStorage para persistência da sessão
- Nenhuma instalação necessária

---

## Validar funcionamento

Após abrir com Live Server, verifique:

- [ ] `#/inicio` carrega hero com "Desconecte do estresse", bloco de contato e card de Raquel Maia
- [ ] Tema claro com fundo off-white e destaque sage green
- [ ] Clicar no card navega para `#/unidade/raquel`
- [ ] Card institucional (Especialista em Reabilitação) aparece em dourado, sem botão de agendar
- [ ] Serviços com preço numérico exibem R$; Massagem Clínica e Terapêutica exibem "Sob consulta"
- [ ] Botão WhatsApp verde abre `wa.me/5531983388072` com mensagem pré-preenchida
- [ ] Busca filtra serviços por nome e descrição em tempo real
- [ ] Selecionar um serviço agendável vai para `#/agendar`
- [ ] Selector de data mostra os próximos 14 dias úteis (sem fins de semana)
- [ ] Selecionar uma data exibe "Verificando disponibilidade…" e depois os horários
- [ ] Horários ocupados (RTDB) aparecem desabilitados e não são clicáveis
- [ ] Selecionar data + hora e clicar "Continuar" navega para `#/confirmar`
- [ ] Formulário valida nome (≥ 3 chars) e telefone (≥ 10 dígitos) com erros inline
- [ ] Confirmar executa transação RTDB; em conflito exibe erro inline sem navegar
- [ ] Em caso de sucesso navega para `#/sucesso` com o comprovante
- [ ] Botão "Confirmar pelo WhatsApp" abre WhatsApp com dados do agendamento
- [ ] `#/admin` exibe formulário de login; após autenticação mostra dashboard
- [ ] Dashboard lista agendamentos com abas Pendentes / Confirmados / Rejeitados / Cancelados
- [ ] Ações Confirmar / Rejeitar / Cancelar atualizam o status no RTDB
- [ ] Tema escuro automático (ativar dark mode no sistema operacional)
- [ ] Tudo funciona no mobile (teste com DevTools → Toggle device toolbar)
