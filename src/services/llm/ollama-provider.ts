import type {
  LLMProvider,
  LLMMessage,
  LLMStreamChunk,
  ModelInfo,
  LLMOptions,
} from './types'

export class OllamaProvider implements LLMProvider {
  name = 'Ollama'
  provider = 'ollama' as const
  private baseUrl: string

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl
  }

  async *streamChat(
    messages: LLMMessage[],
    model: string,
    options: LLMOptions = {}
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
          top_p: options.topP,
          repeat_penalty: options.frequencyPenalty,
          stop: options.stop,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Ollama API error: ${error.error || 'Request failed'}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line)
              const content = parsed.message?.content || ''
              const done = parsed.done || false

              if (content) {
                yield { content, done: false }
              }

              if (done) {
                yield { content: '', done: true }
                return
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      yield { content: '', done: true }
    } finally {
      reader.releaseLock()
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return (data.models || []).map((m: { name: string; size?: number }) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as const,
        supportsStreaming: true,
        supportsTools: false,
      }))
    } catch {
      return []
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }
}

