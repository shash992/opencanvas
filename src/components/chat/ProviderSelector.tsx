import type { Provider } from '../../services/llm/types'
import './ProviderSelector.css'

interface ProviderSelectorProps {
  provider: Provider
  onChange: (provider: Provider) => void
  availableProviders: Provider[]
}

export default function ProviderSelector({
  provider,
  onChange,
  availableProviders,
}: ProviderSelectorProps) {
  const providers: { value: Provider; label: string }[] = [
    { value: 'ollama', label: 'Ollama' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'openrouter', label: 'OpenRouter' },
  ]

  return (
    <div className="provider-selector">
      <label htmlFor="provider-select">Provider:</label>
      <select
        id="provider-select"
        value={provider}
        onChange={(e) => onChange(e.target.value as Provider)}
        className="provider-select"
      >
        {providers
          .filter((p) => availableProviders.includes(p.value))
          .map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
      </select>
    </div>
  )
}

