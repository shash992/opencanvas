import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow'
import { useCanvasStore } from '../../../stores/canvasStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { createEmbeddingProvider } from '../../../services/embeddings/index'
import { VectorStore } from '../../../services/embeddings/vector-store'
import { parseFile } from '../../../utils/document-parser'
import { getStorage } from '../../../services/storage'
import type { MemoryNodeData } from '../../../types/canvas'
import { XIcon } from '../../ui/Icons'
import './MemoryNode.css'

function MemoryNode({ data, selected, id }: NodeProps<MemoryNodeData>) {
  const { updateNode, deleteNode } = useCanvasStore()
  
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this memory node?')) {
      deleteNode(id)
    }
  }
  const { providerConfig, enabledProviders, embeddingProvider: settingsEmbeddingProvider } = useSettingsStore()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(data.title || 'Memory Node')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [chunkCount, setChunkCount] = useState(data.chunkCount || 0)
  const [documentCount, setDocumentCount] = useState(data.documentCount || 0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const vectorStoreRef = useRef<VectorStore | null>(null)
  const documentSourcesRef = useRef<Set<string>>(new Set())

  // Sync local state when data prop changes
  useEffect(() => {
    setTitle(data.title || 'Memory Node')
    setChunkCount(data.chunkCount || 0)
    setDocumentCount(data.documentCount || 0)
  }, [data.title, data.chunkCount, data.documentCount])

  // Use node's stored provider if node has been processed (has chunks), 
  // otherwise show current settings provider for unprocessed nodes
  const hasProcessedChunks = (data.chunkCount || 0) > 0
  const embeddingProvider = hasProcessedChunks && data.embeddingProvider
    ? data.embeddingProvider 
    : (settingsEmbeddingProvider || 'ollama')

  // Initialize vector store from data
  useEffect(() => {
    const loadVectorStore = async () => {
      try {
        const storage = getStorage()
        const storeData = await storage.getVectorStore(id)
        if (storeData) {
          vectorStoreRef.current = new VectorStore(id, storeData)
          setChunkCount(storeData.documents.length)
          // Count unique document sources
          const uniqueSources = new Set(
            storeData.documents.map(doc => doc.metadata?.source as string).filter(Boolean)
          )
          documentSourcesRef.current = uniqueSources
          setDocumentCount(uniqueSources.size)
        } else {
          vectorStoreRef.current = new VectorStore(id)
          documentSourcesRef.current = new Set()
        }
      } catch (err) {
        console.error('Failed to load vector store:', err)
        vectorStoreRef.current = new VectorStore(id)
        documentSourcesRef.current = new Set()
      }
    }
    loadVectorStore()
  }, [id])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    updateNode(id, {
      data: {
        ...data,
        title: newTitle,
      },
    } as any)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)
    setStatus('Parsing documents...')
    setProgress(0)

    try {
      // Use configured embedding provider from settings
      const { embeddingProvider: configuredEmbeddingProvider } = useSettingsStore.getState()
      const provider = enabledProviders.includes(configuredEmbeddingProvider as any)
        ? configuredEmbeddingProvider
        : enabledProviders.includes('ollama')
          ? 'ollama'
          : (enabledProviders[0] as 'ollama' | 'openai' | 'openrouter') || 'ollama'

      // Get embedding model from settings
      const { embeddingModels } = useSettingsStore.getState()
      const embeddingModel = embeddingModels[provider]
      
      // Create embedding config with model
      const embeddingConfig = {
        ...providerConfig,
        [provider]: {
          ...providerConfig[provider as keyof typeof providerConfig],
          model: embeddingModel,
        },
      }
      
      const embeddingService = createEmbeddingProvider(provider, embeddingConfig)
      if (!embeddingService) {
        throw new Error(`Embedding provider ${provider} is not available`)
      }

      const allChunks: Array<{ id: string; content: string; metadata: Record<string, unknown> }> = []
      const newDocumentSources = new Set<string>()

      // Parse all files
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExtension = file.name.split('.').pop()?.toLowerCase()
        setStatus(`Parsing ${file.name} (${fileExtension})...`)
        setProgress((i / files.length) * 30)

        console.log(`📄 [MemoryNode] Parsing file: ${file.name}`, {
          size: file.size,
          type: file.type,
          extension: fileExtension,
        })

        try {
          const parsed = await parseFile(file)
          console.log(`✅ [MemoryNode] Parsed ${file.name}:`, {
            chunkCount: parsed.chunks.length,
            totalChars: parsed.chunks.reduce((sum, c) => sum + c.content.length, 0),
          })
          
          parsed.chunks.forEach(chunk => {
            allChunks.push({
              id: chunk.id,
              content: chunk.content,
              metadata: chunk.metadata,
            })
            // Track unique document sources
            if (chunk.metadata?.source) {
              newDocumentSources.add(chunk.metadata.source as string)
            }
          })
        } catch (err) {
          console.error(`❌ [MemoryNode] Failed to parse ${file.name}:`, err)
          // Add error chunk so user knows what happened
          allChunks.push({
            id: `${file.name}-error`,
            content: `Error parsing ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
            metadata: {
              source: file.name,
              type: 'error',
            },
          })
          newDocumentSources.add(file.name)
        }
      }
      
      // Update document sources
      newDocumentSources.forEach(source => documentSourcesRef.current.add(source))

      setStatus(`Generating embeddings for ${allChunks.length} chunks...`)
      setProgress(30)

      // Generate embeddings
      const chunksWithEmbeddings = []
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i]
        setProgress(30 + (i / allChunks.length) * 60)
        
        try {
          const embedding = await embeddingService.generateEmbedding(chunk.content)
          chunksWithEmbeddings.push({
            id: chunk.id,
            content: chunk.content,
            embedding,
            metadata: chunk.metadata,
          })
        } catch (err) {
          console.error(`Failed to generate embedding for chunk ${chunk.id}:`, err)
          // Continue with other chunks even if one fails
        }
      }

      setStatus('Saving to vector store...')
      setProgress(90)

      // Add to vector store
      if (!vectorStoreRef.current) {
        vectorStoreRef.current = new VectorStore(id)
      }
      vectorStoreRef.current.addChunks(chunksWithEmbeddings)

      // Get final counts before saving
      const finalChunkCount = vectorStoreRef.current.getChunkCount()
      const finalDocumentCount = documentSourcesRef.current.size

      // Save to IndexedDB with embedding provider metadata
      const storage = getStorage()
      const storeData = vectorStoreRef.current.export(provider, embeddingModel)
      storeData.name = title
      await storage.saveVectorStore(id, storeData)
      
      console.log('💾 [MemoryNode] Saved vector store with embedding metadata:', {
        memoryNodeId: id,
        provider,
        model: embeddingModel,
        chunkCount: finalChunkCount,
      })
      
      setChunkCount(finalChunkCount)
      setDocumentCount(finalDocumentCount)
      setStatus(`Processed ${chunksWithEmbeddings.length} chunks from ${finalDocumentCount} document(s)`)
      setProgress(100)

      // Update node data
      updateNode(id, {
        data: {
          ...data,
          chunkCount: finalChunkCount,
          documentCount: finalDocumentCount,
          embeddingProvider: provider,
        },
      } as any)

      setTimeout(() => {
        setIsProcessing(false)
        setStatus('')
        setProgress(0)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files')
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const [error, setError] = useState<string | null>(null)

  return (
    <div className="memory-node">
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={300} 
        minHeight={200}
        handleStyle={{ 
          width: '12px', 
          height: '12px', 
          borderRadius: '2px', 
          backgroundColor: 'var(--accent)' 
        }} 
      />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="memory-node-header">
        {isEditingTitle ? (
          <input
            type="text"
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
                setTitle(data.title || 'Memory Node')
              }
            }}
            className="memory-node-title-input"
            autoFocus
          />
        ) : (
          <h3
            className="memory-node-title"
            onDoubleClick={() => setIsEditingTitle(true)}
            title="Double-click to edit"
          >
            {title}
          </h3>
        )}
        <button
          className="memory-node-delete"
          onClick={handleDelete}
          aria-label="Delete node"
        >
          <XIcon />
        </button>
      </div>

      <div className="memory-node-content">
        {isProcessing ? (
          <div className="memory-node-processing">
            <div className="memory-node-progress-bar">
              <div
                className="memory-node-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="memory-node-status">{status}</p>
            <p className="memory-node-progress-text">{Math.round(progress)}%</p>
          </div>
        ) : (
          <>
            <div className="memory-node-info">
              <p>Documents: {documentCount}</p>
              <p>Chunks: {chunkCount}</p>
              <p>Provider: {embeddingProvider}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,.csv,.pdf"
              onChange={handleFileUpload}
              className="memory-node-file-input"
              id={`memory-file-input-${id}`}
            />
            <label
              htmlFor={`memory-file-input-${id}`}
              className="memory-node-upload-button"
            >
              Upload Documents
            </label>
          </>
        )}
        {error && (
          <div className="memory-node-error">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(MemoryNode)

