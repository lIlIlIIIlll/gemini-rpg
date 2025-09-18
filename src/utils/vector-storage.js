// vector-storage.js

// --- 1. IMPORTAÇÕES ---
import { connect } from '@lancedb/lancedb';
import { Logger } from './logger.js';
import path from 'path';
// Adiciona Bool para o novo campo de metadados
import { Field, FixedSizeList, Float32, Schema, Utf8, Bool } from 'apache-arrow';


/**
 * Gerencia a persistência e a busca de vetores em um banco de dados LanceDB local.
 * MODIFICADO: Agora suporta um esquema de metadados enriquecido e buscas filtradas.
 */
export class VectorStorage {
    /**
     * @param {string} collectionName - O nome da coleção (campanha) a ser usada.
     */
    constructor(collectionName) {
        const dbPath = path.join(process.cwd(), 'lancedb');
        this.uri = dbPath;
        this.tableName = collectionName;
        this.db = null;
        this.table = null;
    }

    /**
     * Inicializa a conexão com o banco de dados e carrega (ou cria) a tabela da campanha.
     */
    async initialize() {
        try {
            Logger.info(`[VectorStorage] Inicializando LanceDB em: '${this.uri}'`);
            this.db = await connect(this.uri);

            const tableNames = await this.db.tableNames();
            if (tableNames.includes(this.tableName)) {
                Logger.info(`[VectorStorage] Carregando tabela existente: '${this.tableName}'`);
                this.table = await this.db.openTable(this.tableName);
            } else {
                Logger.info(`[VectorStorage] Tabela '${this.tableName}' não encontrada. Ela será criada no primeiro 'addEntry'.`);
            }
        } catch (error) {
            Logger.error('[VectorStorage] Falha ao inicializar o LanceDB:', error);
            throw error;
        }
    }

    /**
     * Adiciona uma nova entrada (memória) ao banco de dados vetorial.
     * @param {object} entry - O objeto de entrada com metadados enriquecidos.
     *   Formato esperado: {
     *     role: string, content: string, embedding: Array<number>, timestamp: number, turno: number,
     *     metadata: { tipo: string, npc?: string, localizacao?: string, personagens_presentes?: Array<string>, contem_fato_importante?: boolean, resumo_fato?: string }
     *   }
     */
    async addEntry(entry) {
        // Validação da dimensão do embedding (3072 para Gemini)
        if (!entry.embedding || entry.embedding.length !== 3072) {
            Logger.warn(`[VectorStorage] Tentativa de adicionar entrada sem um embedding de 3072 dimensões. A entrada foi ignorada. (Tamanho recebido: ${entry.embedding?.length})`);
            return;
        }

        // Prepara os dados achatando a estrutura de metadados para colunas de primeira classe.
        // Isso é crucial para permitir a filtragem eficiente com a cláusula .where() do LanceDB.
        const data = [{
            role: entry.role,
            content: entry.content,
            embedding: entry.embedding,
            timestamp: entry.timestamp || Date.now(),
            turno: entry.turno,
            // Campos de metadados extraídos para colunas
            tipo: entry.metadata.tipo,
            npc: entry.metadata.npc || null,
            localizacao: entry.metadata.localizacao || null,
            personagens_presentes: JSON.stringify(entry.metadata.personagens_presentes || []),
            contem_fato_importante: entry.metadata.contem_fato_importante || false,
            resumo_fato: entry.metadata.resumo_fato || null
        }];

        try {
            if (!this.table) {
                Logger.info(`[VectorStorage] Criando nova tabela: '${this.tableName}'`);

                // NOVO: Esquema atualizado para incluir os campos de metadados como colunas.
                // Isso permite a filtragem direta e otimizada no banco de dados.
                const schema = new Schema([
                    // Campos originais
                    new Field('role', new Utf8(), true),
                    new Field('content', new Utf8(), true),
                    new Field('timestamp', new Float32(), true),
                    new Field('embedding', new FixedSizeList(3072, new Field('item', new Float32()))),
                    // Novos campos para metadados e filtragem
                    new Field('turno', new Float32(), true),
                    new Field('tipo', new Utf8(), true),
                    new Field('npc', new Utf8(), true),
                    new Field('localizacao', new Utf8(), true),
                    new Field('personagens_presentes', new Utf8(), true), // Armazenado como string JSON
                    new Field('contem_fato_importante', new Bool(), true),
                    new Field('resumo_fato', new Utf8(), true),
                ]);

                this.table = await this.db.createTable(this.tableName, data, { schema });
            } else {
                await this.table.add(data);
            }
        } catch (error) {
            Logger.error(`[VectorStorage] Falha ao adicionar entrada:`, error);
        }
    }


    /**
     * Busca as entradas mais relevantes para um dado vetor de consulta, com filtros opcionais.
     * @param {Array<number>} queryEmbedding - O vetor da consulta do jogador.
     * @param {number} limit - O número máximo de resultados a retornar.
     * @param {object} filters - Um objeto com filtros a serem aplicados na busca.
     *   Exemplo: { tipo: 'evento', contem_fato_importante: true, turnoMin: 10 }
     * @returns {Promise<Array<object>>} - Lista de objetos de memória relevantes.
     */
    async search(queryEmbedding, limit = 5, filters = {}) {
        try {
            // Garante que a tabela exista antes de tentar a busca
            if (!this.table) {
                const tableNames = await this.db.tableNames();
                if (!tableNames.includes(this.tableName)) {
                    Logger.warn('[VectorStorage] Busca ignorada: a tabela de memória ainda não existe.');
                    return [];
                }
                this.table = await this.db.openTable(this.tableName);
            }

            // Inicia a construção da query de busca semântica
            let queryBuilder = this.table.search(queryEmbedding);

            // Extrai filtros de intervalo para tratamento especial
            const { turnoMin, turnoMax, ...exactFilters } = filters;

            // Aplica filtros de correspondência exata (ex: tipo = 'evento')
            for (const [key, value] of Object.entries(exactFilters)) {
                if (value !== undefined && value !== null) {
                    // Constrói a cláusula WHERE dinamicamente para cada filtro
                    // O uso de ` (backticks) protege nomes de colunas e ' (aspas simples) envolve os valores
                    const condition = typeof value === 'string' ? `\`${key}\` = '${value.replace(/'/g, "''")}'` : `\`${key}\` = ${value}`;
                    queryBuilder = queryBuilder.where(condition);
                }
            }

            // Aplica filtros de intervalo para o campo 'turno'
            if (turnoMin !== undefined) {
                queryBuilder = queryBuilder.where(`turno >= ${turnoMin}`);
            }
            if (turnoMax !== undefined) {
                queryBuilder = queryBuilder.where(`turno <= ${turnoMax}`);
            }

            // Executa a busca com todos os filtros aplicados e limita os resultados
            const results = await queryBuilder
                .limit(limit)
                .toArray();

            // Retorna os resultados no formato JSON padrão
            return results.map(item => item.toJSON());

        } catch (error) {
            Logger.error('[VectorStorage] Falha ao realizar a busca vetorial:', error);
            return [];
        }
    }
}