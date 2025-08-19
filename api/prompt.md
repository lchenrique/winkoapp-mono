Quero que você atue como arquiteto de software. 
Preciso que você desenhe e implemente uma API de chat em tempo real estilo WhatsApp com a seguinte stack:

- Backend: Node.js + Fastify.
- Validação: Fastify + Zod Provider.
- Documentação: Fastify + Swagger.
- Banco de dados: PostgreSQL.
- Cache/Presença: Redis.
- Storage local: MinIO.
- Realtime: Socket.IO.

Funcionalidades obrigatórias (MVP):
1. Autenticação com JWT (registro/login com e-mail ou telefone).
2. Perfil do usuário (nome, avatar, status, última visualização).
3. Contatos (adicionar/remover).
4. Conversas privadas e em grupo.
5. Mensagens de texto com suporte a emojis.
6. Reações em mensagens (👍❤️😂🔥).
7. Envio de mídias (imagem, vídeo, áudio, documento) armazenadas no MinIO.
8. Status das mensagens (enviada, entregue, lida).
9. Notificações em tempo real com Socket.IO.
10. Todas as rotas validadas com Zod.
11. Documentação automática exposta em Swagger.
12. Estrutura de dados baseada no PRD fornecido.

A entrega deve ser modular, escalável e 100% open source.

PRD em ./PRD