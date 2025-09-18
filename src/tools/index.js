import { z } from 'zod';
import { Logger } from '../utils/logger.js';
export async function registerTools(server, contextManager, semanticSearch) {
    Logger.info('[tools] Registering tools...');
    // Register generate_text tool
    server.tool('generate_text', 'Generate text using Gemini with context management', {
        prompt: z.string().describe('The prompt to generate text from'),
        maxTokens: z.number().optional().describe('Maximum number of tokens to generate'),
        temperature: z.number().optional().describe('Temperature for text generation'),
        topP: z.number().optional().describe('Top P for nucleus sampling'),
        topK: z.number().optional().describe('Top K for sampling'),
        stopSequences: z.array(z.string()).optional().describe('Sequences where generation should stop'),
        includeHistory: z.boolean().optional().describe('Whether to include conversation history'),
        contextMetadata: z.object({
            topic: z.string().optional().describe('Topic for context organization'),
            tags: z.array(z.string()).optional().describe('Tags for context categorization')
        }).optional().describe('Metadata for context tracking'),
        searchQuery: z.string().optional().describe('Query for semantic search of relevant context'),
        searchLimit: z.number().optional().describe('Maximum number of context entries to return')
    }, async (params, extra) => {
        try {
            // Apply defaults
            const maxTokens = params.maxTokens ?? 1024;
            const temperature = params.temperature ?? 0.7;
            const topP = params.topP ?? 0.95;
            const topK = params.topK ?? 40;
            const stopSequences = params.stopSequences ?? [];
            const includeHistory = params.includeHistory ?? true;
            const searchLimit = params.searchLimit ?? 10;
            // Get relevant context
            let relevantContext = [];
            if (params.searchQuery) {
                relevantContext = await contextManager.searchContext(params.searchQuery, searchLimit);
            }
            else if (includeHistory) {
                relevantContext = contextManager.context.slice(-searchLimit);
            }
            // Add the new prompt to context
            await contextManager.addEntry('user', params.prompt, params.contextMetadata);
            // TODO: Call Gemini API with context and prompt
            const response = 'Response from Gemini API (not implemented yet)';
            // Add the response to context
            await contextManager.addEntry('assistant', response);
            return {
                content: [{ type: 'text', text: response }]
            };
        }
        catch (error) {
            Logger.error('[generate_text] Error:', error);
            return {
                content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unknown error' }],
                isError: true
            };
        }
    });
    // Register search_context tool
    server.tool('search_context', 'Search for relevant context using semantic similarity', {
        query: z.string().describe('The search query to find relevant context'),
        limit: z.number().optional().describe('Maximum number of context entries to return')
    }, async (params, extra) => {
        try {
            const results = await contextManager.searchContext(params.query, params.limit);
            return {
                content: results.map(entry => ({
                    type: 'text',
                    text: entry.content,
                    metadata: {
                        role: entry.role,
                        timestamp: entry.timestamp,
                        ...entry.metadata
                    }
                }))
            };
        }
        catch (error) {
            Logger.error('[search_context] Error:', error);
            return {
                content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unknown error' }],
                isError: true
            };
        }
    });
    // Register get_context tool
    server.tool('get_context', 'Get the current context state', {
        includeSystem: z.boolean().optional().describe('Whether to include system messages')
    }, async (params, extra) => {
        try {
            const allContext = contextManager.context;
            const filteredContext = params.includeSystem
                ? allContext
                : allContext.filter(entry => entry.role !== 'system');
            return {
                content: filteredContext.map(entry => ({
                    type: 'text',
                    text: entry.content,
                    metadata: {
                        role: entry.role,
                        timestamp: entry.timestamp,
                        ...entry.metadata
                    }
                }))
            };
        }
        catch (error) {
            Logger.error('[get_context] Error:', error);
            return {
                content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unknown error' }],
                isError: true
            };
        }
    });
    // Register add_context tool
    server.tool('add_context', 'Add a new entry to the context', {
        content: z.string().describe('The content to add to context'),
        role: z.enum(['user', 'assistant', 'system']).describe('Role of the context entry'),
        metadata: z.object({
            topic: z.string().optional().describe('Topic for context organization'),
            tags: z.array(z.string()).optional().describe('Tags for context categorization')
        }).optional().describe('Metadata for context tracking')
    }, async (params, extra) => {
        try {
            await contextManager.addEntry(params.role, params.content, params.metadata);
            return {
                content: [{ type: 'text', text: 'Context entry added successfully' }]
            };
        }
        catch (error) {
            Logger.error('[add_context] Error:', error);
            return {
                content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unknown error' }],
                isError: true
            };
        }
    });
    Logger.info('[tools] Tools registered successfully');
}
