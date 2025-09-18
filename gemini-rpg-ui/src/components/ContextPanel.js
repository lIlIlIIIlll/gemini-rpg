import React from 'react';

const ContextPanel = ({ aiContext }) => {
    // Filtra para mostrar apenas as mensagens de 'user' e 'model' (assistant)
    const conversationContext = aiContext.filter(msg => msg.role === 'user' || msg.role === 'model');

    return (
        <div className="panel">
            <h2>Contexto da IA</h2>
            {conversationContext.length === 0 && <p>Aguardando a primeira jogada...</p>}
            {conversationContext.map((msg, index) => (
                <div key={index} className={`context-message ${msg.role}`}>
                    <strong>{msg.role}:</strong>
                    <div>{msg.parts[0].text}</div>
                </div>
            ))}
        </div>
    );
};

export default ContextPanel;