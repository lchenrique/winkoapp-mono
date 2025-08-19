# 💬 WhatsApp-like Chat API

API de chat em tempo real inspirada no WhatsApp, desenvolvida com **Node.js**, **Fastify**, **Socket.IO**, **PostgreSQL**, **Redis** e **MinIO**.

## ✨ Funcionalidades

### MVP Implementado:
- 🔐 **Autenticação JWT** (registro/login com email ou telefone)
- 👤 **Perfil do usuário** (nome, avatar, status, última visualização)
- 👥 **Sistema de contatos** (adicionar/remover)
- 💬 **Conversas privadas e grupos**
- 📝 **Mensagens de texto** com suporte a emojis
- 😍 **Reações em mensagens** (👍❤️😂🔥)
- 📎 **Upload de mídia** (imagem, vídeo, áudio, documento)
- ✅ **Status das mensagens** (enviada, entregue, lida)
- ⚡ **Notificações em tempo real** com Socket.IO
- 🔍 **Validação com Zod** em todas as rotas
- 📚 **Documentação automática** com Swagger
- 🐳 **Docker** para desenvolvimento

## 🛠 Stack Tecnológica

- **Backend**: Node.js + Fastify
- **Validação**: Zod Provider
- **Documentação**: Swagger UI
- **Banco de dados**: PostgreSQL + Drizzle ORM
- **Cache/Presença**: Redis
- **Storage**: MinIO (S3-compatible)
- **Tempo real**: Socket.IO
- **Autenticação**: JWT
- **TypeScript**: Tipagem completa

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 18+
- Docker e Docker Compose
- Git

### 1. Clone o repositório
```bash
git clone <repository-url>
cd whatsapp-api
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` conforme necessário:
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsapp_chat

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=chat-files
MINIO_USE_SSL=false

# Server
PORT=3000
HOST=localhost

# Upload limits
MAX_FILE_SIZE=10485760  # 10MB
```

### 3. Instalar dependências
```bash
pnpm install
```

### 4. Iniciar serviços (PostgreSQL, Redis, MinIO)
```bash
docker-compose up -d
```

### 5. Gerar e executar migrações
```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Iniciar o servidor
```bash
# Desenvolvimento (com hot reload)
pnpm dev

# Produção
pnpm build
pnpm start

# Ou use o setup automático:
pnpm setup
```

### 7. Acessar a aplicação
- **API**: http://localhost:3000
- **Documentação**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## 📖 Uso da API

### Autenticação

#### Registrar usuário
```bash
POST /api/auth/register
{
  "email": "user@example.com",  # ou "phone": "+5511999999999"
  "password": "123456",
  "name": "João Silva"
}
```

#### Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",  # ou "phone": "+5511999999999"
  "password": "123456"
}
```

#### Logout
```bash
POST /api/auth/logout
Authorization: Bearer <token>
```

### Usuários

#### Obter perfil atual
```bash
GET /api/users/me
Authorization: Bearer <token>
```

#### Atualizar perfil
```bash
PATCH /api/users/me
Authorization: Bearer <token>
{
  "name": "Novo Nome",
  "status": "Disponível",
  "avatar": "http://example.com/avatar.jpg"
}
```

#### Obter usuário por ID
```bash
GET /api/users/{id}
Authorization: Bearer <token>
```

### Contatos

#### Adicionar contato
```bash
POST /api/contacts
Authorization: Bearer <token>
{
  "contactId": "user-uuid",
  "nickname": "Apelido (opcional)"
}
```

#### Listar contatos
```bash
GET /api/contacts
Authorization: Bearer <token>
```

#### Remover contato
```bash
DELETE /api/contacts/{id}
Authorization: Bearer <token>
```

### Conversas

#### Criar conversa
```bash
POST /api/conversations
Authorization: Bearer <token>
{
  "type": "private",  # ou "group"
  "name": "Grupo Legal (para grupos)",
  "description": "Descrição do grupo (opcional)",
  "memberIds": ["user-uuid1", "user-uuid2"]
}
```

#### Listar conversas
```bash
GET /api/conversations
Authorization: Bearer <token>
```

#### Obter conversa específica
```bash
GET /api/conversations/{id}
Authorization: Bearer <token>
```

#### Adicionar membro ao grupo
```bash
POST /api/conversations/{id}/members
Authorization: Bearer <token>
{
  "userId": "user-uuid",
  "isAdmin": false
}
```

#### Remover membro do grupo
```bash
DELETE /api/conversations/{id}/members/{userId}
Authorization: Bearer <token>
```

### Mensagens

#### Enviar mensagem de texto
```bash
POST /api/conversations/{id}/messages
Authorization: Bearer <token>
{
  "type": "text",
  "content": "Olá, como vai?"
}
```

#### Enviar mensagem com mídia
```bash
POST /api/conversations/{id}/messages
Authorization: Bearer <token>
{
  "type": "image",
  "fileUrl": "http://minio:9000/chat-files/image.jpg",
  "fileName": "foto.jpg",
  "fileSize": 1024000,
  "fileMimeType": "image/jpeg"
}
```

#### Listar mensagens
```bash
GET /api/conversations/{id}/messages?page=1&limit=50
Authorization: Bearer <token>
```

#### Editar mensagem
```bash
PATCH /api/messages/{id}
Authorization: Bearer <token>
{
  "content": "Mensagem editada"
}
```

#### Deletar mensagem
```bash
DELETE /api/messages/{id}
Authorization: Bearer <token>
```

### Reações

#### Adicionar reação
```bash
POST /api/messages/{id}/reactions
Authorization: Bearer <token>
{
  "emoji": "❤️"
}
```

#### Remover reação
```bash
DELETE /api/messages/{id}/reactions/{reactionId}
Authorization: Bearer <token>
```

### Upload de Arquivos

#### Upload de arquivo
```bash
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <arquivo>
```

## 🔌 Socket.IO Events

### Eventos do Cliente para Servidor:
- `message:send` - Enviar mensagem
- `message:delivered` - Marcar como entregue  
- `message:read` - Marcar como lida
- `reaction:add` - Adicionar reação
- `reaction:remove` - Remover reação
- `typing:start` - Iniciar digitação
- `typing:stop` - Parar digitação
- `conversation:join` - Entrar na sala da conversa
- `conversation:leave` - Sair da sala da conversa

### Eventos do Servidor para Cliente:
- `message:new` - Nova mensagem recebida
- `message:delivered` - Mensagem entregue
- `message:read` - Mensagem lida
- `reaction:added` - Reação adicionada
- `reaction:removed` - Reação removida
- `typing:start` - Usuário começou a digitar
- `typing:stop` - Usuário parou de digitar
- `presence:update` - Atualização de presença (online/offline)

### Exemplo de conexão Socket.IO:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'Bearer YOUR_JWT_TOKEN'
  }
});

// Escutar nova mensagem
socket.on('message:new', (data) => {
  console.log('Nova mensagem:', data);
});

// Enviar mensagem
socket.emit('message:send', {
  conversationId: 'conversation-uuid',
  messageId: 'message-uuid'
});
```

## 🗃 Estrutura do Banco de Dados

### Tabelas principais:
- **users** - Usuários do sistema
- **contacts** - Lista de contatos dos usuários
- **conversations** - Conversas (privadas e grupos)
- **conversation_members** - Membros das conversas
- **messages** - Mensagens das conversas
- **message_status** - Status de entrega/leitura por usuário
- **message_reactions** - Reações nas mensagens

## 🐳 Docker

### Serviços inclusos:
- **PostgreSQL** (porta 5432)
- **Redis** (porta 6379)
- **MinIO** (porta 9000, console 9001)

### Comandos úteis:
```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down

# Limpar volumes (⚠️ perderá dados)
docker-compose down -v
```

## 📊 Scripts Disponíveis

```bash
pnpm dev             # Servidor em desenvolvimento com hot reload
pnpm build           # Build para produção
pnpm start           # Servidor em produção
pnpm db:generate     # Gerar migrações do banco
pnpm db:push         # Aplicar mudanças diretamente (dev)
pnpm db:migrate      # Executar migrações
pnpm db:studio       # Interface visual do banco
pnpm docker:up       # Iniciar Docker services
pnpm docker:down     # Parar Docker services
pnpm setup           # Setup completo automático
```

## 🔒 Segurança

- JWT para autenticação
- Rate limiting (100 req/min)
- Helmet para segurança HTTP
- Validação rigorosa com Zod
- Upload de arquivos com verificação de tipo
- Soft delete para mensagens

## 🚀 Próximos Passos

- [ ] Criptografia end-to-end (E2EE)
- [ ] Notificações push
- [ ] Chamadas de voz/vídeo
- [ ] Stories temporárias
- [ ] Backup de conversas
- [ ] Modo escuro
- [ ] Tradutor de mensagens
- [ ] Bot integration

## 📝 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

Desenvolvido com ❤️ usando Node.js, Fastify, Socket.IO e muito café ☕
