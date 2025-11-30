import { useEffect, useCallback, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Viewport as ReactFlowViewport,
  type Node,
  type OnSelectionChangeParams,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useCanvasStore } from '../../stores/canvasStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { initStorage } from '../../services/storage'
import ChatNode from './nodes/ChatNode'
import MemoryNode from './nodes/MemoryNode'
import CanvasHeader from './CanvasHeader'
import ContextEdge from './edges/ContextEdge'
import RagEdge from './edges/RagEdge'
import type { ChatNodeData } from '../../types/canvas'
import './CanvasMode.css'

const nodeTypes = {
  chat: ChatNode,
  memory: MemoryNode,
}

const edgeTypes = {
  context: ContextEdge,
  rag: RagEdge,
}

export default function CanvasMode() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    viewport: storeViewport,
    initialized,
    loadCanvas,
    setNodes,
    setEdges,
    setViewport,
  } = useCanvasStore()
  
  const { loadSettings, initialized: settingsInitialized } = useSettingsStore()

  const [nodes, setNodesState, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdgesState, onEdgesChange] = useEdgesState(storeEdges)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])

  // Initialize storage and load canvas + settings
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        await initStorage()
        // Load sessions first, then load canvas (which will use sessions if available)
        const canvasStore = useCanvasStore.getState()
        await canvasStore.loadSessions()
        await Promise.all([loadCanvas(), loadSettings()])
        // Reload sessions after canvas loads to ensure they're in sync
        await canvasStore.loadSessions()
      } catch (error) {
        console.error('Failed to initialize canvas:', error)
        // Ensure initialized is set even on error
        if (mounted) {
          const state = useCanvasStore.getState()
          if (!state.initialized) {
            useCanvasStore.setState({ 
              nodes: [],
              edges: [],
              viewport: { x: 0, y: 0, zoom: 1 },
              initialized: true 
            })
          }
        }
      }
    }
    
    // Timeout fallback - ensure we don't stay loading forever
    const timeoutId = setTimeout(() => {
      if (mounted) {
        const state = useCanvasStore.getState()
        if (!state.initialized) {
          console.warn('Canvas initialization timeout, forcing initialization')
          useCanvasStore.setState({ 
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            initialized: true 
          })
        }
      }
    }, 5000)
    
    init().finally(() => {
      clearTimeout(timeoutId)
    })
    
    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [loadCanvas, loadSettings])
  
  // Force save before page unload and when tab is hidden
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { saveCanvas } = useCanvasStore.getState()
      // Force synchronous save
      saveCanvas()
    }
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const { saveCanvas } = useCanvasStore.getState()
        saveCanvas()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also save periodically (every 10 seconds)
    const saveInterval = setInterval(() => {
      const { saveCanvas } = useCanvasStore.getState()
      saveCanvas()
    }, 10000)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(saveInterval)
    }
  }, [])

  // Sync with store when it updates (only on initialization or external changes)
  useEffect(() => {
    if (initialized) {
      // Only sync if store has different nodes (external changes)
      const storeNodeIds = new Set(storeNodes.map(n => n.id))
      const localNodeIds = new Set(nodes.map(n => n.id))
      if (storeNodes.length !== nodes.length || 
          storeNodes.some(n => !localNodeIds.has(n.id)) ||
          nodes.some(n => !storeNodeIds.has(n.id))) {
        setNodesState(storeNodes)
      }
    }
  }, [storeNodes, initialized, setNodesState, nodes])

  useEffect(() => {
    if (initialized) {
      // Only sync if store has different edges (external changes)
      const storeEdgeIds = new Set(storeEdges.map(e => e.id))
      const localEdgeIds = new Set(edges.map(e => e.id))
      if (storeEdges.length !== edges.length ||
          storeEdges.some(e => !localEdgeIds.has(e.id)) ||
          edges.some(e => !storeEdgeIds.has(e.id))) {
        setEdgesState(storeEdges)
      }
    }
  }, [storeEdges, initialized, setEdgesState, edges])

  // Debounced save to store when local state changes
  useEffect(() => {
    if (!initialized) return
    const timeoutId = setTimeout(() => {
      setNodes(nodes)
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [nodes, initialized, setNodes])

  useEffect(() => {
    if (!initialized) return
    const timeoutId = setTimeout(() => {
      setEdges(edges)
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [edges, initialized, setEdges])

  const handleConnect = useCallback((connection: any) => {
    try {
      console.log('🔗 [handleConnect] Connection attempt:', {
        source: connection.source,
        target: connection.target,
        connection: connection,
      })
      
      if (!connection.source || !connection.target) {
        console.warn('⚠️ [handleConnect] Missing source or target:', connection)
        return
      }
      
      // Get fresh nodes from store to avoid stale closures
      const currentState = useCanvasStore.getState()
      const currentNodes = currentState.nodes
      
      // Determine edge type based on node types
      const sourceNode = currentNodes.find(n => n.id === connection.source)
      const targetNode = currentNodes.find(n => n.id === connection.target)
      
      console.log('🔗 [handleConnect] Node lookup:', {
        sourceNode: sourceNode ? { id: sourceNode.id, type: sourceNode.type } : null,
        targetNode: targetNode ? { id: targetNode.id, type: targetNode.type } : null,
        allNodeIds: currentNodes.map(n => ({ id: n.id, type: n.type })),
      })
      
      if (!sourceNode || !targetNode) {
        console.error('❌ [handleConnect] Source or target node not found:', {
          sourceFound: !!sourceNode,
          targetFound: !!targetNode,
          availableNodes: currentNodes.map(n => n.id),
        })
        return
      }
      
      // If connecting memory node to chat node, create RAG edge
      // Otherwise, create context edge
      const edgeType = (sourceNode.type === 'memory' && targetNode.type === 'chat') 
        ? 'rag' 
        : 'context'
      
      console.log('🔗 [handleConnect] Edge type determined:', {
        sourceType: sourceNode.type,
        targetType: targetNode.type,
        edgeType,
        isRAG: edgeType === 'rag',
      })
      
      const newEdge = {
        id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        type: edgeType,
      }
      
      console.log('🔗 [handleConnect] Creating edge:', newEdge)
      
      // Get fresh edges from store
      const currentEdges = currentState.edges
      const updatedEdges = [...currentEdges, newEdge]
      
      console.log('🔗 [handleConnect] Updating edges:', {
        currentEdgeCount: currentEdges.length,
        newEdgeCount: updatedEdges.length,
      })
      
      setEdgesState(updatedEdges)
      // Save to store
      setEdges(updatedEdges)
      
      console.log('🔗 [handleConnect] Edge added to state:', {
        totalEdges: updatedEdges.length,
        newEdgeId: newEdge.id,
      })
      
      // If RAG edge, update chat node's attachedMemoryNodes
      if (edgeType === 'rag' && targetNode) {
        console.log('🔗 [handleConnect] Processing RAG edge - updating attachedMemoryNodes')
        try {
          const { updateNode } = useCanvasStore.getState()
          const targetData = targetNode.data as ChatNodeData
          const currentAttached = targetData.attachedMemoryNodes || []
          
          console.log('🔗 [handleConnect] Current attachedMemoryNodes:', {
            targetNodeId: connection.target,
            currentAttached,
            newSourceId: connection.source,
            alreadyAttached: currentAttached.includes(connection.source),
          })
          
          if (!currentAttached.includes(connection.source)) {
            const updatedAttached = [...currentAttached, connection.source]
            console.log('🔗 [handleConnect] Updating attachedMemoryNodes:', {
              from: currentAttached,
              to: updatedAttached,
            })
            
            updateNode(connection.target, {
              data: {
                ...targetData,
                attachedMemoryNodes: updatedAttached,
              },
            } as any)
            
            console.log('✅ [handleConnect] Successfully updated attachedMemoryNodes')
          } else {
            console.log('ℹ️ [handleConnect] Memory node already attached, skipping update')
          }
        } catch (error) {
          console.error('❌ [handleConnect] Error updating attachedMemoryNodes:', error)
        }
      } else {
        console.log('ℹ️ [handleConnect] Not a RAG edge, skipping attachedMemoryNodes update')
      }
    } catch (error) {
      console.error('❌ [handleConnect] Fatal error during connection:', error)
      console.error('❌ [handleConnect] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      console.error('❌ [handleConnect] Connection object:', connection)
    }
  }, [setEdgesState, setEdges]) // Removed edges/nodes from deps - using store state directly

  const onMove = useCallback((_event: unknown, viewport: ReactFlowViewport) => {
    setViewport(viewport)
  }, [setViewport])

  const { addNode, deleteNode } = useCanvasStore()
  
  const handleNodesDelete = useCallback((nodesToDelete: Node[]) => {
    const nodeCount = nodesToDelete.length
    const nodeWord = nodeCount === 1 ? 'node' : 'nodes'
    const message = `Are you sure you want to delete ${nodeCount} ${nodeWord}?`
    
    if (window.confirm(message)) {
      // Delete nodes one by one
      nodesToDelete.forEach(node => {
        deleteNode(node.id)
      })
    } else {
      // Prevent deletion by returning false
      return false
    }
  }, [deleteNode])

  const handleAddMemoryNode = useCallback(() => {
    const newNode: Node = {
      id: `memory-node-${Date.now()}`,
      type: 'memory',
      position: {
        x: Math.random() * 400,
        y: Math.random() * 400,
      },
      data: {
        title: 'Memory Node',
        chunkCount: 0,
        // Don't set embeddingProvider for new nodes - let component use current settings
      },
    }
    addNode(newNode)
  }, [addNode])

  const handleAddChatNode = useCallback(() => {
    const newNode: Node = {
      id: `chat-node-${Date.now()}`,
      type: 'chat',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        title: 'New Chat',
        messages: [],
      },
      style: {
        width: 400,
        height: 500,
      },
    }
    addNode(newNode)
  }, [addNode])

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeIds(params.nodes.map(n => n.id))
  }, [])

  const handleBranch = useCallback(() => {
    if (selectedNodeIds.length !== 1) {
      alert('Please select exactly one chat node to branch from')
      return
    }

    const selectedNode = nodes.find(n => n.id === selectedNodeIds[0])
    if (!selectedNode || selectedNode.type !== 'chat') {
      alert('Selected node is not a chat node')
      return
    }

    const nodeData = selectedNode.data as ChatNodeData
    
    // Get parent node dimensions
    const parentWidth = (selectedNode.style?.width as number) || 400
    
    // Find existing children of this parent to avoid overlap
    const existingChildren = edges.filter(e => e.source === selectedNode.id)
    const childCount = existingChildren.length
    
    // Position child to the right with proper spacing
    const horizontalGap = 100 // Gap between parent and child
    const verticalOffset = childCount * 150 // Stack children vertically
    
    // Create new node with parent's messages as context
    const newNode: Node = {
      id: `chat-node-${Date.now()}`,
      type: 'chat',
      position: {
        x: (selectedNode.position.x || 0) + parentWidth + horizontalGap,
        y: (selectedNode.position.y || 0) + verticalOffset,
      },
      data: {
        title: `${nodeData.title || 'New Chat'} (Branch)`,
        provider: nodeData.provider || 'ollama',
        model: nodeData.model || '',
        messages: [], // Start with empty messages - context will come from edges
        systemPrompt: nodeData.systemPrompt,
        // Note: parentMessages removed - context is now derived from edges dynamically
      },
      style: {
        width: 400,
        height: 500,
      },
    }
    addNode(newNode)

    // Create edge connection
    const { addEdge } = useCanvasStore.getState()
    addEdge({
      id: `edge-${selectedNode.id}-${newNode.id}`,
      source: selectedNode.id,
      target: newNode.id,
      type: 'context',
    })
  }, [selectedNodeIds, nodes, addNode])

  const handleMerge = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      alert('Please select 2 or more chat nodes to merge')
      return
    }

    const selectedNodes = nodes.filter(n => 
      selectedNodeIds.includes(n.id) && n.type === 'chat'
    )

    if (selectedNodes.length < 2) {
      alert('Please select 2 or more chat nodes to merge')
      return
    }

    // Determine common provider and model
    let commonProvider = 'ollama'
    let commonModel = ''

    selectedNodes.forEach(node => {
      const nodeData = node.data as ChatNodeData
      if (!commonProvider && nodeData.provider) {
        commonProvider = nodeData.provider
      }
      if (!commonModel && nodeData.model) {
        commonModel = nodeData.model
      }
    })

    // Calculate center position
    const avgX = selectedNodes.reduce((sum, n) => sum + (n.position.x || 0), 0) / selectedNodes.length
    const avgY = selectedNodes.reduce((sum, n) => sum + (n.position.y || 0), 0) / selectedNodes.length

    const newNode: Node = {
      id: `chat-node-${Date.now()}`,
      type: 'chat',
      position: {
        x: avgX + 250,
        y: avgY + 300,
      },
      data: {
        title: 'Merged Chat',
        provider: commonProvider,
        model: commonModel,
        messages: [], // Start with blank chat - context will come from edges
        systemPrompt: (selectedNodes[0].data as ChatNodeData).systemPrompt,
        // Note: parentMessages removed - context is now derived from edges dynamically
      },
      style: {
        width: 400,
        height: 500,
      },
    }
    addNode(newNode)
    
    // Create edges from all selected nodes to the merged node
    const { addEdge } = useCanvasStore.getState()
    selectedNodes.forEach(sourceNode => {
      addEdge({
        id: `edge-${sourceNode.id}-${newNode.id}`,
        source: sourceNode.id,
        target: newNode.id,
        type: 'context',
      })
    })
  }, [selectedNodeIds, nodes, edges, addNode])

  if (!initialized || !settingsInitialized) {
    return <div className="canvas-mode-loading">Loading canvas...</div>
  }

  return (
    <div className="canvas-mode">
      <CanvasHeader
        onAddChatNode={handleAddChatNode}
        onAddMemoryNode={handleAddMemoryNode}
        onBranch={handleBranch}
        onMerge={handleMerge}
        selectedNodeIds={selectedNodeIds}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMove={onMove}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        onNodesDelete={handleNodesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        defaultViewport={storeViewport}
        minZoom={0.1}
        maxZoom={2}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
        defaultEdgeOptions={{ style: { stroke: 'var(--accent)', strokeWidth: 2 } }}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
