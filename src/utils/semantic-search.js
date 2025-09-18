// semantic-search.js

import { GoogleGenAI } from '@google/genai';
import { Logger } from './logger.js';

export class SemanticSearch {
    constructor({ apiKey, vectorStorage }) {
        if (!apiKey) {
            throw new Error('No Gemini API key found for SemanticSearch');
        }
        if (!vectorStorage) {
            throw new Error('VectorStorage instance is required for SemanticSearch');
        }
        this.genAI = new GoogleGenAI({ apiKey });
        this.vectorStorage = vectorStorage;
    }

    async generateQueryEmbedding(text) {
        try {
            // CORREÇÃO FINAL: Usando a estrutura de payload exata do seu código original.
            // A API espera um array de strings simples para o modelo de embedding.
            const result = await this.genAI.models.embedContent({
                model: "gemini-embedding-001",
                contents: [text], // O texto é simplesmente envolvido em um array.
                taskType: 'RETRIEVAL_QUERY',
            });

            // CORREÇÃO: Reimplementando a lógica de verificação dupla do seu código original,
            // que lida tanto com respostas de item único (`embedding`) quanto de lote (`embeddings`).
            if (result.embedding) {
                return result.embedding.values;
            }
            else if (result.embeddings && result.embeddings.length > 0) {
                return result.embeddings[0].values;
            }
            else {
                // Se nenhuma das propriedades for encontrada, o erro é lançado.
                throw new Error("Nenhum embedding retornado pela API para a consulta.");
            }
        } catch (error) {
            Logger.error(`[SemanticSearch] Erro ao gerar embedding de consulta:`, error);
            throw error;
        }
    }

    async generateDocumentEmbedding(text) {
        try {
            // CORREÇÃO: Aplicando a mesma estrutura de payload e lógica de verificação aqui.
            const result = await this.genAI.models.embedContent({
                model: "gemini-embedding-001",
                contents: [text], // O texto é simplesmente envolvido em um array.
                taskType: 'RETRIEVAL_DOCUMENT',
            });

            if (result.embedding) {
                return result.embedding.values;
            }
            else if (result.embeddings && result.embeddings.length > 0) {
                return result.embeddings[0].values;
            }
            else {
                throw new Error("Nenhum embedding retornado pela API para o documento.");
            }
        } catch (error) {
            Logger.error(`[SemanticSearch] Erro ao gerar embedding de documento:`, error);
            throw error;
        }
    }

    async search(query, limit = 10, filters = {}) {
        if (!query) {
            return [];
        }

        try {
            Logger.info(`[SemanticSearch] Buscando por: "${query}" com filtros: ${JSON.stringify(filters)}`);

            const queryEmbedding = await this.generateQueryEmbedding(query);
            const results = await this.vectorStorage.search(queryEmbedding, limit, filters);

            Logger.info(`[SemanticSearch] Busca concluída. ${results.length} resultados relevantes encontrados.`);
            return results;

        } catch (error) {
            Logger.error('[SemanticSearch] Erro durante a busca semântica:', error);
            throw error;
        }
    }
}