// rpg.js

// --- 1. CONFIGURAÇÃO E IMPORTAÇÕES ---

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { createInterface } from 'readline';
import { ContextManager } from './utils/context-manager.js';
import { SemanticSearch } from './utils/semantic-search.js';
import { VectorStorage } from './utils/vector-storage.js';
import { SYSTEM_INSTRUCTION } from './utils/prompt.js';

// --- 2. CONSTANTES E CONFIGURAÇÃO DA IA ---

const SESSION_ID = 'campanha-com-funcoes-enriquecidas';
const MAX_HISTORY_TURNS = 1;
const MAX_SEMANTIC_RESULTS = 5;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAVr0EAxhHVfYDMHc60BW8aPWJocrSmfNo';
if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyAVr0EAxhHVfYDMHc60BW8aPWJocrSmfNo') {
    // console.warn("AVISO: A API Key do Gemini não foi configurada ou está usando o valor padrão. O programa pode não funcionar. Configure a variável de ambiente GEMINI_API_KEY.");
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// --- 2.2 CONFIGURAÇÃO DA MEMÓRIA ---
const vectorStorage = new VectorStorage(SESSION_ID);
const semanticSearch = new SemanticSearch({ apiKey: GEMINI_API_KEY, vectorStorage });
const contextManager = new ContextManager({ vectorStorage, semanticSearch });

// --- 3. DECLARAÇÃO DAS FERRAMENTAS ---
const tools = [{
    functionDeclarations: [
        {
            name: 'addMemoryEntry',
            description: 'Salva um novo fato, evento, descrição ou conceito na memória de longo prazo. Use para registrar informações importantes que moldam a história ou o mundo.',
            parameters: {
                type: "OBJECT",
                properties: {
                    memoryData: {
                        type: "OBJECT",
                        description: "Um objeto contendo os detalhes da memória a ser salva.",
                        properties: {
                            content: { type: "STRING", description: 'O texto completo da memória (uma narração, um fato, uma descrição).' },
                            tipo: {
                                type: "STRING",
                                description: 'A categoria da memória. Escolha uma: "narracao" (diálogos, ações), "evento" (fato concreto que aconteceu), "descricao" (detalhes de um local, NPC ou objeto), "conceito" (lore, regras do mundo, relações abstratas).'
                            },
                            contem_fato_importante: { type: "BOOLEAN", description: 'Defina como `true` se a memória for um fato crucial para a trama ou para decisões futuras.' },
                            resumo_fato: { type: "STRING", description: 'Se `contem_fato_importante` for true, forneça um resumo muito curto e direto do fato.' },
                            npc: { type: "STRING", description: 'O nome do NPC principal relacionado a esta memória, se houver.' },
                            localizacao: { type: "STRING", description: 'O nome do local onde esta memória ocorre, se aplicável.' },
                            personagens_presentes: {
                                type: "ARRAY",
                                description: 'Uma lista com os nomes dos personagens presentes na cena.',
                                items: { type: "STRING" }
                            },
                        },
                        required: ['content', 'tipo']
                    }
                },
                required: ['memoryData']
            },
        },
        {
            name: 'getMemoryEntries',
            description: 'Busca na memória de longo prazo por informações relevantes, com capacidade de filtrar por metadados para obter resultados precisos.',
            parameters: {
                type: "OBJECT",
                properties: {
                    query: { type: "STRING", description: 'O termo de busca ou pergunta para a busca semântica.' },
                    maxResults: { type: "NUMBER", description: `O número máximo de resultados a serem retornados. Padrão: ${MAX_SEMANTIC_RESULTS}.` },
                    tipo: { type: "STRING", description: 'Filtra memórias por um tipo específico (narracao, evento, descricao, conceito).' },
                    npc: { type: "STRING", description: 'Filtra memórias relacionadas a um NPC específico.' },
                    localizacao: { type: "STRING", description: 'Filtra memórias que ocorreram em um local específico.' },
                    contem_fato_importante: { type: "BOOLEAN", description: 'Busca apenas memórias marcadas como fatos importantes.' },
                    turnoMin: { type: "NUMBER", description: 'Busca memórias a partir de um turno específico (inclusive).' },
                    turnoMax: { type: "NUMBER", description: 'Busca memórias até um turno específico (inclusive).' },
                },
                required: ['query']
            },
        },
    ]
}];

// --- 4. IMPLEMENTAÇÃO DAS FUNÇÕES LOCAIS ---
const availableFunctions = {
    addMemoryEntry: async ({ memoryData }, turno) => {
        try {
            const { content, ...metadata } = memoryData;
            await contextManager.addEntry('system', content, turno, metadata);
            return { success: true, message: `Memória do tipo '${metadata.tipo}' salva com sucesso.` };
        } catch (e) {
            const result = { success: false, message: `Falha ao salvar memória: ${e.message}` };
            console.error('Erro ao salvar memória:', result);
            return result;
        }
    },
    getMemoryEntries: async ({ query, maxResults, ...filters }) => {
        try {
            const results = await semanticSearch.search(query, maxResults || MAX_SEMANTIC_RESULTS, filters);
            if (results && results.length > 0) {
                return {
                    success: true,
                    entries: results.map(r => ({
                        content: r.content,
                        tipo: r.tipo,
                        turno: r.turno,
                        npc: r.npc,
                        localizacao: r.localizacao,
                        contem_fato_importante: r.contem_fato_importante
                    }))
                };
            } else {
                return {
                    success: true,
                    entries: [],
                    message: "Nenhuma entrada de memória encontrada para a consulta com os filtros aplicados."
                };
            }
        } catch (e) {
            const result = { success: false, message: `Falha ao buscar na memória: ${e.message}` };
            // console.error('Erro ao buscar na memória:', result);
            return result;
        }
    },
};

// --- 5. O "GAME LOOP" ---
const rl = createInterface({ input: process.stdin, output: process.stdout });
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, answer => resolve(answer.trim())));
}

async function gameLoop() {
    console.log("--- Gemini RPG com Memória Vetorial Enriquecida ---");
    console.log(`Carregando campanha: ${SESSION_ID}`);
    await contextManager.initialize();
    console.log("Memória carregada.");

    let history = [];
    let turno = 0;

    const modelRequestConfig = {
        model: "gemini-2.5-flash",
        config: {
            tools: tools,
            systemInstruction: SYSTEM_INSTRUCTION,
            toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        }
    };

    while (true) {
        const playerInput = await askQuestion('> ');
        if (playerInput.toLowerCase() === 'sair') {
            console.log("\nEnd-Session");
            rl.close();
            break;
        }

        turno++;
        console.log(`\n--- [Turno ${turno}] Mestre está pensando... ---\n`);

        const searchResults = await semanticSearch.search(playerInput, MAX_SEMANTIC_RESULTS);
        let contextMessage = "";
        if (searchResults && searchResults.length > 0) {
            const formattedResults = searchResults.map(r => r.content).join('; ');
            contextMessage = `[CONTEXTO DA MEMÓRIA PARA A CENA ATUAL]: ${formattedResults}`;
        }

        const finalPlayerInputWithContext = contextMessage
            ? `${contextMessage}\n\n[JOGADOR]: ${playerInput}`
            : `[JOGADOR]: ${playerInput}`;

        history.push({ role: 'user', parts: [{ text: finalPlayerInputWithContext }] });

        const firstResponse = await genAI.models.generateContent({
            ...modelRequestConfig,
            contents: history
        });

        const functionCalls = firstResponse.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            console.log("--- (Mestre está acessando a memória) ---");
            if (firstResponse.candidates?.[0]?.content) {
                history.push(firstResponse.candidates[0].content);
            }

            const functionResponses = await Promise.all(
                functionCalls.map(async (call) => {
                    // console.log(`> IA chamou: ${call.name}(${JSON.stringify(call.args, null, 2)})`);
                    const func = availableFunctions[call.name];
                    const functionResult = func ? await func(call.args, turno) : { error: "Função não encontrada" };
                    return {
                        role: 'function',
                        parts: [{ functionResponse: { name: call.name, response: functionResult } }]
                    };
                })
            );

            history.push(...functionResponses);

            const finalResult = await genAI.models.generateContent({
                ...modelRequestConfig,
                contents: history
            });

            const finalResponseText = finalResult.candidates?.[0]?.content?.parts?.[0]?.text || "[O Mestre permanece em silêncio]";
            console.log(finalResponseText);
            if (finalResult.candidates?.[0]?.content) {
                history.push(finalResult.candidates[0].content);
            }

            // NOVO: Salva a narração final automaticamente na memória.
            if (finalResponseText) {
                await contextManager.addEntry('system', finalResponseText, turno, { tipo: 'narracao', contem_fato_importante: false });
            }

        } else {
            const responseText = firstResponse.text || "[O Mestre parece confuso e não respondeu. Tente novamente.]";
            console.log(responseText);
            if (firstResponse.candidates?.[0]?.content) {
                history.push(firstResponse.candidates[0].content);
            }

            // NOVO: Salva a narração direta automaticamente na memória.
            if (responseText) {
                await contextManager.addEntry('system', responseText, turno, { tipo: 'narracao', contem_fato_importante: false });
            }
        }

        const conversationMessages = history.filter(h => h.role === 'user' || h.role === 'model');
        if (conversationMessages.length > MAX_HISTORY_TURNS) {
            const messagesToRemove = conversationMessages.length - MAX_HISTORY_TURNS;
            let removedCount = 0;
            history = history.filter(h => {
                if ((h.role === 'user' || h.role === 'model') && removedCount < messagesToRemove) {
                    removedCount++;
                    return false;
                }
                return true;
            });
            console.log(`\n--- (O Mestre esquece o passado distante... Histórico podado para os últimos ${MAX_HISTORY_TURNS / 2} turnos) ---\n`);
        }
    }
}

gameLoop();