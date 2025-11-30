/**
 * Storage abstraction types
 * Supports both IndexedDB (browser) and filesystem (desktop/Docker)
 */

export interface StorageAdapter {
  // Settings
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  deleteSetting(key: string): Promise<void>
  getAllSettings(): Promise<Record<string, string>>

  // Chat history
  saveChat(chatId: string, data: ChatData): Promise<void>
  getChat(chatId: string): Promise<ChatData | null>
  getAllChats(): Promise<ChatData[]>
  deleteChat(chatId: string): Promise<void>

  // Canvas state (legacy - single canvas)
  saveCanvasState(state: CanvasState): Promise<void>
  getCanvasState(): Promise<CanvasState | null>

  // Canvas sessions (multiple canvases)
  saveCanvasSession(sessionId: string, data: CanvasSessionData): Promise<void>
  getCanvasSession(sessionId: string): Promise<CanvasSessionData | null>
  getAllCanvasSessions(): Promise<CanvasSessionData[]>
  deleteCanvasSession(sessionId: string): Promise<void>

  // Vector stores (for memory nodes)
  saveVectorStore(storeId: string, data: VectorStoreData): Promise<void>
  getVectorStore(storeId: string): Promise<VectorStoreData | null>
  deleteVectorStore(storeId: string): Promise<void>
}

export interface ChatData {
  id: string
  title: string
  messages: Message[]
  provider: 'openai' | 'openrouter' | 'ollama'
  model: string
  systemPrompt?: string
  createdAt: number
  updatedAt: number
  parentSummary?: string
  attachedMemoryNodes?: string[]
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: Viewport
  version: number
}

export interface CanvasSessionData {
  id: string
  title: string
  state: CanvasState
  createdAt: number
  updatedAt: number
}

export interface CanvasNode {
  id: string
  type: 'chat' | 'memory'
  position: { x: number; y: number }
  size: { width: number; height: number }
  data: unknown
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  type: 'context' | 'rag'
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface VectorStoreData {
  id: string
  name: string
  documents: DocumentChunk[]
  metadata: {
    embeddingProvider?: 'ollama' | 'openai' | 'openrouter'
    embeddingModel?: string
    [key: string]: unknown
  }
  createdAt: number
}

export interface DocumentChunk {
  id: string
  content: string
  embedding?: number[]
  metadata: Record<string, unknown>
}

