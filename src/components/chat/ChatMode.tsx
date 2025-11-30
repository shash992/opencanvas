import { useEffect, useRef } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { createProvider } from '../../services/llm'
import { initStorage } from '../../services/storage'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import ModelPicker from './ModelPicker'
import ChatHeader from './ChatHeader'
import './ChatMode.css'

export default function ChatMode() {
  const messageListRef = useRef<HTMLDivElement>(null)
  const {
    currentChat,
    provider,
    model,
    availableModels,
    systemPrompt,
    isLoading,
    error,
    setProvider,
    setModel,
    setAvailableModels,
    setLoading,
    setError,
    loadChats,
    createChat,
    saveChat,
    addMessage,
    updateLastMessage,
  } = useChatStore()

  const {
    providerConfig,
    enabledProviders,
    customModels,
    loadSettings,
    initialized,
  } = useSettingsStore()

  // Initialize storage and settings
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        await initStorage()
        await loadSettings()
        await loadChats()
      } catch (error) {
        console.error('Failed to initialize chat:', error)
        // Ensure initialized is set even on error
        if (mounted) {
          const state = useSettingsStore.getState()
          if (!state.initialized) {
            useSettingsStore.setState({ initialized: true })
          }
        }
      }
    }
    
    // Timeout fallback - ensure we don't stay loading forever
    const timeoutId = setTimeout(() => {
      if (mounted) {
        const state = useSettingsStore.getState()
        if (!state.initialized) {
          console.warn('Settings initialization timeout, forcing initialization')
          useSettingsStore.setState({ initialized: true })
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
  }, [loadSettings, loadChats])

  // Update available models from custom models when provider or custom models change
  useEffect(() => {
    if (!initialized) return

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

    console.log('ChatMode - Provider:', currentProvider)
    console.log('ChatMode - Enabled Providers:', enabledProviders)
    console.log('ChatMode - Custom Models:', customModels)
    console.log('ChatMode - Provider Models:', providerModels)
    console.log('ChatMode - Available Models:', models)

    setAvailableModels(models)
    if (models.length > 0 && (!model || !models.find((m) => m.id === model))) {
      setModel(models[0].id)
    } else if (models.length === 0) {
      setModel('')
    }
  }, [provider, initialized, customModels, enabledProviders, setProvider, model])

  const handleSend = async (content: string) => {
    if (isLoading) return

    // Create chat if it doesn't exist
    if (!currentChat) {
      await createChat()
    }

    const chat = useChatStore.getState().currentChat
    if (!chat) return

    // Add user message
    addMessage({ role: 'user', content })
    // Don't save yet - wait until we have a response

    setLoading(true)
    setError(null)

    try {
      const llmProvider = createProvider(provider, providerConfig)
      if (!llmProvider) {
        throw new Error(`Provider ${provider} not configured`)
      }

      // Get updated chat after adding user message
      const updatedChat = useChatStore.getState().currentChat
      if (!updatedChat) return

      // Build messages array (updatedChat.messages includes the user message we just added)
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...updatedChat.messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
      ]

      // Stream response
      let fullContent = ''
      for await (const chunk of llmProvider.streamChat(messages, model)) {
        if (chunk.content) {
          fullContent += chunk.content
          updateLastMessage(fullContent)
        }
        if (chunk.done) {
          break
        }
      }

      // Save chat after streaming completes (only if it has messages)
      await saveChat()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create a new chat if none exists when user tries to send a message
  useEffect(() => {
    if (!currentChat && !isLoading) {
      // Don't auto-create, wait for user to create one or send a message
    }
  }, [currentChat, isLoading])

  // Auto-scroll to bottom
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [currentChat?.messages])

  if (!initialized) {
    return <div className="chat-mode-loading">Loading...</div>
  }

  // Show empty state if no chat exists
  if (!currentChat) {
    return (
      <div className="chat-mode">
        <div className="chat-mode-empty">
          <p>No chat selected. Start a new conversation!</p>
          <button
            className="chat-mode-new-button"
            onClick={async () => {
              await createChat()
            }}
          >
            New Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-mode">
      {error && (
        <div className="chat-error" role="alert">
          {error}
        </div>
      )}

      <ChatHeader />

      <div className="chat-messages" ref={messageListRef}>
        <MessageList messages={currentChat.messages} isLoading={isLoading} />
      </div>

      <div className="chat-input-area">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !model}
          isLoading={isLoading}
        >
          <ModelPicker
            models={availableModels}
            selectedModel={model}
            selectedProvider={provider}
            onChange={setModel}
            availableProviders={enabledProviders}
            disabled={isLoading}
          />
        </ChatInput>
      </div>
    </div>
  )
}
