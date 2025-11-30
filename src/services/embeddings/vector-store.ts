/**
 * Vector Store for RAG
 * Uses IndexedDB for browser storage
 */

import type { DocumentChunk, VectorStoreData } from '../storage/types'

export interface VectorSearchResult {
  chunk: DocumentChunk
  score: number
}

export class VectorStore {
  private storeId: string
  private chunks: DocumentChunk[] = []

  constructor(storeId: string, data?: VectorStoreData) {
    this.storeId = storeId
    if (data) {
      this.chunks = data.documents || []
    }
  }

  /**
   * Add or update chunks in the store
   */
  addChunks(chunks: DocumentChunk[]): void {
    const chunkMap = new Map<string, DocumentChunk>()
    
    // Add existing chunks
    this.chunks.forEach(chunk => chunkMap.set(chunk.id, chunk))
    
    // Add or update new chunks
    chunks.forEach(chunk => chunkMap.set(chunk.id, chunk))
    
    this.chunks = Array.from(chunkMap.values())
  }

  /**
   * Remove chunks by IDs
   */
  removeChunks(chunkIds: string[]): void {
    const idSet = new Set(chunkIds)
    this.chunks = this.chunks.filter(chunk => !idSet.has(chunk.id))
  }

  /**
   * Search for similar chunks using cosine similarity
   */
  search(queryEmbedding: number[], topK: number = 5): VectorSearchResult[] {
    if (this.chunks.length === 0) return []

    const results: VectorSearchResult[] = []

    for (const chunk of this.chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue

      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding)
      results.push({ chunk, score })
    }

    // Sort by score (descending) and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) return 0

    return dotProduct / denominator
  }

  /**
   * Get all chunks
   */
  getAllChunks(): DocumentChunk[] {
    return [...this.chunks]
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.length
  }

  /**
   * Export store data
   */
  export(embeddingProvider?: 'ollama' | 'openai' | 'openrouter', embeddingModel?: string): VectorStoreData {
    return {
      id: this.storeId,
      name: '', // Will be set by the memory node
      documents: this.chunks,
      metadata: {
        ...(embeddingProvider && { embeddingProvider }),
        ...(embeddingModel && { embeddingModel }),
      },
      createdAt: Date.now(),
    }
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks = []
  }
}

