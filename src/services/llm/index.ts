import { OpenAIProvider } from './openai-provider'
import { OpenRouterProvider } from './openrouter-provider'
import { OllamaProvider } from './ollama-provider'
import type { LLMProvider, Provider, ProviderConfig } from './types'

export function createProvider(
  provider: Provider,
  config: ProviderConfig
): LLMProvider | null {
  switch (provider) {
    case 'openai':
      if (!config.openai?.apiKey) return null
      return new OpenAIProvider(config.openai.apiKey)
    case 'openrouter':
      if (!config.openrouter?.apiKey) return null
      return new OpenRouterProvider(config.openrouter.apiKey)
    case 'ollama':
      return new OllamaProvider(config.ollama?.baseUrl)
    default:
      return null
  }
}

export { OpenAIProvider, OpenRouterProvider, OllamaProvider }
export type { LLMProvider, Provider, ProviderConfig, LLMMessage, ModelInfo } from './types'

