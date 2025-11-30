import { create } from 'zustand'
import type { CanvasState, CanvasNode, CanvasEdge, CanvasSessionData } from '../services/storage/types'
import { getStorage } from '../services/storage'
import type { Node, Edge, Viewport as ReactFlowViewport } from 'reactflow'

interface CanvasStoreState {
  nodes: Node[]
  edges: Edge[]
  viewport: ReactFlowViewport
  initialized: boolean
  currentSessionId: string | null
  sessions: CanvasSessionData[]
  isLoadingSession: boolean // Flag to prevent auto-save during session load
  isCreatingSession: boolean // Flag to prevent concurrent session creation

  // Actions
  loadCanvas: () => Promise<void>
  saveCanvas: () => Promise<void>
  loadSessions: () => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  createSession: () => Promise<void>
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  addNode: (node: Node) => Promise<void>
  updateNode: (id: string, updates: Partial<Node>) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  addEdge: (edge: Edge) => Promise<void>
  deleteEdge: (id: string) => Promise<void>
  setViewport: (viewport: ReactFlowViewport) => void
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  initialized: false,
  currentSessionId: null,
  sessions: [],
  isLoadingSession: false,
  isCreatingSession: false,

  loadCanvas: async () => {
    try {
      const storage = getStorage()
      const { currentSessionId } = get()
      
      // First, always load all sessions (sorted by last changed)
      const allSessions = await storage.getAllCanvasSessions()
      set({ sessions: allSessions.sort((a, b) => b.updatedAt - a.updatedAt) })
      
      // If we have a current session, load it
      if (currentSessionId) {
        const session = allSessions.find(s => s.id === currentSessionId)
        if (session) {
          await get().loadSession(currentSessionId)
          set({ initialized: true })
          return
        }
      }
      
      // If we have sessions but no current session, load the most recent
      if (allSessions.length > 0) {
        const mostRecent = allSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0]
        await get().loadSession(mostRecent.id)
        set({ initialized: true })
        return
      }
      
      // Fallback to legacy "current" canvas state
      const canvasState = await storage.getCanvasState()
      
      if (canvasState && canvasState.nodes && canvasState.nodes.length > 0) {
        // Migrate legacy canvas to a new session
        const sessionId = `canvas-${Date.now()}`
        const migratedSession: CanvasSessionData = {
          id: sessionId,
          title: 'Migrated Canvas',
          state: canvasState,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        await storage.saveCanvasSession(sessionId, migratedSession)
        
        // Load the migrated session
        await get().loadSession(sessionId)
        const updatedSessions = await storage.getAllCanvasSessions()
        set({ sessions: updatedSessions, initialized: true })
      } else {
        // No saved state, don't create a session yet - wait for first node
        set({ 
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          initialized: true 
        })
      }
    } catch (error) {
      console.error('Failed to load canvas:', error)
      // Initialize with empty state if load fails (don't create session yet)
      set({
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        initialized: true,
      })
    }
  },

  saveCanvas: async () => {
    try {
      const { nodes, edges, viewport, currentSessionId, isLoadingSession } = get()
      
      // Don't save if we're currently loading a session (prevents updating updatedAt on load)
      if (isLoadingSession) {
        console.log('Skipping save - session is being loaded')
        return
      }
      
      const storage = getStorage()

      // Convert ReactFlow Node[] to CanvasNode[]
      const canvasNodes: CanvasNode[] = nodes.map((node) => {
        const nodeData = node.data || {}
        const position = node.position || { x: 0, y: 0 }
        return {
          id: node.id,
          type: (node.type || 'chat') as 'chat' | 'memory',
          position: position, // Ensure position is always defined
          size: {
            width: (node.style?.width as number) || 400,
            height: (node.style?.height as number) || 500,
          },
          data: nodeData,
        }
      })
      
      // Log positions being saved for debugging
      console.log('💾 Saving node positions:', canvasNodes.map(n => ({
        id: n.id,
        position: n.position
      })))

      // Convert ReactFlow Edge[] to CanvasEdge[]
      const canvasEdges: CanvasEdge[] = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: (edge.type || 'context') as 'context' | 'rag',
      }))

      const canvasState: CanvasState = {
        nodes: canvasNodes,
        edges: canvasEdges,
        viewport: viewport,
        version: 1,
      }

      // Only save if we have nodes (don't save blank canvases)
      if (nodes.length === 0 && edges.length === 0) {
        console.log('Skipping save - canvas is empty')
        return
      }

      // Require a session to exist - don't create one here (let addNode/addEdge handle it)
      const sessionId = currentSessionId
      if (!sessionId) {
        console.log('Skipping save - no session exists (should be created by addNode/addEdge)')
        return
      }

      // Load existing session or create new one
      let session = get().sessions.find(s => s.id === sessionId) || undefined
      if (!session) {
        // Try loading from storage
        const loadedSession = await storage.getCanvasSession(sessionId)
        session = loadedSession || undefined
      }

      const updatedSession: CanvasSessionData = {
        id: sessionId,
        title: session?.title || 'New Canvas',
        state: canvasState,
        createdAt: session?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }
      
      await storage.saveCanvasSession(sessionId, updatedSession)
      console.log('Saved session:', sessionId, 'with', canvasNodes.length, 'nodes', {
        nodeIds: canvasNodes.map(n => n.id),
        edgeCount: canvasEdges.length,
        edgeIds: canvasEdges.map(e => e.id),
        edgeTypes: canvasEdges.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target }))
      })
      
      // Always reload sessions to ensure sidebar is updated (sorted by last changed)
      const updatedSessions = await storage.getAllCanvasSessions()
      console.log('Reloaded sessions:', updatedSessions.length)
      set({
        sessions: updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt),
        currentSessionId: sessionId,
      })
    } catch (error) {
      console.error('Failed to save canvas:', error)
    }
  },

  addNode: async (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }))
    // Ensure we have a session before saving (create if needed)
    let { currentSessionId } = get()
    if (!currentSessionId) {
      console.log('No session found, creating new session after adding node...')
      // Create a new session when first node is added
      await get().createSession()
      currentSessionId = get().currentSessionId
      console.log('Created session:', currentSessionId)
      if (!currentSessionId) {
        console.error('Failed to create session, aborting save')
        return
      }
    }
    // Save immediately - saveCanvas will handle the save
    console.log('Saving canvas with session:', currentSessionId)
    await get().saveCanvas()
  },

  updateNode: async (id, updates) => {
    set((state) => {
      const updatedNodes = state.nodes.map((node) => {
        if (node.id === id) {
          // When updating data, merge it properly to preserve all fields
          if (updates.data) {
            return {
              ...node,
              ...updates,
              data: {
                ...(node.data || {}),
                ...updates.data,
              },
            }
          }
          return { ...node, ...updates }
        }
        return node
      })
      return { nodes: updatedNodes }
    })
    // Immediate save on update (only if we have a session)
    await get().saveCanvas()
  },

  deleteNode: async (id) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
    }))
    // Immediate save on delete (only if we have a session)
    await get().saveCanvas()
  },

  addEdge: async (edge) => {
    set((state) => ({
      edges: [...state.edges, edge],
    }))
    // Ensure we have a session before saving (create if needed)
    let { currentSessionId } = get()
    if (!currentSessionId) {
      console.log('No session found, creating new session after adding edge...')
      await get().createSession()
      currentSessionId = get().currentSessionId
      if (!currentSessionId) {
        console.error('Failed to create session, aborting save')
        return
      }
    }
    // Immediate save on create
    await get().saveCanvas()
  },

  deleteEdge: async (id) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    }))
    // Immediate save on delete (only if we have a session)
    await get().saveCanvas()
  },

  setViewport: (viewport) => {
    set({ viewport })
    // Debounce viewport saves
    setTimeout(() => {
      get().saveCanvas()
    }, 1000)
  },

  setNodes: (nodes) => {
    set({ nodes })
    // Immediate save (called by React Flow on node changes)
    get().saveCanvas()
  },

  setEdges: (edges) => {
    set({ edges })
    // Immediate save (called by React Flow on edge changes)
    get().saveCanvas()
  },

  loadSessions: async () => {
    try {
      // Ensure storage is initialized
      const { initStorage } = await import('../services/storage')
      await initStorage()
      
      const storage = getStorage()
      const sessions = await storage.getAllCanvasSessions()
      console.log('loadSessions: Loaded', sessions.length, 'sessions:', sessions.map(s => ({ id: s.id, title: s.title })))
      set({ sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt) }) // Sort by last changed
    } catch (error) {
      console.error('Failed to load canvas sessions:', error)
      // Don't throw - just log the error
    }
  },

  loadSession: async (sessionId: string) => {
    try {
      // Set loading flag to prevent auto-save during load
      set({ isLoadingSession: true })
      
      const storage = getStorage()
      const session = await storage.getCanvasSession(sessionId)
      if (session) {
        const canvasState = session.state
        
        // Convert CanvasNode[] to ReactFlow Node[]
        const reactFlowNodes: Node[] = (canvasState.nodes || []).map((node) => {
          const nodeData = node.data || {}
          const position = node.position || { x: 0, y: 0 }
          return {
            id: node.id,
            type: node.type || 'chat',
            position: position, // Use saved position
            data: nodeData,
            style: {
              width: node.size?.width || 400,
              height: node.size?.height || 500,
            },
          }
        })
        
        // Log positions being loaded for debugging
        console.log('📦 Loading node positions:', reactFlowNodes.map(n => ({
          id: n.id,
          position: n.position
        })))

        // Convert CanvasEdge[] to ReactFlow Edge[]
        // Auto-detect RAG edges: if source is memory node and target is chat node, it's a RAG edge
        const reactFlowEdges: Edge[] = (canvasState.edges || []).map((edge) => {
          // If edge type is missing or 'context', check if it should be RAG
          if (!edge.type || edge.type === 'context') {
            const sourceNode = canvasState.nodes?.find(n => n.id === edge.source)
            const targetNode = canvasState.nodes?.find(n => n.id === edge.target)
            if (sourceNode?.type === 'memory' && targetNode?.type === 'chat') {
              console.log('🔧 [loadSession] Auto-detecting RAG edge:', {
                edgeId: edge.id,
                source: edge.source,
                target: edge.target,
                sourceType: sourceNode.type,
                targetType: targetNode.type,
              })
              return {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: 'rag' as const,
              }
            }
          }
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: (edge.type || 'context') as 'context' | 'rag',
          }
        })
        
        console.log('📦 [loadSession] Loaded edges:', {
          totalEdges: reactFlowEdges.length,
          edges: reactFlowEdges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type,
          })),
        })

        // Reload sessions to ensure we have the latest (sorted by last changed)
        // NOTE: We do NOT update updatedAt when loading - only when saving changes
        const sessions = await storage.getAllCanvasSessions()
        set({
          nodes: reactFlowNodes,
          edges: reactFlowEdges,
          viewport: canvasState.viewport || { x: 0, y: 0, zoom: 1 },
          currentSessionId: sessionId,
          sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt),
        })
        
        // Wait a bit for React Flow to sync, then clear loading flag
        setTimeout(() => {
          set({ isLoadingSession: false })
        }, 2000) // 2 seconds should be enough for React Flow to sync
      } else {
        set({ isLoadingSession: false })
      }
    } catch (error) {
      console.error('Failed to load canvas session:', error)
      set({ isLoadingSession: false })
    }
  },

  createSession: async () => {
    // Prevent creating multiple sessions if one already exists
    const { currentSessionId, isCreatingSession } = get()
    if (currentSessionId) {
      console.log('Session already exists:', currentSessionId, '- skipping creation')
      return
    }
    
    // Prevent concurrent session creation
    if (isCreatingSession) {
      console.log('Session creation already in progress - skipping')
      return
    }
    
    set({ isCreatingSession: true })
    
    try {
      const sessionId = `canvas-${Date.now()}`
      const { nodes, edges, viewport } = get()
      
      // Convert current nodes/edges to canvas format (should have at least one node)
      const canvasNodes: CanvasNode[] = nodes.map((node) => ({
        id: node.id,
        type: (node.type || 'chat') as 'chat' | 'memory',
        position: node.position,
        size: {
          width: (node.style?.width as number) || 400,
          height: (node.style?.height as number) || 500,
        },
        data: node.data || {},
      }))
      
      const canvasEdges: CanvasEdge[] = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: (edge.type || 'context') as 'context' | 'rag',
      }))
      
      const newSession: CanvasSessionData = {
        id: sessionId,
        title: 'New Canvas',
        state: {
          nodes: canvasNodes,
          edges: canvasEdges,
          viewport: viewport,
          version: 1,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      const storage = getStorage()
      await storage.saveCanvasSession(sessionId, newSession)
      console.log('Saved new session to storage:', sessionId, 'with', canvasNodes.length, 'nodes')
      const updatedSessions = await storage.getAllCanvasSessions()
      console.log('Loaded sessions from storage:', updatedSessions.length, updatedSessions.map(s => s.id))
      
      // Set the current session ID and update sessions list
      set({
        currentSessionId: sessionId,
        sessions: updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt),
        initialized: true,
        isCreatingSession: false,
      })
      console.log('Created session:', sessionId, 'Total sessions:', updatedSessions.length)
    } catch (error) {
      console.error('Failed to create canvas session:', error)
      set({ isCreatingSession: false })
    }
  },

  updateSessionTitle: async (sessionId: string, title: string) => {
    try {
      const storage = getStorage()
      const session = await storage.getCanvasSession(sessionId)
      if (session) {
        const updatedSession: CanvasSessionData = {
          ...session,
          title: title.trim() || 'Canvas Session',
          updatedAt: Date.now(),
        }
        await storage.saveCanvasSession(sessionId, updatedSession)
        // Reload all sessions to ensure sidebar is updated (sorted by last changed)
        const updatedSessions = await storage.getAllCanvasSessions()
        set({
          sessions: updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt)
        })
      }
    } catch (error) {
      console.error('Failed to update canvas session title:', error)
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      const storage = getStorage()
      await storage.deleteCanvasSession(sessionId)
      const { currentSessionId } = get()
      if (currentSessionId === sessionId) {
        set({
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          currentSessionId: null,
        })
      }
      await get().loadSessions()
    } catch (error) {
      console.error('Failed to delete canvas session:', error)
    }
  },
}))

