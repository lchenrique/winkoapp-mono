import { Check, CheckCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function MessageStatusDemo() {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🔧 Sistema de Status de Mensagens - Tipo WhatsApp</CardTitle>
        <CardDescription>
          Demonstração dos status das mensagens implementados no WinkoApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Icons Legend */}
        <div>
          <h3 className="font-semibold mb-3 text-lg">Legenda dos Ícones:</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Enviando... (temporário)</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Enviado (1 check cinza)</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCheck className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Entregue (2 checks cinza)</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCheck className="w-4 h-4 text-blue-500" />
              <span className="text-sm">Lido (2 checks azuis)</span>
            </div>
          </div>
        </div>

        {/* Message Examples */}
        <div>
          <h3 className="font-semibold mb-3 text-lg">Exemplos de Mensagens:</h3>
          <div className="space-y-3">
            {/* Sent Message */}
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white rounded-2xl px-4 py-2 max-w-xs">
                <p className="text-sm">Mensagem enviada</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs opacity-75">14:32</span>
                  <Check className="w-4 h-4 opacity-75" />
                </div>
              </div>
            </div>

            {/* Delivered Message */}
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white rounded-2xl px-4 py-2 max-w-xs">
                <p className="text-sm">Mensagem entregue</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs opacity-75">14:33</span>
                  <CheckCheck className="w-4 h-4 opacity-75" />
                </div>
              </div>
            </div>

            {/* Read Message */}
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white rounded-2xl px-4 py-2 max-w-xs">
                <p className="text-sm">Mensagem lida</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs opacity-75">14:34</span>
                  <CheckCheck className="w-4 h-4 text-blue-200" />
                </div>
              </div>
            </div>

            {/* Received Message (no status shown) */}
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-800 rounded-2xl px-4 py-2 max-w-xs">
                <p className="text-sm">Mensagem recebida (sem status)</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs text-gray-500">14:35</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div>
          <h3 className="font-semibold mb-3 text-lg">Como Funciona:</h3>
          <div className="text-sm space-y-2 text-gray-600">
            <p>✅ <strong>Enviado:</strong> Mensagem foi enviada com sucesso para o servidor</p>
            <p>📨 <strong>Entregue:</strong> Mensagem foi entregue ao dispositivo do destinatário (usuário online)</p>
            <p>📖 <strong>Lido:</strong> Destinatário visualizou a mensagem (quando conversa está aberta)</p>
            <p>🔄 <strong>Tempo Real:</strong> Status atualizam automaticamente via Socket.IO</p>
            <p>👤 <strong>Próprias Mensagens:</strong> Status só aparece em mensagens que você enviou</p>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Detalhes Técnicos:</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Status agregado para conversas em grupo (menor status entre todos)</p>
            <p>• Auto-delivery quando mensagem é recebida via Socket.IO</p>
            <p>• Auto-read quando mensagem é visualizada por mais de 1 segundo</p>
            <p>• Sincronização periódica de status via API (10s)</p>
            <p>• Eventos em tempo real via Socket.IO</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
