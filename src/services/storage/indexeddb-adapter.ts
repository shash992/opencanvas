import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { StorageAdapter, ChatData, CanvasState, CanvasSessionData, VectorStoreData } from './types'

interface OpenCanvasDB extends DBSchema {
  settings: {
    key: string
    value: string
  }
  chats: {
    key: string
    value: ChatData
  }
  canvas: {
    key: string
    value: CanvasState
  }
  canvasSessions: {
    key: string
    value: CanvasSessionData
  }
  vectorStores: {
    key: string
    value: VectorStoreData
  }
}

const DB_NAME = 'opencanvas'
const DB_VERSION = 2

class IndexedDBAdapter implements StorageAdapter {
  private db: IDBPDatabase<OpenCanvasDB> | null = null

  async init(): Promise<void> {
    this.db = await openDB<OpenCanvasDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
        if (!db.objectStoreNames.contains('chats')) {
          db.createObjectStore('chats')
        }
        if (!db.objectStoreNames.contains('canvas')) {
          db.createObjectStore('canvas')
        }
        if (!db.objectStoreNames.contains('vectorStores')) {
          db.createObjectStore('vectorStores')
        }
        if (!db.objectStoreNames.contains('canvasSessions')) {
          db.createObjectStore('canvasSessions')
        }
      },
    })
  }

  private ensureDB() {
    if (!this.db) {
      throw new Error('Storage not initialized. Call init() first.')
    }
    return this.db
  }

  async getSetting(key: string): Promise<string | null> {
    const db = this.ensureDB()
    return (await db.get('settings', key)) || null
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = this.ensureDB()
    await db.put('settings', value, key)
  }

  async deleteSetting(key: string): Promise<void> {
    const db = this.ensureDB()
    await db.delete('settings', key)
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const db = this.ensureDB()
    const keys = await db.getAllKeys('settings')
    const result: Record<string, string> = {}
    for (const key of keys) {
      const value = await db.get('settings', key)
      if (value) {
        result[key] = value
      }
    }
    return result
  }

  async saveChat(chatId: string, data: ChatData): Promise<void> {
    const db = this.ensureDB()
    await db.put('chats', data, chatId)
  }

  async getChat(chatId: string): Promise<ChatData | null> {
    const db = this.ensureDB()
    return (await db.get('chats', chatId)) || null
  }

  async getAllChats(): Promise<ChatData[]> {
    const db = this.ensureDB()
    return await db.getAll('chats')
  }

  async deleteChat(chatId: string): Promise<void> {
    const db = this.ensureDB()
    await db.delete('chats', chatId)
  }

  async saveCanvasState(state: CanvasState): Promise<void> {
    const db = this.ensureDB()
    await db.put('canvas', state, 'current')
  }

  async getCanvasState(): Promise<CanvasState | null> {
    const db = this.ensureDB()
    return (await db.get('canvas', 'current')) || null
  }

  async saveVectorStore(storeId: string, data: VectorStoreData): Promise<void> {
    const db = this.ensureDB()
    await db.put('vectorStores', data, storeId)
  }

  async getVectorStore(storeId: string): Promise<VectorStoreData | null> {
    const db = this.ensureDB()
    return (await db.get('vectorStores', storeId)) || null
  }

  async deleteVectorStore(storeId: string): Promise<void> {
    const db = this.ensureDB()
    await db.delete('vectorStores', storeId)
  }

  async saveCanvasSession(sessionId: string, data: CanvasSessionData): Promise<void> {
    const db = this.ensureDB()
    await db.put('canvasSessions', data, sessionId)
  }

  async getCanvasSession(sessionId: string): Promise<CanvasSessionData | null> {
    const db = this.ensureDB()
    return (await db.get('canvasSessions', sessionId)) || null
  }

  async getAllCanvasSessions(): Promise<CanvasSessionData[]> {
    const db = this.ensureDB()
    return await db.getAll('canvasSessions')
  }

  async deleteCanvasSession(sessionId: string): Promise<void> {
    const db = this.ensureDB()
    await db.delete('canvasSessions', sessionId)
  }
}

export default IndexedDBAdapter

