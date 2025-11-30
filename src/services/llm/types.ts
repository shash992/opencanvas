/**
 * LLM Provider Types
 */

export type Provider = 'openai' | 'openrouter' | 'ollama'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMStreamChunk {
  content: string
  done: boolean
}

export interface LLMProvider {
  name: string
  provider: Provider
  streamChat(
    messages: LLMMessage[],
    model: string,
    options?: LLMOptions
  ): AsyncGenerator<LLMStreamChunk, void, unknown>
  listModels(): Promise<ModelInfo[]>
  validateConfig(): Promise<boolean>
}

export interface ModelInfo {
  id: string
  name: string
  provider: Provider
  contextWindow?: number
  supportsStreaming?: boolean
  supportsTools?: boolean
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
}

export interface ProviderConfig {
  openai?: {
    apiKey: string
  }
  openrouter?: {
    apiKey: string
  }
  ollama?: {
    baseUrl?: string
  }
}

