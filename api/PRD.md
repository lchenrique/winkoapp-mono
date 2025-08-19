Beleza 👊 vou expandir o **PRD** e incluir a **lista de rotas REST** (para CRUD e integrações) + os **eventos WebSocket** (para realtime).
Assim você já tem um documento fechado, pronto para guiar a implementação.

---

# 📄 **PRD – Chat estilo WhatsApp (Fastify + Zod + Swagger)**

## 🎯 Objetivo

Criar uma API de chat em tempo real, estilo WhatsApp, com **Fastify + Zod Provider + Swagger**, usando **Postgres, Redis, MinIO e Socket.IO**.

---

## 📌 Funcionalidades (MVP)

* Autenticação JWT
* Usuários com perfil
* Contatos
* Conversas (privadas e grupos)
* Mensagens (texto, emojis, mídia)
* Reações
* Status de mensagens (enviada, entregue, lida)
* Upload de mídia em MinIO
* Notificações em tempo real com Socket.IO
* Todas rotas validadas com **Zod**
* Documentação em **Swagger**

---

## 📌 Infraestrutura

* **Backend**: Node.js + Fastify
* **Validação**: Zod Provider
* **Documentação**: Swagger
* **Banco de dados**: PostgreSQL
* **Cache/Presença**: Redis
* **Storage**: MinIO
* **Realtime**: Socket.IO

---

## 📂 Estrutura de dados (resumida)

(igual ao que definimos antes: `users`, `contacts`, `conversations`, `conversation_members`, `messages`, `message_reactions`).

---

## 📌 Rotas REST (com validação Zod + Swagger)

### 🔐 Autenticação

* `POST /auth/register` → Criar conta
* `POST /auth/login` → Login (gera JWT)
* `POST /auth/logout` → Logout

### 👤 Usuário

* `GET /users/me` → Retorna perfil do usuário logado
* `PATCH /users/me` → Atualiza nome, avatar, status
* `GET /users/:id` → Retorna perfil público de um usuário

### 👥 Contatos

* `POST /contacts` → Adiciona contato
* `DELETE /contacts/:id` → Remove contato
* `GET /contacts` → Lista contatos

### 🗨️ Conversas

* `POST /conversations` → Cria conversa (privada ou grupo)
* `GET /conversations` → Lista conversas do usuário
* `GET /conversations/:id` → Detalhes da conversa
* `POST /conversations/:id/members` → Adiciona membro (grupo)
* `DELETE /conversations/:id/members/:userId` → Remove membro

### 💬 Mensagens

* `POST /conversations/:id/messages` → Envia mensagem (texto ou mídia)
* `GET /conversations/:id/messages` → Lista mensagens (paginado)
* `PATCH /messages/:id` → Edita mensagem (opcional)
* `DELETE /messages/:id` → Apaga mensagem

### 😀 Reações

* `POST /messages/:id/reactions` → Adiciona reação (emoji)
* `DELETE /messages/:id/reactions/:reactionId` → Remove reação

### 📂 Upload (MinIO)

* `POST /upload` → Upload de arquivo → retorna URL pública

---

## 📌 Eventos WebSocket (Socket.IO)

### 🔐 Autenticação

* `connect` → autenticação via token JWT no handshake
* `disconnect` → saída do usuário

### 👤 Presença

* `presence:online` → usuário ficou online
* `presence:offline` → usuário ficou offline

### 💬 Mensagens

* `message:new` → nova mensagem enviada
* `message:delivered` → mensagem entregue ao destinatário
* `message:read` → mensagem lida
* `message:deleted` → mensagem apagada

### 😀 Reações

* `reaction:added` → nova reação em mensagem
* `reaction:removed` → reação removida

### 🗨️ Conversas

* `conversation:created` → nova conversa criada
* `conversation:member_added` → novo membro em grupo
* `conversation:member_removed` → membro removido do grupo

---

## 📌 Decisão sobre Criptografia

* **Não no MVP**.
* Adicionar em **Fase 2** (E2EE com libsodium/Signal Protocol).

---

## ✅ MVP – Primeira Entrega

* Usuário cria conta, faz login, adiciona contatos.
* Pode criar conversa 1:1 ou grupo.
* Pode mandar mensagens (texto, emojis, mídia).
* Pode reagir a mensagens.
* Mensagens têm status (enviada/entregue/lida).
* Tudo em tempo real com Socket.IO.
* Upload de mídia para MinIO.
* Rotas validadas com **Zod**.
* Documentação automática com **Swagger**.

---

👉 Quer que eu já monte também um **esqueleto inicial do projeto em Fastify (com Swagger e ZodProvider configurados)** pra você ter como ponto de partida do código?
