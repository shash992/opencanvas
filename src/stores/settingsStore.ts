import { create } from 'zustand'
import { getStorage } from '../services/storage'
import type { ProviderConfig, Provider } from '../services/llm/types'

export interface CustomModel {
  id: string
  name: string
  provider: Provider
}

type EmbeddingProvider = 'ollama' | 'openai' | 'openrouter'

interface EmbeddingModelConfig {
  ollama?: string // e.g., 'nomic-embed-text'
  openai?: string // e.g., 'text-embedding-3-small'
  openrouter?: string // e.g., 'text-embedding-3-small'
}

interface SettingsState {
  providerConfig: ProviderConfig
  enabledProviders: Provider[]
  customModels: CustomModel[]
  embeddingProvider: EmbeddingProvider
  embeddingModels: EmbeddingModelConfig
  initialized: boolean

  loadSettings: () => Promise<void>
  saveSetting: (key: string, value: string) => Promise<void>
  getSetting: (key: string) => Promise<string | null>
  updateProviderConfig: (config: Partial<ProviderConfig>) => Promise<void>
  setEnabledProviders: (providers: Provider[]) => Promise<void>
  setEmbeddingProvider: (provider: EmbeddingProvider) => Promise<void>
  setEmbeddingModel: (provider: EmbeddingProvider, model: string) => Promise<void>
  addCustomModel: (model: CustomModel) => Promise<void>
  removeCustomModel: (modelId: string) => Promise<void>
  getModelsForProvider: (provider: Provider) => CustomModel[]
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  providerConfig: {},
  enabledProviders: ['ollama'],
  customModels: [],
  embeddingProvider: 'ollama',
  embeddingModels: {
    ollama: 'nomic-embed-text',
    openai: 'text-embedding-3-small',
    openrouter: 'text-embedding-3-small',
  },
  initialized: false,

  loadSettings: async () => {
    try {
      const storage = getStorage()
      const settings = await storage.getAllSettings()

      const config: ProviderConfig = {
        openai: settings.openai_api_key
          ? { apiKey: settings.openai_api_key }
          : undefined,
        openrouter: settings.openrouter_api_key
          ? { apiKey: settings.openrouter_api_key }
          : undefined,
        ollama: {
          baseUrl: settings.ollama_base_url || 'http://localhost:11434',
        },
      }

      // Load enabled providers
      const enabledProvidersStr = settings.enabled_providers || '["ollama"]'
      let enabledProviders: Provider[] = ['ollama']
      try {
        enabledProviders = JSON.parse(enabledProvidersStr)
      } catch {
        // Use default
      }

      // Load custom models
      const customModelsStr = settings.custom_models || '[]'
      let customModels: CustomModel[] = []
      try {
        customModels = JSON.parse(customModelsStr)
      } catch {
        // Use default
      }

      // Load embedding provider
      const embeddingProvider = (settings.embedding_provider || 'ollama') as EmbeddingProvider

      // Load embedding models
      const embeddingModelsStr = settings.embedding_models || '{}'
      let embeddingModels: EmbeddingModelConfig = {
        ollama: 'nomic-embed-text',
        openai: 'text-embedding-3-small',
        openrouter: 'text-embedding-3-small',
      }
      try {
        const loaded = JSON.parse(embeddingModelsStr)
        embeddingModels = { ...embeddingModels, ...loaded }
      } catch {
        // Use defaults
      }

      set({
        providerConfig: config,
        enabledProviders,
        customModels,
        embeddingProvider,
        embeddingModels,
        initialized: true,
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      // Initialize with defaults on error
      set({ 
        providerConfig: {
          ollama: {
            baseUrl: 'http://localhost:11434',
          },
        },
        enabledProviders: ['ollama'],
        customModels: [],
        embeddingProvider: 'ollama',
        embeddingModels: {
          ollama: 'nomic-embed-text',
          openai: 'text-embedding-3-small',
          openrouter: 'text-embedding-3-small',
        },
        initialized: true 
      })
    }
  },

  saveSetting: async (key: string, value: string) => {
    try {
      const storage = getStorage()
      await storage.setSetting(key, value)
    } catch (error) {
      console.error('Failed to save setting:', error)
    }
  },

  getSetting: async (key: string) => {
    try {
      const storage = getStorage()
      return await storage.getSetting(key)
    } catch {
      return null
    }
  },

  updateProviderConfig: async (config: Partial<ProviderConfig>) => {
    const current = get().providerConfig
    const updated = { ...current, ...config }

    // Save API keys to storage
    if (config.openai?.apiKey) {
      await get().saveSetting('openai_api_key', config.openai.apiKey)
    }
    if (config.openrouter?.apiKey) {
      await get().saveSetting('openrouter_api_key', config.openrouter.apiKey)
    }
    if (config.ollama?.baseUrl) {
      await get().saveSetting('ollama_base_url', config.ollama.baseUrl)
    }

    set({ providerConfig: updated })
  },

  setEnabledProviders: async (providers: Provider[]) => {
    const storage = getStorage()
    await storage.setSetting('enabled_providers', JSON.stringify(providers))
    set({ enabledProviders: providers })
  },

  setEmbeddingProvider: async (provider: EmbeddingProvider) => {
    const storage = getStorage()
    await storage.setSetting('embedding_provider', provider)
    set({ embeddingProvider: provider })
  },

  setEmbeddingModel: async (provider: EmbeddingProvider, model: string) => {
    const { embeddingModels } = get()
    const updated = {
      ...embeddingModels,
      [provider]: model,
    }
    const storage = getStorage()
    await storage.setSetting('embedding_models', JSON.stringify(updated))
    set({ embeddingModels: updated })
  },

  addCustomModel: async (model: CustomModel) => {
    const { customModels } = get()
    const updated = [...customModels, model]
    const storage = getStorage()
    await storage.setSetting('custom_models', JSON.stringify(updated))
    console.log('SettingsStore - Added model:', model)
    console.log('SettingsStore - Updated customModels:', updated)
    set({ customModels: updated })
  },

  removeCustomModel: async (modelId: string) => {
    const { customModels } = get()
    const updated = customModels.filter((m) => m.id !== modelId)
    const storage = getStorage()
    await storage.setSetting('custom_models', JSON.stringify(updated))
    set({ customModels: updated })
  },

  getModelsForProvider: (provider: Provider) => {
    return get().customModels.filter((m) => m.provider === provider)
  },
}))

