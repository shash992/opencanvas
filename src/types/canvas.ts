import type { Message } from '../services/storage/types'

export interface ChatNodeData {
  title?: string
  provider?: string
  model?: string
  messages?: Message[]
  systemPrompt?: string
  parentSummary?: string
  attachedMemoryNodes?: string[]
  // DEPRECATED: Context is now derived from edges dynamically
  // These fields are kept for backward compatibility but are no longer used
  parentMessages?: Message[] // @deprecated - use edges instead
  parentNodeId?: string // @deprecated - use edges instead
  parentNodeIds?: string[] // @deprecated - use edges instead
  zoom?: number // Zoom level for node content (0.5 to 2.0)
}

export interface MemoryNodeData {
  title?: string
  chunkCount?: number
  documentCount?: number
  embeddingProvider?: 'ollama' | 'openai' | 'openrouter'
}

