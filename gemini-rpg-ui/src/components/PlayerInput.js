import React, { useState } from 'react';

const PlayerInput = ({ onSend, isThinking, status }) => {
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (text.trim() && !isThinking) {
            onSend(text);
            setText('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="player-input-container">
            <form onSubmit={handleSubmit} className="player-input-form">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="O que você faz?"
                    rows="3"
                    disabled={isThinking}
                />
                <button type="submit" disabled={isThinking}>
                    Enviar
                </button>
            </form>
            {status && <p className="status-message">{status}</p>}
        </div>
    );
};

export default PlayerInput;