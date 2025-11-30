import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow'
import { useCanvasStore } from '../../../stores/canvasStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { createProvider } from '../../../services/llm'
import { createEmbeddingProvider } from '../../../services/embeddings/index'
import { VectorStore } from '../../../services/embeddings/vector-store'
import { getStorage } from '../../../services/storage'
import type { ChatNodeData } from '../../../types/canvas'
import type { Message } from '../../../services/storage/types'
import ModelPicker from '../../chat/ModelPicker'
import ChatInput from '../../chat/ChatInput'
import MessageList from '../../chat/MessageList'
import { XIcon } from '../../ui/Icons'
import './ChatNode.css'

function ChatNode({ data, selected, id }: NodeProps<ChatNodeData>) {
  const { updateNode, deleteNode, nodes, edges } = useCanvasStore()
  const { providerConfig, enabledProviders, customModels, initialized } = useSettingsStore()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(data.title || 'New Chat')
  const [provider, setProvider] = useState(data.provider || 'ollama')
  const [model, setModel] = useState(data.model || '')
  // Initialize messages from data
  const [messages, setMessages] = useState<Message[]>(data.messages || [])
  
  // Sync messages from data when it changes (e.g., after refresh)
  useEffect(() => {
    if (data.messages && data.messages.length > 0) {
      // Only update if data has messages and our state is empty or different
      if (messages.length === 0 || JSON.stringify(messages) !== JSON.stringify(data.messages)) {
        setMessages(data.messages)
        console.log('ChatNode synced messages from data:', {
          nodeId: id,
          messageCount: data.messages.length
        })
      }
    }
  }, [data.messages, id])
  
  // Helper function to collect context from donor nodes (source nodes connected via edges)
  // Donor nodes = nodes that have edges pointing TO this node (receiver)
  // This implements: "When two nodes are connected, the donor node context is injected to the receiver node context"
  const getContextFromDonorNodes = (): Array<{ nodeId: string; nodeTitle: string; messages: Message[] }> => {
    // Get fresh edges and nodes from store
    const currentState = useCanvasStore.getState()
    const currentEdges = currentState.edges
    const currentNodes = currentState.nodes
    
    // Find all edges where this node is the receiver (target)
    // First, get ALL incoming edges (regardless of type) for debugging
    const allIncomingEdges = currentEdges.filter(e => e.target === id)
    
    // Then filter for context edges
    const incomingEdges = allIncomingEdges.filter(e => e.type === 'context')
    
    console.log('🔍 Diagnosing context collection:', {
      receiverNodeId: id,
      receiverTitle: title,
      totalIncomingEdges: allIncomingEdges.length,
      contextEdgesCount: incomingEdges.length,
      allIncomingEdges: allIncomingEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type || 'undefined',
        hasType: !!e.type
      }))
    })
    
    const donorNodes: Array<{ nodeId: string; nodeTitle: string; messages: Message[] }> = []
    const skippedDonors: Array<{ reason: string; edgeId: string; sourceId: string }> = []
    
    for (const edge of incomingEdges) {
      // Find the donor node (source of the edge)
      const donorNode = currentNodes.find(n => n.id === edge.source)
      
      if (!donorNode) {
        skippedDonors.push({
          reason: 'Source node not found',
          edgeId: edge.id,
          sourceId: edge.source
        })
        console.warn('⚠️ Donor node not found:', {
          edgeId: edge.id,
          sourceId: edge.source,
          availableNodeIds: currentNodes.map(n => n.id)
        })
        continue
      }
      
      if (donorNode.type !== 'chat') {
        skippedDonors.push({
          reason: `Source node is not a chat node (type: ${donorNode.type})`,
          edgeId: edge.id,
          sourceId: edge.source
        })
        console.warn('⚠️ Donor node is not a chat node:', {
          edgeId: edge.id,
          sourceId: edge.source,
          nodeType: donorNode.type
        })
        continue
      }
      
      const donorData = donorNode.data as ChatNodeData
      // Get messages from donor node - these will be injected as context
      const donorMessages = donorData.messages || []
      
      console.log('📦 Checking donor node:', {
        edgeId: edge.id,
        donorNodeId: donorNode.id,
        donorTitle: donorData.title,
        messageCount: donorMessages.length,
        hasMessages: donorMessages.length > 0
      })
      
      // IMPORTANT: Include donor even if it has no messages yet
      // The context structure should be preserved
      donorNodes.push({
        nodeId: donorNode.id,
        nodeTitle: donorData.title || 'Untitled',
        messages: donorMessages
      })
    }
    
    console.log('✅ Context from donor nodes:', {
      receiverNodeId: id,
      receiverTitle: title,
      incomingEdgesCount: incomingEdges.length,
      donorNodesCount: donorNodes.length,
      skippedCount: skippedDonors.length,
      donors: donorNodes.map(d => ({
        id: d.nodeId,
        title: d.nodeTitle,
        messageCount: d.messages.length
      })),
      skipped: skippedDonors
    })
    
    return donorNodes
  }
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const messageListRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when messages change (including during streaming)
  useEffect(() => {
    if (messageListRef.current && messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (messageListRef.current) {
          // Scroll to bottom to show latest message
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight
        }
      })
    }
  }, [messages, isLoading]) // Also scroll when loading state changes (during streaming)

  // Sync provider and model from data when it changes (only on mount or when data explicitly changes)
  useEffect(() => {
    // Only sync if data has explicit values and they differ from current state
    if (data.provider && data.provider !== provider) {
      setProvider(data.provider)
    }
    if (data.model && data.model !== model) {
      setModel(data.model)
    }
  }, [data.provider, data.model]) // Remove provider/model from deps to avoid loops

  // Update available models when provider or settings change
  useEffect(() => {
    if (!initialized) {
      console.log('ChatNode - Not initialized yet', { nodeId: id })
      return
    }

    console.log('ChatNode - Updating models', {
      nodeId: id,
      provider,
      customModelsCount: customModels.length,
      enabledProviders,
      initialized
    })

    // Filter custom models for the current provider
    let providerModels = customModels.filter((m) => m.provider === provider)
    let currentProvider = provider

    // If current provider has no models, try to find a provider that does
    if (providerModels.length === 0 && customModels.length > 0) {
      // Find first enabled provider that has models
      const providerWithModels = enabledProviders.find((p) =>
        customModels.some((m) => m.provider === p)
      )
      if (providerWithModels) {
        currentProvider = providerWithModels
        providerModels = customModels.filter((m) => m.provider === currentProvider)
        setProvider(currentProvider)
      }
    }

    const models = providerModels.map((m) => ({
      id: m.name,
      name: m.name,
      provider: m.provider,
      supportsStreaming: true,
      supportsTools: false,
    }))
    
    console.log('ChatNode - Setting available models', {
      nodeId: id,
      provider: currentProvider,
      modelCount: models.length,
      models: models.map(m => m.name),
      currentModel: model
    })
    
    setAvailableModels(models)
    
    // Only auto-select a model if:
    // 1. There are models available
    // 2. No model is currently set (not if model is invalid - preserve user selection)
    if (models.length > 0 && !model) {
      setModel(models[0].id)
    } else if (models.length === 0) {
      setModel('')
    }
    // Don't auto-change model if it's set but not found - might be intentional or temporary
  }, [provider, initialized, customModels, enabledProviders, id]) // Removed model from deps

  // Get node position from store
  const currentNode = nodes.find((n) => n.id === id)
  const nodePosition = currentNode?.position || { x: 0, y: 0 }

  // Diagnostic: Log full RAG pipeline state on mount
  useEffect(() => {
    console.log('🔬 [ChatNode] RAG Pipeline Diagnostic:', {
      nodeId: id,
      nodeTitle: title,
      nodeType: 'chat',
      currentAttachedMemoryNodes: data.attachedMemoryNodes || [],
      hasMessages: (data.messages || []).length > 0,
    })
    
    const state = useCanvasStore.getState()
    const allEdges = state.edges
    const allNodes = state.nodes
    
    const incomingEdges = allEdges.filter(e => e.target === id)
    const memoryNodes = allNodes.filter(n => n.type === 'memory')
    
    console.log('🔬 [ChatNode] Full Pipeline State:', {
      totalEdges: allEdges.length,
      incomingEdges: incomingEdges.length,
      incomingEdgeDetails: incomingEdges.map(e => {
        const sourceNode = allNodes.find(n => n.id === e.source)
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          sourceNodeType: sourceNode?.type,
          sourceNodeTitle: (sourceNode?.data as any)?.title,
          shouldBeRAG: sourceNode?.type === 'memory',
        }
      }),
      memoryNodesInCanvas: memoryNodes.length,
      memoryNodeIds: memoryNodes.map(n => n.id),
      expectedAttachedMemoryNodes: incomingEdges
        .filter(e => {
          const sourceNode = allNodes.find(n => n.id === e.source)
          return sourceNode?.type === 'memory'
        })
        .map(e => e.source),
    })
  }, []) // Run once on mount
  
  // Sync attachedMemoryNodes from RAG edges
  useEffect(() => {
    // Get fresh state from store (including current node data)
    const currentState = useCanvasStore.getState()
    const currentNode = currentState.nodes.find(n => n.id === id)
    const currentData = (currentNode?.data as ChatNodeData) || {}
    const currentAttachedInData = currentData.attachedMemoryNodes || []
    
    console.log('🔄 [ChatNode] Syncing attachedMemoryNodes from RAG edges:', {
      nodeId: id,
      nodeTitle: title,
      currentAttachedInData,
      currentNodeExists: !!currentNode,
    })
    
    try {
      // Get fresh edges from store to avoid stale closures
      const currentEdges = currentState.edges
      const currentNodes = currentState.nodes
      
      console.log('🔄 [ChatNode] Store state:', {
        totalEdges: currentEdges.length,
        totalNodes: currentNodes.length,
        thisNodeExists: currentNodes.some(n => n.id === id),
      })
      
      console.log('🔄 [ChatNode] Current edges in store:', {
        totalEdges: currentEdges.length,
        allEdges: currentEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
        })),
      })
      
      // Find all incoming edges to this chat node
      const allIncomingEdges = currentEdges.filter(e => e.target === id)
      
      console.log('🔄 [ChatNode] Incoming edges analysis:', {
        allIncomingCount: allIncomingEdges.length,
        incomingEdges: allIncomingEdges.map(e => {
          const sourceNode = currentNodes.find(n => n.id === e.source)
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type,
            sourceNodeType: sourceNode?.type,
            sourceNodeExists: !!sourceNode,
          }
        }),
      })
      
      // Check for edges that should be RAG edges (memory → chat) but aren't marked as such
      const edgesToFix: Array<{ edgeId: string; sourceNodeId: string }> = []
      
      allIncomingEdges.forEach(edge => {
        const sourceNode = currentNodes.find(n => n.id === edge.source) // FIX: Use currentNodes, not nodes
        // If source is memory node and edge is not RAG, mark for fix
        if (sourceNode?.type === 'memory' && edge.type !== 'rag') {
          edgesToFix.push({ edgeId: edge.id, sourceNodeId: edge.source })
          console.warn('⚠️ [ChatNode] Found edge that should be RAG but is not:', {
            edgeId: edge.id,
            source: edge.source,
            target: edge.target,
            currentType: edge.type,
            shouldBe: 'rag',
          })
        }
      })
      
      // Find all RAG edges pointing to this chat node (including ones we'll fix)
      const ragEdges = allIncomingEdges.filter(
        e => {
          const sourceNode = currentNodes.find(n => n.id === e.source)
          const isRAG = (e.type === 'rag') || (sourceNode?.type === 'memory' && e.target === id)
          if (isRAG) {
            console.log('✅ [ChatNode] Found RAG edge:', {
              edgeId: e.id,
              source: e.source,
              target: e.target,
              type: e.type,
              sourceNodeType: sourceNode?.type,
              detectedAsRAG: e.type !== 'rag' && sourceNode?.type === 'memory',
            })
          }
          return isRAG
        }
      )
      const memoryNodeIds = ragEdges.map(e => e.source).filter(Boolean)
      
      console.log('🔄 [ChatNode] RAG edge detection result:', {
        ragEdgeCount: ragEdges.length,
        memoryNodeIds,
        edgesToFixCount: edgesToFix.length,
      })
      
      // If we found edges to fix, update them (this will trigger a re-render)
      if (edgesToFix.length > 0) {
        console.log('🔧 [ChatNode] Fixing edge types:', edgesToFix)
        const { setEdges: setStoreEdges } = useCanvasStore.getState()
        const fixedEdges = currentEdges.map(edge => {
          const needsFix = edgesToFix.find(f => f.edgeId === edge.id)
          if (needsFix) {
            return { ...edge, type: 'rag' as const }
          }
          return edge
        })
        setStoreEdges(fixedEdges)
      }
      
      console.log('🔄 [ChatNode] RAG edges found:', {
        ragEdgeCount: ragEdges.length,
        ragEdges: ragEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
        })),
        memoryNodeIds,
      })
      
      // Update attachedMemoryNodes if it's different
      // Use currentData from store, not props data (which might be stale)
      const needsUpdate = 
        memoryNodeIds.length !== currentAttachedInData.length ||
        memoryNodeIds.some(id => !currentAttachedInData.includes(id)) ||
        currentAttachedInData.some(id => !memoryNodeIds.includes(id))
      
      console.log('🔄 [ChatNode] Comparison:', {
        currentAttached: currentAttachedInData,
        memoryNodeIds,
        needsUpdate,
        lengthMatch: memoryNodeIds.length === currentAttachedInData.length,
        allIdsMatch: memoryNodeIds.every(id => currentAttachedInData.includes(id)) && 
                     currentAttachedInData.every(id => memoryNodeIds.includes(id)),
      })
      
      if (needsUpdate) {
        console.log('🔄 [ChatNode] Updating attachedMemoryNodes:', {
          from: currentAttachedInData,
          to: memoryNodeIds,
          nodeId: id,
        })
        
        const updatedData = {
          ...currentData, // Use currentData from store, not props data
          attachedMemoryNodes: memoryNodeIds,
        }
        
        console.log('🔄 [ChatNode] Calling updateNode with:', {
          nodeId: id,
          updatedData,
        })
        
        updateNode(id, {
          data: updatedData,
        } as any)
        
        console.log('✅ [ChatNode] updateNode called - checking if it took effect...')
        
        // Verify the update after a short delay
        setTimeout(() => {
          const verifyState = useCanvasStore.getState()
          const verifyNode = verifyState.nodes.find(n => n.id === id)
          const verifyData = verifyNode?.data as ChatNodeData
          console.log('🔍 [ChatNode] Verification after update:', {
            nodeFound: !!verifyNode,
            attachedMemoryNodes: verifyData?.attachedMemoryNodes || [],
            expected: memoryNodeIds,
            matches: JSON.stringify(verifyData?.attachedMemoryNodes || []) === JSON.stringify(memoryNodeIds),
          })
        }, 100)
      } else {
        console.log('ℹ️ [ChatNode] No update needed, attachedMemoryNodes already in sync:', {
          current: currentAttachedInData,
          expected: memoryNodeIds,
        })
      }
    } catch (error) {
      console.error('❌ [ChatNode] Error syncing attachedMemoryNodes:', error)
      console.error('❌ [ChatNode] Error stack:', error instanceof Error ? error.stack : 'No stack')
    }
  }, [edges, id, updateNode, title]) // Re-run when edges change - removed data from deps to avoid stale closures

  // Save node data when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Get current node data from store to preserve all fields
      const currentNode = useCanvasStore.getState().nodes.find(n => n.id === id)
      const currentData = (currentNode?.data as ChatNodeData) || {}
      
      const updatedData: ChatNodeData = {
        ...currentData, // Preserve all existing data fields first
        ...data, // Then apply props data
        title,
        provider,
        model,
        messages: messages.length > 0 ? messages : (currentData.messages || []), // Preserve messages if current state is empty
        // Note: parentMessages removed - context is now derived from edges dynamically
      }
      
      console.log('ChatNode saving data:', {
        nodeId: id,
        title,
        messageCount: messages.length
      })
      
      updateNode(id, {
        data: updatedData,
      } as any)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [title, provider, model, messages, id, updateNode, data, nodePosition])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    updateNode(id, {
      data: {
        ...data,
        title: newTitle,
      },
    } as any)
  }

  const handleSend = async (content: string) => {
    if (isLoading || !model) return

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    setIsLoading(true)
    setError(null)

    try {
      const llmProvider = createProvider(provider as any, providerConfig)
      if (!llmProvider) {
        throw new Error(`Provider ${provider} not configured`)
      }

      const systemPrompt = data.systemPrompt || ''
      
      // Collect context from donor nodes (nodes connected via edges)
      // Donor nodes = source nodes, Receiver node = this node
      const donorNodes = getContextFromDonorNodes()
      
      console.log('handleSend - Injecting context from donor nodes:', {
        receiverNodeId: id,
        receiverTitle: title,
        donorCount: donorNodes.length,
        totalDonorMessages: donorNodes.reduce((sum, donor) => sum + donor.messages.length, 0),
        donors: donorNodes.map(d => ({ id: d.nodeId, title: d.nodeTitle, messages: d.messages.length }))
      })
      
      // RAG: Query attached memory nodes
      // Read from store state to get fresh data (not from props which might be stale)
      const currentState = useCanvasStore.getState()
      const currentNode = currentState.nodes.find(n => n.id === id)
      const currentData = (currentNode?.data as ChatNodeData) || {}
      let attachedMemoryNodes = currentData.attachedMemoryNodes || []
      
      // Fallback: If attachedMemoryNodes is empty, detect RAG edges on-the-fly
      if (attachedMemoryNodes.length === 0) {
        const allIncomingEdges = currentState.edges.filter(e => e.target === id)
        const ragEdges = allIncomingEdges.filter(e => {
          const sourceNode = currentState.nodes.find(n => n.id === e.source)
          return (e.type === 'rag') || (sourceNode?.type === 'memory' && e.target === id)
        })
        const detectedMemoryNodes = ragEdges.map(e => e.source).filter(Boolean)
        
        if (detectedMemoryNodes.length > 0) {
          console.warn('⚠️ [RAG] attachedMemoryNodes was empty, but detected RAG edges on-the-fly:', {
            detectedMemoryNodes,
            ragEdges: ragEdges.map(e => ({ id: e.id, source: e.source, type: e.type })),
          })
          attachedMemoryNodes = detectedMemoryNodes
          
          // Try to update the node data for future use
          try {
            updateNode(id, {
              data: {
                ...currentData,
                attachedMemoryNodes: detectedMemoryNodes,
              },
            } as any)
            console.log('✅ [RAG] Updated attachedMemoryNodes on-the-fly')
          } catch (err) {
            console.error('❌ [RAG] Failed to update attachedMemoryNodes:', err)
          }
        }
      }
      
      console.log('🔍 [RAG] Checking for RAG query:', {
        nodeId: id,
        attachedMemoryNodes,
        attachedCount: attachedMemoryNodes.length,
        hasContent: !!content.trim(),
        willQuery: attachedMemoryNodes.length > 0 && content.trim(),
        fromProps: data.attachedMemoryNodes || [],
        fromStore: currentData.attachedMemoryNodes || [],
        finalAttached: attachedMemoryNodes,
      })
      
      // Initialize ragContext at function scope so it's accessible later
      let ragContext = ''
      
      if (attachedMemoryNodes.length > 0 && content.trim()) {
        console.log('🔍 [RAG] Starting RAG query for', attachedMemoryNodes.length, 'memory node(s)')
        try {
          // First, check what providers/models were used for the attached memory nodes
          const storage = getStorage()
          const memoryNodeProviders = new Map<string, { provider: string; model: string }>()
          
          for (const memoryNodeId of attachedMemoryNodes) {
            const storeData = await storage.getVectorStore(memoryNodeId)
            if (storeData?.metadata) {
              const provider = storeData.metadata.embeddingProvider as string | undefined
              const model = storeData.metadata.embeddingModel as string | undefined
              if (provider && model) {
                memoryNodeProviders.set(memoryNodeId, { provider, model })
              }
            }
          }
          
          // Determine which provider/model to use for query
          // Priority: Use the provider/model from the first memory node (or most common)
          // If no stored metadata, fall back to current settings
          let embeddingProviderType: 'ollama' | 'openai' | 'openrouter' = 'ollama'
          let embeddingModel: string = 'nomic-embed-text'
          
          if (memoryNodeProviders.size > 0) {
            // Use the provider/model from the first memory node
            const firstProvider = Array.from(memoryNodeProviders.values())[0]
            embeddingProviderType = firstProvider.provider as 'ollama' | 'openai' | 'openrouter'
            embeddingModel = firstProvider.model || 'nomic-embed-text' // Fallback if model is missing
            
            console.log('🔍 [RAG] Using stored embedding provider/model:', {
              provider: embeddingProviderType,
              model: embeddingModel,
              fromMemoryNode: attachedMemoryNodes[0],
            })
            
            // Check if all memory nodes use the same provider
            const allProviders = Array.from(memoryNodeProviders.values())
            const uniqueProviders = new Set(allProviders.map(p => p.provider))
            if (uniqueProviders.size > 1) {
              console.warn('⚠️ [RAG] Multiple embedding providers detected across memory nodes:', {
                providers: Array.from(uniqueProviders),
                warning: 'Using first provider. Results may be inconsistent.',
              })
            }
          } else {
            // Fallback to current settings if no stored metadata
            const { embeddingProvider: configuredEmbeddingProvider } = useSettingsStore.getState()
            embeddingProviderType = enabledProviders.includes(configuredEmbeddingProvider as any)
              ? configuredEmbeddingProvider
              : enabledProviders.includes('ollama')
                ? 'ollama'
                : (enabledProviders[0] as 'ollama' | 'openai' | 'openrouter') || 'ollama'
            
            const { embeddingModels } = useSettingsStore.getState()
            embeddingModel = embeddingModels[embeddingProviderType] || 'nomic-embed-text'
            
            console.log('🔍 [RAG] No stored metadata found, using current settings:', {
              provider: embeddingProviderType,
              model: embeddingModel,
            })
          }
          
          // Create embedding config with model
          const embeddingConfig = {
            ...providerConfig,
            [embeddingProviderType]: {
              ...providerConfig[embeddingProviderType as keyof typeof providerConfig],
              model: embeddingModel,
            },
          }
          
          console.log('🔍 [RAG] Creating embedding service:', {
            provider: embeddingProviderType,
            model: embeddingModel,
            config: embeddingConfig,
          })
          
          const embeddingService = createEmbeddingProvider(embeddingProviderType, embeddingConfig)
          if (embeddingService) {
            console.log('🔍 [RAG] Generating query embedding for:', {
              query: content,
              provider: embeddingProviderType,
              model: embeddingModel,
            })
            
            const queryEmbedding = await embeddingService.generateEmbedding(content)
            console.log('🔍 [RAG] Query embedding generated:', {
              embeddingLength: queryEmbedding.length,
              embeddingPreview: queryEmbedding.slice(0, 5),
            })
            
            // Query all attached memory nodes
            const allResults: Array<{ content: string; score: number; source: string; metadata?: any }> = []
            
            console.log('🔍 [RAG] Querying memory nodes:', attachedMemoryNodes)
            for (const memoryNodeId of attachedMemoryNodes) {
              console.log('🔍 [RAG] Querying memory node:', memoryNodeId)
              try {
                const storeData = await storage.getVectorStore(memoryNodeId)
                if (storeData) {
                  // Check embedding provider consistency
                  const storedProvider = storeData.metadata?.embeddingProvider as 'ollama' | 'openai' | 'openrouter' | undefined
                  const storedModel = storeData.metadata?.embeddingModel as string | undefined
                  
                  console.log('🔍 [RAG] Found vector store:', {
                    memoryNodeId,
                    chunkCount: storeData.documents?.length || 0,
                    storeName: storeData.name,
                    storedProvider,
                    storedModel,
                    queryProvider: embeddingProviderType,
                    queryModel: embeddingModel,
                  })
                  
                  // Warn if provider mismatch
                  if (storedProvider && storedProvider !== embeddingProviderType) {
                    console.warn('⚠️ [RAG] Embedding provider mismatch!', {
                      memoryNodeId,
                      storedProvider,
                      queryProvider: embeddingProviderType,
                      warning: 'Embeddings from different providers are not comparable. Results may be inaccurate.',
                    })
                  }
                  
                  // Warn if model mismatch (same provider, different model)
                  if (storedProvider === embeddingProviderType && storedModel && storedModel !== embeddingModel) {
                    console.warn('⚠️ [RAG] Embedding model mismatch!', {
                      memoryNodeId,
                      storedModel,
                      queryModel: embeddingModel,
                      warning: 'Different models may produce different embedding spaces. Results may be less accurate.',
                    })
                  }
                  
                  const vectorStore = new VectorStore(memoryNodeId, storeData)
                  const results = vectorStore.search(queryEmbedding, 3) // Top 3 per memory node
                  
                  console.log('🔍 [RAG] Search results from', memoryNodeId, ':', {
                    resultCount: results.length,
                    results: results.map((r, idx) => ({
                      index: idx + 1,
                      score: r.score,
                      contentPreview: r.chunk.content.substring(0, 100) + '...',
                      contentLength: r.chunk.content.length,
                      metadata: r.chunk.metadata,
                    })),
                  })
                  
                  // Log full content of each result
                  results.forEach((result, idx) => {
                    console.log(`📄 [RAG] Result ${idx + 1} from ${memoryNodeId}:`, {
                      score: result.score,
                      content: result.chunk.content,
                      metadata: result.chunk.metadata,
                      contentLength: result.chunk.content.length,
                    })
                    
                    allResults.push({
                      content: result.chunk.content,
                      score: result.score,
                      source: storeData.name || memoryNodeId,
                      metadata: result.chunk.metadata,
                    })
                  })
                } else {
                  console.warn('⚠️ [RAG] No vector store data found for:', memoryNodeId)
                }
              } catch (err) {
                console.error('❌ [RAG] Error querying memory node', memoryNodeId, ':', err)
              }
            }
            
            // Sort by score and take top 5 overall
            allResults.sort((a, b) => b.score - a.score)
            const topResults = allResults.slice(0, 5)
            
            console.log('🔍 [RAG] Final aggregated results:', {
              totalResults: allResults.length,
              topResultsCount: topResults.length,
              allScores: allResults.map(r => ({ score: r.score, source: r.source })),
              topScores: topResults.map(r => ({ score: r.score, source: r.source })),
            })
            
            // Log each top result in detail
            topResults.forEach((result, idx) => {
              console.log(`🏆 [RAG] Top Result ${idx + 1}:`, {
                score: result.score,
                source: result.source,
                content: result.content,
                contentLength: result.content.length,
                metadata: result.metadata,
              })
            })
            
            if (topResults.length > 0) {
              ragContext = '\n\nRelevant context from memory:\n' + 
                topResults.map((r, i) => `[${i + 1}] (from "${r.source}"): ${r.content}`).join('\n\n')
              
              console.log('✅ [RAG] RAG context generated:', {
                contextLength: ragContext.length,
                resultCount: topResults.length,
                contextPreview: ragContext.substring(0, 200) + '...',
                fullContext: ragContext,
              })
            } else {
              console.warn('⚠️ [RAG] No results found from memory nodes')
            }
          } else {
            console.warn('⚠️ [RAG] Embedding service not available')
          }
        } catch (err) {
          console.error('RAG query failed:', err)
          // Continue without RAG context if it fails
        }
      }
      
      // Build messages array with parent context included as actual conversation history
      const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
      
      // Add system prompt if exists
      if (systemPrompt) {
        llmMessages.push({ role: 'system', content: systemPrompt })
      }
      
      // Inject context from donor nodes into receiver node
      // This works for:
      // - Branching: parent (donor) → child (receiver)
      // - Merging: multiple parents (donors) → merged node (receiver)
      if (donorNodes.length > 0) {
        // Add context from each donor node
        donorNodes.forEach((donor, index) => {
          // Add header identifying the donor
          llmMessages.push({
            role: 'system',
            content: `Context from "${donor.nodeTitle}" (donor node):`
          })
          
          // Inject all messages from the donor node
          donor.messages.forEach((msg) => {
            // Only include user and assistant messages (skip system messages from donor)
            if (msg.role === 'user' || msg.role === 'assistant') {
              llmMessages.push({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              })
            }
          })
          
          // Add separator between multiple donors (except after last one)
          if (index < donorNodes.length - 1) {
            llmMessages.push({
              role: 'system',
              content: '---'
            })
          }
        })
        
        // Add final separator before receiver's own conversation
        llmMessages.push({
          role: 'system',
          content: '--- End of donor context. Continue the conversation below. ---'
        })
      }
      
      // Add RAG context if available (after parent context, before current messages)
      if (ragContext) {
        const ragSystemMessage = `The following context is retrieved from attached memory nodes:${ragContext}\n\nUse this context to inform your response.`
        console.log('📤 [RAG] Adding RAG context to LLM messages:', {
          messageLength: ragSystemMessage.length,
          contextLength: ragContext.length,
          fullMessage: ragSystemMessage,
        })
        llmMessages.push({ 
          role: 'system', 
          content: ragSystemMessage
        })
      } else {
        console.log('ℹ️ [RAG] No RAG context to add to LLM messages')
      }
      
      // Add current conversation messages
      updatedMessages.forEach((m) => {
        llmMessages.push({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })
      })

      // Debug: log the messages being sent
      console.log('Sending to LLM:', {
        receiverNodeId: id,
        hasDonorContext: donorNodes.length > 0,
        donorCount: donorNodes.length,
        totalDonorMessages: donorNodes.reduce((sum, d) => sum + d.messages.length, 0),
        receiverMessageCount: updatedMessages.length,
        totalLLMMessages: llmMessages.length
      })
      
      let fullContent = ''
      for await (const chunk of llmProvider.streamChat(llmMessages, model)) {
        if (chunk.content) {
          fullContent += chunk.content
          const assistantMessage: Message = {
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
          }
          setMessages([...updatedMessages, assistantMessage])
        }
        if (chunk.done) {
          break
        }
      }

      setIsLoading(false)
      
      // Force immediate save after message completion (no debounce)
      const finalMessages = [...updatedMessages, { role: 'assistant', content: fullContent, timestamp: Date.now() }]
      const store = useCanvasStore.getState()
      const nodeToUpdate = store.nodes.find(n => n.id === id)
      const nodeData = (nodeToUpdate?.data as ChatNodeData) || {}
      
      // Update node data directly in store
      updateNode(id, {
        data: {
          ...nodeData,
          messages: finalMessages,
        },
      } as any)
      
      // Force immediate save without any delay
      store.saveCanvas()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setIsLoading(false)
    }
  }

  const handleDelete = () => {
    if (window.confirm('Delete this chat node?')) {
      deleteNode(id)
    }
  }

  // Zoom state for node content (persisted in node data)
  const [zoom, setZoom] = useState(data.zoom || 1)
  
  // Save zoom to node data
  useEffect(() => {
    const currentNode = useCanvasStore.getState().nodes.find(n => n.id === id)
    const currentData = (currentNode?.data as ChatNodeData) || {}
    updateNode(id, {
      data: {
        ...currentData,
        zoom,
      },
    } as any)
  }, [zoom, id, updateNode])
  
  // Load zoom from data when it changes
  useEffect(() => {
    if (data.zoom && data.zoom !== zoom) {
      setZoom(data.zoom)
    }
  }, [data.zoom])
  
  // Zoom functionality with Cmd/Ctrl + scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // If Cmd/Ctrl is held, zoom the content instead of scrolling
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.5, Math.min(2, prevZoom + zoomDelta))
        return Math.round(newZoom * 10) / 10 // Round to 1 decimal place
      })
    }
    // Regular scroll is handled by React Flow's nowheel class
  }

  return (
    <div 
      className={`chat-node ${selected ? 'selected' : ''}`}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected}
        minWidth={300}
        minHeight={400}
        handleStyle={{
          width: '12px',
          height: '12px',
          borderRadius: '2px',
        }}
      />
      <div className="chat-node-header">
        <div className="chat-node-header-top">
          {isEditingTitle ? (
            <input
              className="chat-node-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false)
                handleTitleChange(title)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsEditingTitle(false)
                  handleTitleChange(title)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setIsEditingTitle(false)
                  setTitle(data.title || 'New Chat')
                }
              }}
              autoFocus
            />
          ) : (
            <div
              className="chat-node-title"
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Double-click to edit"
            >
              {title}
            </div>
          )}
          <div className="chat-node-actions">
            <button
              className="chat-node-delete"
              onClick={handleDelete}
              aria-label="Delete node"
              title="Delete node"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div className="chat-node-meta">
          {provider && <span className="chat-node-provider">{provider}</span>}
          {model && <span className="chat-node-model">{model}</span>}
        </div>
      </div>
      <div 
        className="chat-node-content-wrapper nowheel"
        ref={messageListRef}
        onWheel={handleWheel}
      >
        {error && (
          <div className="chat-node-error" role="alert">
            {error}
          </div>
        )}
        <MessageList messages={messages} isLoading={isLoading} />
      </div>
      <div className="chat-node-input">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !model}
          isLoading={isLoading}
        >
          <ModelPicker
            models={availableModels}
            selectedModel={model}
            selectedProvider={provider as any}
            onChange={(newModel) => {
              setModel(newModel)
              // Update provider if model belongs to different provider
              const modelInfo = availableModels.find((m) => m.id === newModel)
              if (modelInfo && modelInfo.provider !== provider) {
                setProvider(modelInfo.provider)
              }
            }}
            availableProviders={enabledProviders}
            disabled={isLoading}
          />
        </ChatInput>
      </div>
      <Handle type="source" position={Position.Right} id="source" />
      <Handle type="target" position={Position.Left} id="target" />
    </div>
  )
}

export default memo(ChatNode)
