import type { EmbeddingProviderInterface } from './types'

export class OllamaEmbeddingProvider implements EmbeddingProviderInterface {
  name = 'Ollama'
  provider = 'ollama' as const
  private baseUrl: string
  private model: string

  constructor(baseUrl = 'http://localhost:11434', model = 'nomic-embed-text') {
    this.baseUrl = baseUrl
    this.model = model
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Ollama embeddings error: ${error.error || 'Request failed'}`)
    }

    const data = await response.json()
    return data.embedding as number[]
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Ollama doesn't support batch embeddings, so we do them sequentially
    // In production, you might want to batch with Promise.all but limit concurrency
    const embeddings: number[][] = []
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text)
      embeddings.push(embedding)
    }
    return embeddings
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

