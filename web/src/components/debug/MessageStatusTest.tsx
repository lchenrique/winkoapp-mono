import { MessageStatusIndicator } from '../chat/MessageStatusIndicator';
import { Message } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

export function MessageStatusTest() {
  const { user } = useAuth();

  if (!user) return null;

  // Mock messages with different statuses
  const mockMessages: Message[] = [
    {
      id: 'test-sent',
      content: 'Mensagem enviada',
      type: 'text',
      conversationId: 'test-conv',
      senderId: user.id,
      sender: user,
      status: 'sent',
      statusTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'test-delivered',
      content: 'Mensagem entregue',
      type: 'text',
      conversationId: 'test-conv',
      senderId: user.id,
      sender: user,
      status: 'delivered',
      statusTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'test-read',
      content: 'Mensagem lida',
      type: 'text',
      conversationId: 'test-conv',
      senderId: user.id,
      sender: user,
      status: 'read',
      statusTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'test-null',
      content: 'Mensagem sem status',
      type: 'text',
      conversationId: 'test-conv',
      senderId: user.id,
      sender: user,
      status: null,
      statusTimestamp: null,
      createdAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="p-4 bg-card border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">🧪 Teste de Status de Mensagens</h3>
      <div className="space-y-4">
        {mockMessages.map((message) => (
          <div key={message.id} className="flex items-center justify-between p-3 bg-muted rounded">
            <div>
              <div className="font-medium">{message.content}</div>
              <div className="text-sm text-muted-foreground">
                Status: {message.status || 'null'}
              </div>
            </div>
            <div className="flex items-center">
              <MessageStatusIndicator message={message} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        <p><strong>Legenda:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>✓ (cinza) = Enviado</li>
          <li>✓✓ (cinza) = Entregue</li>
          <li>✓✓ (azul) = Lido</li>
        </ul>
      </div>
    </div>
  );
}
