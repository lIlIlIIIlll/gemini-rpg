import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { ContextManager } from './utils/context-manager.js';
import { SemanticSearch } from './utils/semantic-search.js';
import { VectorStorage } from './utils/vector-storage.js';
import { SYSTEM_INSTRUCTION } from './utils/prompt.js';

// --- CONFIGURAÇÕES E CONSTANTES ---
const SESSION_ID = 'campanha-com-funcoes-enriquecidas100';
const MAX_HISTORY_TURNS = 1;
const MAX_SEMANTIC_RESULTS = 5;

// Carregue a chave da API de forma segura
const GEMINI_API_KEY = "AIzaSyAVr0EAxhHVfYDMHc60BW8aPWJocrSmfNo";
if (!GEMINI_API_KEY) {
    console.error("ERRO: A variável de ambiente GEMINI_API_KEY não foi configurada.");
    process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const vectorStorage = new VectorStorage(SESSION_ID);
const semanticSearch = new SemanticSearch({ apiKey: GEMINI_API_KEY, vectorStorage });
const contextManager = new ContextManager({ vectorStorage, semanticSearch });

// Inicializa a memória uma vez quando o módulo é carregado
console.log("--- Gemini RPG com Memória Vetorial Enriquecida ---");
console.log(`Carregando campanha: ${SESSION_ID}`);
await contextManager.initialize();
console.log("Memória carregada e pronta.");


// --- DECLARAÇÃO DAS FERRAMENTAS (sem alterações) ---
const tools = [
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
];

// --- IMPLEMENTAÇÃO DAS FUNÇÕES LOCAIS (sem alterações) ---
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
            return result;
        }
    },
};

const modelRequestConfig = {
    model: "gemini-2.5-flash",
    config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [
            {
                functionDeclarations: tools
            }
        ],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    }
};



// --- NOVA FUNÇÃO PRINCIPAL EXPORTADA ---
export async function handlePlayerAction(playerInput, gameSession) {
    gameSession.turno++;
    const { history } = gameSession;

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
    let finalResponseText = "";

    if (functionCalls && functionCalls.length > 0) {
        const functionResponses = await Promise.all(
            functionCalls.map(async (call) => {
                const func = availableFunctions[call.name];
                const functionResult = func
                    ? await func(call.args, gameSession.turno)
                    : { error: "Função não encontrada" };

                return {
                    role: 'function',
                    parts: [
                        {
                            functionResponse: {
                                name: call.name,
                                response: functionResult,
                            },
                        },
                    ],
                };
            })
        );

        history.push(...functionResponses);

        const finalResult = await genAI.models.generateContent({
            ...modelRequestConfig,
            contents: history,
        });

        finalResponseText =
            finalResult.candidates?.[0]?.content?.parts?.[0]?.text ||
            "[O Mestre permanece em silêncio]";

        if (finalResult.candidates?.[0]?.content) {
            history.push(finalResult.candidates[0].content);
        }

        // 👈 Salvar na memória também aqui
        if (finalResponseText) {
            await contextManager.addEntry(
                'system',
                finalResponseText,
                gameSession.turno,
                { tipo: 'narracao', contem_fato_importante: false }
            );
        }
    } else {
        finalResponseText =
            firstResponse.text ||
            "[O Mestre parece confuso e não respondeu. Tente novamente.]";

        if (firstResponse.candidates?.[0]?.content) {
            history.push(firstResponse.candidates[0].content);
        }

        if (finalResponseText) {
            await contextManager.addEntry(
                'system',
                finalResponseText,
                gameSession.turno,
                { tipo: 'narracao', contem_fato_importante: false }
            );
        }
    }


    // Poda do histórico
    const conversationMessages = history.filter(h => h.role === 'user' || h.role === 'model');
    if (conversationMessages.length > MAX_HISTORY_TURNS * 2) { // *2 para contar user e model
        const messagesToRemove = conversationMessages.length - (MAX_HISTORY_TURNS * 2);
        let removedCount = 0;
        gameSession.history = history.filter(h => {
            if ((h.role === 'user' || h.role === 'model') && removedCount < messagesToRemove) {
                removedCount++;
                return false;
            }
            return true;
        });
    }

    return {
        playerInput: playerInput,
        masterResponse: finalResponseText,
        memoryResults: searchResults,
        aiContext: gameSession.history,
        turno: gameSession.turno
    };
}