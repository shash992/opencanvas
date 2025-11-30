import IndexedDBAdapter from './indexeddb-adapter'
import type { StorageAdapter } from './types'

let storageAdapter: StorageAdapter | null = null

export async function initStorage(): Promise<StorageAdapter> {
  if (storageAdapter) {
    return storageAdapter
  }

  // Browser: Use IndexedDB
  if (typeof window !== 'undefined') {
    const adapter = new IndexedDBAdapter()
    await adapter.init()
    storageAdapter = adapter
    return adapter
  }

  // Desktop/Docker: Will use filesystem adapter (to be implemented)
  throw new Error('Filesystem storage adapter not yet implemented')
}

export function getStorage(): StorageAdapter {
  if (!storageAdapter) {
    throw new Error('Storage not initialized. Call initStorage() first.')
  }
  return storageAdapter
}

