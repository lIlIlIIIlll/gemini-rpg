// context-manager.js

/**
 * Gerencia o contexto da memória do jogo.
 * Atua como uma camada de orquestração entre a lógica do jogo,
 * a geração de embeddings e o armazenamento vetorial.
 * MODIFICADO: Agora lida com a nova estrutura de metadados enriquecidos.
 */
export class ContextManager {
    /**
     * @param {object} config
     * @param {import('./vector-storage.js').VectorStorage} config.vectorStorage - A instância do armazenamento vetorial.
     * @param {import('./semantic-search.js').SemanticSearch} config.semanticSearch - A instância do buscador semântico.
     */
    constructor({ vectorStorage, semanticSearch }) {
        this.vectorStorage = vectorStorage;
        this.semanticSearch = semanticSearch;
    }

    /**
     * Inicializa o armazenamento vetorial.
     */
    async initialize() {
        await this.vectorStorage.initialize();
    }

    /**
     * Adiciona uma nova entrada de memória com metadados estruturados.
     * Gera o embedding e o persiste no VectorStorage.
     * @param {string} role - O papel de quem gerou a entrada (ex: 'system', 'player').
     * @param {string} content - O texto da memória a ser salvo.
     * @param {number} turno - O número do turno atual do jogo.
     * @param {object} metadata - Objeto estruturado com os metadados da memória.
     *   Exemplo: { tipo: 'evento', npc: 'Ferreiro', contem_fato_importante: true, ... }
     */
    async addEntry(role, content, turno, metadata) {
        try {
            // 1. Gera o embedding para o conteúdo da memória, otimizado para ser encontrado depois.
            const embedding = await this.semanticSearch.generateDocumentEmbedding(content);

            // 2. Constrói o objeto de entrada completo com a nova estrutura.
            // Este objeto contém todos os campos que o VectorStorage espera.
            const entry = {
                role,
                content,
                timestamp: Date.now(),
                turno, // Adiciona o número do turno
                metadata, // O objeto de metadados completo
                embedding
            };

            // 3. Adiciona a entrada completa (com embedding e metadados) ao VectorStorage.
            // O VectorStorage cuidará de "achatar" os metadados para as colunas corretas.
            await this.vectorStorage.addEntry(entry);

        } catch (error) {
            console.error('[ContextManager] Falha ao adicionar nova entrada de memória:', error);
            // A falha é registrada, mas não impede a continuação do jogo.
        }
    }

    /**
     * Retorna todas as entradas da memória.
     * Delega a chamada para o VectorStorage.
     * Útil para debug, mas não deve ser usado no fluxo principal do jogo.
     * @returns {Promise<Array<object>>}
     */
    async getAllEntries() {
        // Esta função pode precisar ser implementada no VectorStorage se for necessária.
        // Por enquanto, ela não é chamada no fluxo principal.
        console.warn("[ContextManager] getAllEntries não está implementado no VectorStorage atual.");
        return [];
    }

    // A lógica de contagem de tokens e poda (pruneContext) foi removida,
    // pois um Vector DB não tem a mesma limitação de um prompt de LLM.
    // Ele pode armazenar milhões de entradas sem problemas de performance na busca.
}