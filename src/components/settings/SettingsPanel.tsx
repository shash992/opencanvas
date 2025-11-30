import { useState, useEffect } from 'react'
import { useSettingsStore, type CustomModel } from '../../stores/settingsStore'
import type { Provider } from '../../services/llm/types'
import type { EmbeddingProvider } from '../../services/embeddings/types'
import './SettingsPanel.css'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'providers' | 'tools' | 'documents'

const PROVIDERS: Provider[] = ['ollama', 'openai', 'openrouter']

const PROVIDER_LABELS: Record<Provider, string> = {
  ollama: 'Ollama',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')
  const {
    providerConfig,
    enabledProviders,
    embeddingProvider,
    embeddingModels,
    updateProviderConfig,
    setEnabledProviders,
    setEmbeddingProvider,
    setEmbeddingModel,
    addCustomModel,
    removeCustomModel,
    getModelsForProvider,
  } = useSettingsStore()
  
  const [embeddingModelInputs, setEmbeddingModelInputs] = useState<Record<EmbeddingProvider, string>>({
    ollama: embeddingModels?.ollama || 'nomic-embed-text',
    openai: embeddingModels?.openai || 'text-embedding-3-small',
    openrouter: embeddingModels?.openrouter || 'text-embedding-3-small',
  })
  
  useEffect(() => {
    if (embeddingModels) {
      setEmbeddingModelInputs({
        ollama: embeddingModels.ollama || 'nomic-embed-text',
        openai: embeddingModels.openai || 'text-embedding-3-small',
        openrouter: embeddingModels.openrouter || 'text-embedding-3-small',
      })
    }
  }, [embeddingModels])

  const [openaiKey, setOpenaiKey] = useState(providerConfig.openai?.apiKey || '')
  const [openrouterKey, setOpenrouterKey] = useState(providerConfig.openrouter?.apiKey || '')
  const [ollamaUrl, setOllamaUrl] = useState(providerConfig.ollama?.baseUrl || 'http://localhost:11434')
  
  // Track new model names per provider
  const [newModelNames, setNewModelNames] = useState<Record<Provider, string>>({
    ollama: '',
    openai: '',
    openrouter: '',
  })

  // Sync local state with store when providerConfig changes
  useEffect(() => {
    setOpenaiKey(providerConfig.openai?.apiKey || '')
    setOpenrouterKey(providerConfig.openrouter?.apiKey || '')
    setOllamaUrl(providerConfig.ollama?.baseUrl || 'http://localhost:11434')
  }, [providerConfig])

  const handleSaveProviderConfig = async (provider: Provider) => {
    if (provider === 'openai') {
      await updateProviderConfig({
        openai: openaiKey ? { apiKey: openaiKey } : undefined,
      })
    } else if (provider === 'openrouter') {
      await updateProviderConfig({
        openrouter: openrouterKey ? { apiKey: openrouterKey } : undefined,
      })
    } else if (provider === 'ollama') {
      await updateProviderConfig({
        ollama: { baseUrl: ollamaUrl },
      })
    }
  }

  const handleToggleProvider = async (provider: Provider) => {
    const current = enabledProviders
    const updated = current.includes(provider)
      ? current.filter((p) => p !== provider)
      : [...current, provider]
    await setEnabledProviders(updated)
  }

  const handleAddModel = async (provider: Provider) => {
    const modelName = newModelNames[provider]?.trim()
    if (!modelName) return

    const model: CustomModel = {
      id: `${provider}-${modelName}-${Date.now()}`,
      name: modelName,
      provider: provider,
    }

    await addCustomModel(model)
    setNewModelNames({ ...newModelNames, [provider]: '' })
  }

  const handleRemoveModel = async (modelId: string) => {
    await removeCustomModel(modelId)
  }

  if (!isOpen) return null

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'providers' ? 'active' : ''}`}
            onClick={() => setActiveTab('providers')}
          >
            Models/Providers
          </button>
          <button
            className={`settings-tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            Tools
          </button>
          <button
            className={`settings-tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'providers' && (
            <div className="settings-tab-content">
              {PROVIDERS.map((provider, index) => {
                const isEnabled = enabledProviders.includes(provider)
                const models = getModelsForProvider(provider)
                const newModelName = newModelNames[provider] || ''

                return (
                  <div key={provider}>
                    <div className="settings-provider-section">
                      {/* Provider Toggle */}
                      <div className="settings-provider-header">
                        <label className={`settings-toggle-label ${!isEnabled ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            className="settings-toggle-input"
                            checked={isEnabled}
                            onChange={() => handleToggleProvider(provider)}
                          />
                          <span className="settings-toggle-slider"></span>
                          <span className={`settings-provider-name ${!isEnabled ? 'disabled' : ''}`}>
                            {PROVIDER_LABELS[provider]}
                          </span>
                        </label>
                      </div>

                      {/* Only show config when enabled */}
                      {isEnabled && (
                        <>
                          {/* API Key / Base URL */}
                          <div className="settings-provider-config">
                            {provider === 'ollama' ? (
                              <div className="settings-input-group">
                                <label htmlFor={`${provider}-url`}>Base URL:</label>
                                <input
                                  id={`${provider}-url`}
                                  type="text"
                                  value={ollamaUrl}
                                  onChange={(e) => setOllamaUrl(e.target.value)}
                                  placeholder="http://localhost:11434"
                                  onBlur={() => handleSaveProviderConfig(provider)}
                                />
                              </div>
                            ) : (
                              <div className="settings-input-group">
                                <label htmlFor={`${provider}-key`}>API Key:</label>
                                <input
                                  id={`${provider}-key`}
                                  type="password"
                                  value={provider === 'openai' ? openaiKey : openrouterKey}
                                  onChange={(e) => {
                                    if (provider === 'openai') {
                                      setOpenaiKey(e.target.value)
                                    } else {
                                      setOpenrouterKey(e.target.value)
                                    }
                                  }}
                                  placeholder={provider === 'openai' ? 'sk-...' : 'sk-or-...'}
                                  onBlur={() => handleSaveProviderConfig(provider)}
                                />
                              </div>
                            )}
                          </div>

                          {/* Model List */}
                          {models.length > 0 && (
                            <div className="settings-models-list">
                              {models.map((model) => (
                                <div key={model.id} className="settings-model-item">
                                  <span>{model.name}</span>
                                  <button
                                    onClick={() => handleRemoveModel(model.id)}
                                    className="settings-model-remove"
                                    aria-label="Remove model"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Model */}
                          <div className="settings-add-model">
                            <input
                              type="text"
                              value={newModelName}
                              onChange={(e) =>
                                setNewModelNames({ ...newModelNames, [provider]: e.target.value })
                              }
                              placeholder="Model name (e.g., gpt-4, llama2)"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddModel(provider)
                              }}
                            />
                            <button
                              onClick={() => handleAddModel(provider)}
                              disabled={!newModelName.trim()}
                            >
                              Add
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {index < PROVIDERS.length - 1 && <div className="settings-provider-divider" />}
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="settings-tab-content">
              <div className="settings-section">
                <h3>Tools</h3>
                <p className="settings-placeholder">Tool configuration coming soon...</p>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="settings-tab-content">
              <div className="settings-section">
                <h3>Embedding Provider</h3>
                <p className="settings-description">
                  Choose the embedding provider for document processing and RAG (Retrieval-Augmented Generation).
                </p>
                <div className="settings-embedding-provider">
                  {PROVIDERS.map((provider) => {
                    const isEnabled = enabledProviders.includes(provider)
                    const isSelected = embeddingProvider === provider
                    const providerKey = provider as EmbeddingProvider
                    const modelValue = embeddingModelInputs[providerKey] || ''
                    
                    return (
                      <div key={provider} className="settings-embedding-provider-group">
                        <label
                          className={`settings-embedding-option ${!isEnabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="embedding-provider"
                            value={provider}
                            checked={isSelected}
                            disabled={!isEnabled}
                            onChange={() => {
                              if (isEnabled) {
                                setEmbeddingProvider(providerKey)
                              }
                            }}
                          />
                          <span>{PROVIDER_LABELS[provider]}</span>
                          {!isEnabled && (
                            <span className="settings-embedding-note">(Enable in Models/Providers tab)</span>
                          )}
                        </label>
                        {isEnabled && (
                          <div className="settings-embedding-model-input">
                            <label htmlFor={`embedding-model-${provider}`}>Embedding Model:</label>
                            <input
                              id={`embedding-model-${provider}`}
                              type="text"
                              value={modelValue}
                              onChange={(e) => {
                                setEmbeddingModelInputs({
                                  ...embeddingModelInputs,
                                  [providerKey]: e.target.value,
                                })
                              }}
                              onBlur={() => {
                                if (modelValue.trim()) {
                                  setEmbeddingModel(providerKey, modelValue.trim())
                                }
                              }}
                              placeholder={
                                provider === 'ollama' 
                                  ? 'nomic-embed-text' 
                                  : 'text-embedding-3-small'
                              }
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button onClick={onClose} className="settings-close-button">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
