import type {
  LLMProvider,
  LLMMessage,
  LLMStreamChunk,
  ModelInfo,
  LLMOptions,
} from './types'

export class OpenRouterProvider implements LLMProvider {
  name = 'OpenRouter'
  provider = 'openrouter' as const
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async *streamChat(
    messages: LLMMessage[],
    model: string,
    options: LLMOptions = {}
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'OpenCanvas',
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        temperature: options.temperature ?? 1,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenRouter API error: ${error.error?.message || 'Request failed'}`)
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield { content: '', done: true }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                yield { content, done: false }
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
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch OpenRouter models')
    }

    const data = await response.json()
    return data.data.map((m: { id: string; name?: string; context_length?: number }) => ({
      id: m.id,
      name: m.name || m.id,
      provider: 'openrouter' as const,
      contextWindow: m.context_length,
      supportsStreaming: true,
      supportsTools: m.id.includes('gpt-4') || m.id.includes('claude'),
    }))
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

