import type { EmbeddingProviderInterface } from './types'

export class OpenAIEmbeddingProvider implements EmbeddingProviderInterface {
  name = 'OpenAI'
  provider = 'openai' as const
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI embeddings error: ${error.error?.message || 'Request failed'}`)
    }

    const data = await response.json()
    return data.data[0].embedding as number[]
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI embeddings error: ${error.error?.message || 'Request failed'}`)
    }

    const data = await response.json()
    return data.data.map((item: { embedding: number[] }) => item.embedding)
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
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

