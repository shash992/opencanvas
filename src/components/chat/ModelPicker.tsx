import { useState, useRef, useEffect } from 'react'
import type { ModelInfo } from '../../services/llm/types'
import type { Provider } from '../../services/llm/types'
import './ModelPicker.css'

interface ModelPickerProps {
  models: ModelInfo[]
  selectedModel: string
  selectedProvider: Provider
  onChange: (model: string) => void
  availableProviders: Provider[]
  disabled?: boolean
}

export default function ModelPicker({
  models,
  selectedModel,
  selectedProvider: _selectedProvider,
  onChange,
  availableProviders,
  disabled = false,
}: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    const provider = model.provider
    if (!acc[provider]) {
      acc[provider] = []
    }
    acc[provider].push(model)
    return acc
  }, {} as Record<Provider, ModelInfo[]>)

  // Filter models by search query
  const filteredModelsByProvider = Object.entries(modelsByProvider).reduce(
    (acc, [provider, providerModels]) => {
      const filtered = providerModels.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (filtered.length > 0) {
        acc[provider as Provider] = filtered
      }
      return acc
    },
    {} as Record<Provider, ModelInfo[]>
  )

  const selectedModelData = models.find((m) => m.id === selectedModel)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleModelSelect = (modelId: string) => {
    onChange(modelId)
    setIsOpen(false)
    setSearchQuery('')
  }

  if (models.length === 0) {
    return (
      <div className="model-picker">
        <button className="model-picker-trigger" disabled>
          No models
        </button>
      </div>
    )
  }

  return (
    <div className="model-picker" ref={dropdownRef}>
      <button
        className="model-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Select model"
      >
        <span className="model-picker-trigger-text">
          {selectedModelData
            ? selectedModelData.name
            : 'Select model'}
        </span>
        <svg
          className={`model-picker-chevron ${isOpen ? 'open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="model-picker-dropdown">
          <div className="model-picker-search">
            <input
              type="text"
              placeholder="Search models"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="model-picker-search-input"
              autoFocus
            />
          </div>

          <div className="model-picker-list">
            {availableProviders.length === 0 ? (
              <div className="model-picker-empty">No providers enabled</div>
            ) : (
              availableProviders.map((provider) => {
                const providerModels = filteredModelsByProvider[provider] || []
                if (providerModels.length === 0) return null

                return (
                  <div key={provider} className="model-picker-provider-section">
                    <div className="model-picker-provider-header">
                      <span className="model-picker-provider-name">
                        {provider === 'ollama'
                          ? 'Ollama'
                          : provider === 'openai'
                            ? 'OpenAI'
                            : 'OpenRouter'}
                      </span>
                    </div>
                    <div className="model-picker-models">
                      {providerModels.map((model) => (
                        <button
                          key={model.id}
                          className={`model-picker-model-item ${
                            model.id === selectedModel ? 'selected' : ''
                          }`}
                          onClick={() => handleModelSelect(model.id)}
                        >
                          <span className="model-picker-model-name">{model.name}</span>
                          {model.id === selectedModel && (
                            <svg
                              className="model-picker-check"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
