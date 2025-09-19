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
            const result = await this.genAI.models.embedContent({
                model: "gemini-embedding-001",
                contents: [
                    { parts: [{ text: String(text) }] }
                ],
                taskType: "RETRIEVAL_QUERY",
                outputDimensionality: 768 // opcional
            });

            if (result.embedding) {
                return result.embedding.values;
            } else if (result.embeddings && result.embeddings.length > 0) {
                return result.embeddings[0].values;
            } else {
                throw new Error("Nenhum embedding retornado pela API para a consulta.");
            }
        } catch (error) {
            Logger.error(`[SemanticSearch] Erro ao gerar embedding de consulta:`, error);
            throw error;
        }
    }

    async generateDocumentEmbedding(text) {
        try {
            const result = await this.genAI.models.embedContent({
                model: "gemini-embedding-001",
                contents: [
                    { parts: [{ text: String(text) }] }
                ],
                taskType: "RETRIEVAL_DOCUMENT",
                outputDimensionality: 768 // opcional
            });

            if (result.embedding) {
                return result.embedding.values;
            } else if (result.embeddings && result.embeddings.length > 0) {
                return result.embeddings[0].values;
            } else {
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
