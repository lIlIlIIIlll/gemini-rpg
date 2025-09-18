import React from 'react';

const MemoryPanel = ({ memoryResults }) => {
    return (
        <div className="panel">
            <h2>Memória Relevante</h2>
            {memoryResults.length === 0 && <p>Nenhuma memória encontrada para a última ação.</p>}
            {memoryResults.map((mem, index) => (
                <div key={index} className="memory-card">
                    <div>
                        <span className="memory-tag">{mem.tipo || 'N/A'}</span>
                        <strong>Turno: {mem.turno}</strong>
                    </div>
                    <p className="memory-content">{mem.content}</p>
                </div>
            ))}
        </div>
    );
};

export default MemoryPanel;