import React, { useEffect, useRef } from 'react';

const MainPanel = ({ history }) => {
    const historyEndRef = useRef(null);

    const scrollToBottom = () => {
        historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [history]);

    return (
        <div className="history-container">
            {history.map((item, index) => (
                <div key={index} className={`message ${item.role}`}>
                    <div className="message-role">
                        {item.role === 'player' ? 'Você' : 'Mestre'} (Turno {item.turno})
                    </div>
                    <div className="message-content">{item.content}</div>
                </div>
            ))}
            <div ref={historyEndRef} />
        </div>
    );
};

export default MainPanel;