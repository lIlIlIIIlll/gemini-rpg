import fs from 'fs/promises';
import path from 'path';
import { Logger } from './logger.js';
export class Storage {
    constructor(filePath) {
        this._entries = [];
        this.filePath = filePath;
    }
    async init() {
        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            // Try to read existing file
            try {
                const data = await fs.readFile(this.filePath, 'utf-8');
                this._entries = JSON.parse(data);
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
                // File doesn't exist, use empty array
                this._entries = [];
            }
        }
        catch (error) {
            Logger.error('[storage] Error initializing storage:', error);
            throw error;
        }
    }
    async save() {
        try {
            console.log(`[Storage Debug] Tentando salvar em: ${this.filePath}`);
            console.log(`[Storage Debug] Conteúdo de _entries antes de stringify:`, this._entries);

            const serializableEntries = this._entries.map(entry => ({
                role: entry.role,
                content: entry.content,
                timestamp: entry.timestamp,
                metadata: entry.metadata,
                embedding: entry.embedding // Explicitly include embedding
            }));

            const jsonContent = JSON.stringify(serializableEntries, null, 2);
            console.log(`[Storage Debug] Conteúdo JSON stringificado:`, jsonContent);
            await fs.writeFile(this.filePath, jsonContent);
            console.log(`[Storage] Dados salvos em ${this.filePath}`);
        }
        catch (error) {
            console.error(`[Storage] Erro ao salvar dados em ${this.filePath}:`, error);
            console.error(`[Storage Debug] Detalhes do erro:`, error.message, error.stack);
            throw error;
        }
    }
    get entries() {
        return this._entries;
    }
}
