# WinkoApp - Chat em Tempo Real 🚀

Um monorepo contendo API backend e múltiplos frontends para uma aplicação de chat em tempo real estilo WhatsApp.

## 📁 Estrutura do Projeto

```
winkoapp/
├── api/              # Backend API (Fastify + Socket.IO + PostgreSQL)
├── web/              # Frontend moderno (React + Vite + TypeScript + Tailwind)
├── web-old/          # Frontend legado (HTML/CSS/JS puro)
└── package.json      # Scripts do monorepo
```

## 🛠️ Tecnologias

### Backend (API)
- **Fastify** - Framework web rápido e eficiente
- **Socket.IO** - Comunicação em tempo real
- **PostgreSQL** - Banco de dados relacional
- **Drizzle ORM** - Type-safe database toolkit
- **Redis** - Cache e sessões
- **JWT** - Autenticação
- **TypeScript** - Tipagem estática

### Frontend Novo (Web)
- **React 18** - Biblioteca UI
- **Vite** - Build tool moderna
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utilitário
- **shadcn/ui** - Componentes UI modernos
- **React Query** - Gerenciamento de estado server

### Frontend Legado (Web-Old)
- **HTML/CSS/JS** - Tecnologias web nativas
- **Socket.IO Client** - Conexão em tempo real

## ⚡ Início Rápido

### 1. Instalar dependências
```bash
npm install          # Instala dependências do monorepo
npm run setup        # Instala dependências de todos os projetos
```

### 2. Configurar ambiente

#### API (obrigatório)
```bash
cd api
cp .env.example .env
# Configure as variáveis de ambiente no arquivo .env
```

### 3. Executar aplicação

#### Rodar tudo junto (recomendado)
```bash
npm run dev          # Roda API + Frontend novo + Frontend antigo
```

#### Ou rodar individualmente
```bash
npm run dev:api      # Apenas backend (porta 3000)
npm run dev:web      # Apenas frontend novo (porta 5173)
npm run dev:web-old  # Apenas frontend antigo (porta 3001)
```

#### Combinações úteis
```bash
npm run dev:full     # API + Frontend novo apenas
npm run dev:backend  # Alias para API
npm run dev:frontend # Alias para frontend novo
```

## 🌐 Portas e URLs

- **API**: http://localhost:3000
  - Swagger UI: http://localhost:3000/documentation
- **Frontend Novo**: http://localhost:5173
- **Frontend Antigo**: http://localhost:3001

## 📦 Scripts Disponíveis

### Desenvolvimento
- `npm run dev` - Roda todos os projetos
- `npm run dev:api` - Roda apenas a API
- `npm run dev:web` - Roda apenas o frontend novo
- `npm run dev:web-old` - Roda apenas o frontend antigo

### Instalação
- `npm run setup` - Instala dependências de todos os projetos
- `npm run install:all` - Instala dependências (API + Web)
- `npm run install:api` - Instala dependências da API
- `npm run install:web` - Instala dependências do frontend

### Build
- `npm run build` - Builda API + Frontend
- `npm run build:api` - Build apenas da API
- `npm run build:web` - Build apenas do frontend

### Limpeza
- `npm run clean` - Remove node_modules e builds
- `npm run clean:api` - Limpa apenas a API
- `npm run clean:web` - Limpa apenas o frontend

## 🔧 Configuração da API

### Banco de dados
1. Configure PostgreSQL
2. Configure Redis (opcional, para cache)
3. Configure as variáveis no `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/winkoapp
REDIS_URL=redis://localhost:6379
JWT_SECRET=seu-jwt-secret-muito-seguro
PORT=3000
```

### Docker (opcional)
```bash
cd api
docker-compose up -d  # Sobe PostgreSQL e Redis
```

## 🚀 Deploy

### Frontend
- O frontend React pode ser buildado e servido estaticamente
- Configure a `API_BASE_URL` para apontar para sua API em produção

### Backend
- API pode ser deployada em qualquer provedor Node.js
- Configure banco PostgreSQL em produção
- Configure Redis em produção (recomendado)

## 📝 Desenvolvimento

### Adicionando novas features
1. Backend: Adicione rotas em `api/src/routes/`
2. Frontend: Componentes em `web/src/components/`
3. Socket events: Configure em `api/src/services/socket.ts`

### Debugging
- API: Logs detalhados no console
- Frontend: React DevTools + Browser DevTools
- Socket.IO: Debug habilitado nos navegadores

## 🤝 Contribuição

1. Clone o repositório
2. Execute `npm run setup`
3. Crie sua feature branch
4. Faça suas alterações
5. Teste com `npm run dev`
6. Commit e push

## 📄 Licença

MIT License - veja LICENSE para detalhes.

---

**Dica**: Use `npm run dev` e acesse os diferentes frontends nas suas respectivas portas para comparar e testar funcionalidades! 🎯
