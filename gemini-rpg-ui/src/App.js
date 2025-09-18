import React, { useState, useEffect, useRef } from 'react';
import MainPanel from './components/MainPanel';
import MemoryPanel from './components/MemoryPanel';
import ContextPanel from './components/ContextPanel';
import PlayerInput from './components/PlayerInput';
import './style/App.css';

function App() {
  const [history, setHistory] = useState([]);
  const [memoryResults, setMemoryResults] = useState([]);
  const [aiContext, setAiContext] = useState([]);
  const [status, setStatus] = useState('Conectando ao servidor...');
  const [isThinking, setIsThinking] = useState(false);
  
  const ws = useRef(null);

  useEffect(() => {
    // Conecta ao servidor WebSocket
    ws.current = new WebSocket('ws://localhost:8080');

    ws.current.onopen = () => {
      setStatus('Conectado! Comece sua aventura.');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'status') {
        setStatus(message.data);
        setIsThinking(true);
      } else if (message.type === 'gameUpdate') {
        const { playerInput, masterResponse, memoryResults, aiContext, turno } = message.data;
        
        setHistory(prev => [
          ...prev, 
          { role: 'player', content: playerInput, turno },
          { role: 'master', content: masterResponse, turno }
        ]);
        
        setMemoryResults(memoryResults || []);
        setAiContext(aiContext || []);
        setStatus('');
        setIsThinking(false);
      } else if (message.type === 'error') {
        setStatus(`Erro: ${message.data}`);
        setIsThinking(false);
      }
    };

    ws.current.onclose = () => {
      setStatus('Desconectado do servidor.');
      setIsThinking(false);
    };

    return () => {
      ws.current.close();
    };
  }, []);

  const handlePlayerAction = (inputText) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(inputText);
      setIsThinking(true); // Otimista
      setStatus('O Mestre está pensando...');
    } else {
      setStatus('Não conectado. Tente recarregar a página.');
    }
  };


  return (
    <div className="App">
      <MemoryPanel memoryResults={memoryResults} />
      <div className="main-panel">
        <MainPanel history={history} />
        <PlayerInput onSend={handlePlayerAction} isThinking={isThinking} status={status} />
      </div>
      <ContextPanel aiContext={aiContext} />
    </div>
  );
}

export default App;