/**
 * Embedding Provider Types
 */

export type EmbeddingProvider = 'ollama' | 'openai' | 'openrouter'

export interface EmbeddingProviderInterface {
  name: string
  provider: EmbeddingProvider
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
  validateConfig(): Promise<boolean>
}

export interface EmbeddingConfig {
  ollama?: {
    baseUrl?: string
    model?: string // e.g., 'nomic-embed-text'
  }
  openai?: {
    apiKey: string
    model?: string // e.g., 'text-embedding-3-small'
  }
  openrouter?: {
    apiKey: string
    model?: string // e.g., 'text-embedding-3-small'
  }
}

