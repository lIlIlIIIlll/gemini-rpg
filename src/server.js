import { WebSocketServer } from 'ws';
import { handlePlayerAction } from './rpg.js';

const wss = new WebSocketServer({ port: 8080 });

console.log("--- Servidor do Gemini RPG iniciado na porta 8080 ---");
console.log("Aguardando conexão da interface...");

wss.on('connection', ws => {
  console.log('Interface conectada!');

  // Inicializa o jogo para este novo cliente
  const gameSession = {
    history: [],
    turno: 0,
  };

  ws.on('message', async (message) => {
    const playerInput = message.toString();
    console.log(`> Jogador: ${playerInput}`);

    // Envia uma mensagem para a UI de que o mestre está pensando
    ws.send(JSON.stringify({ type: 'status', data: 'O Mestre está pensando...' }));

    try {
      const gameResponse = await handlePlayerAction(playerInput, gameSession);

      // Envia todas as atualizações para a interface
      ws.send(JSON.stringify({ type: 'gameUpdate', data: gameResponse }));

    } catch (error) {
      console.error("Erro no loop do jogo:", error);
      ws.send(JSON.stringify({ type: 'error', data: 'Ocorreu um erro no servidor.' }));
    }
  });

  ws.on('close', () => {
    console.log('Interface desconectada.');
  });
});     