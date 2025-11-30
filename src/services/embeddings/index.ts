import type { EmbeddingProvider, EmbeddingProviderInterface, EmbeddingConfig } from './types'
import { OllamaEmbeddingProvider } from './ollama-embedding'
import { OpenAIEmbeddingProvider } from './openai-embedding'
import { OpenRouterEmbeddingProvider } from './openrouter-embedding'

export function createEmbeddingProvider(
  provider: EmbeddingProvider,
  config: EmbeddingConfig
): EmbeddingProviderInterface | null {
  switch (provider) {
    case 'ollama':
      return new OllamaEmbeddingProvider(
        config.ollama?.baseUrl,
        config.ollama?.model
      )
    case 'openai':
      if (!config.openai?.apiKey) return null
      return new OpenAIEmbeddingProvider(
        config.openai.apiKey,
        config.openai.model
      )
    case 'openrouter':
      if (!config.openrouter?.apiKey) return null
      return new OpenRouterEmbeddingProvider(
        config.openrouter.apiKey,
        config.openrouter.model
      )
    default:
      return null
  }
}

export * from './types'
export { OllamaEmbeddingProvider } from './ollama-embedding'
export { OpenAIEmbeddingProvider } from './openai-embedding'
export { OpenRouterEmbeddingProvider } from './openrouter-embedding'

