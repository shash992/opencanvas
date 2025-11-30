import { create } from 'zustand'
import type { ChatData, Message } from '../services/storage/types'
import { getStorage } from '../services/storage'
import type { Provider, ModelInfo } from '../services/llm/types'

interface ChatState {
  currentChat: ChatData | null
  chats: ChatData[]
  provider: Provider
  model: string
  availableModels: ModelInfo[]
  systemPrompt: string
  isLoading: boolean
  error: string | null

  // Actions
  setProvider: (provider: Provider) => void
  setModel: (model: string) => void
  setSystemPrompt: (prompt: string) => void
  setAvailableModels: (models: ModelInfo[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  loadChats: () => Promise<void>
  loadChat: (chatId: string) => Promise<void>
  createChat: () => Promise<void>
  saveChat: () => Promise<void>
  addMessage: (message: Omit<Message, 'timestamp'>) => void
  updateLastMessage: (content: string) => void
  updateChatTitle: (chatId: string, title: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  deleteChats: (chatIds: string[]) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentChat: null,
  chats: [],
  provider: 'ollama' as Provider,
  model: '',
  availableModels: [],
  systemPrompt: '',
  isLoading: false,
  error: null,

  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  loadChats: async () => {
    try {
      const storage = getStorage()
      const chats = await storage.getAllChats()
      set({ chats })
    } catch (error) {
      console.error('Failed to load chats:', error)
    }
  },

  loadChat: async (chatId: string) => {
    try {
      const storage = getStorage()
      const chat = await storage.getChat(chatId)
      if (chat) {
        set({
          currentChat: chat,
          provider: chat.provider,
          model: chat.model,
          systemPrompt: chat.systemPrompt || '',
        })
      }
    } catch (error) {
      console.error('Failed to load chat:', error)
    }
  },

  createChat: async () => {
    const chatId = `chat-${Date.now()}`
    const chat: ChatData = {
      id: chatId,
      title: 'New Chat',
      messages: [],
      provider: get().provider,
      model: get().model,
      systemPrompt: get().systemPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set({ currentChat: chat })
    // Don't save empty chats - they'll be saved when messages are added
    await get().loadChats()
  },

  saveChat: async () => {
    const { currentChat } = get()
    if (!currentChat) return

    // Only save chats that have at least one message
    if (currentChat.messages.length === 0) {
      return
    }

    try {
      const storage = getStorage()
      const updatedChat: ChatData = {
        ...currentChat,
        provider: get().provider,
        model: get().model,
        systemPrompt: get().systemPrompt,
        updatedAt: Date.now(),
      }
      await storage.saveChat(currentChat.id, updatedChat)
      set({ currentChat: updatedChat })
      // Reload chats to update the list
      await get().loadChats()
    } catch (error) {
      console.error('Failed to save chat:', error)
    }
  },

  addMessage: (message) => {
    const { currentChat } = get()
    if (!currentChat) return

    const newMessage: Message = {
      ...message,
      timestamp: Date.now(),
    }

    const updatedChat: ChatData = {
      ...currentChat,
      messages: [...currentChat.messages, newMessage],
      updatedAt: Date.now(),
    }

    set({ currentChat: updatedChat })
  },

  updateLastMessage: (content: string) => {
    const { currentChat } = get()
    if (!currentChat) return

    const messages = [...currentChat.messages]
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      // Replace content (not append) since we're passing full accumulated content
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        content,
      }
    } else {
      messages.push({
        role: 'assistant',
        content,
        timestamp: Date.now(),
      })
    }

    set({
      currentChat: {
        ...currentChat,
        messages,
        updatedAt: Date.now(),
      },
    })
  },

  updateChatTitle: async (chatId: string, title: string) => {
    try {
      const storage = getStorage()
      const { currentChat } = get()
      
      // Use currentChat if it matches, otherwise try to load from storage
      let chat = currentChat?.id === chatId ? currentChat : await storage.getChat(chatId)
      
      // If chat doesn't exist in storage but exists in currentChat, use currentChat
      if (!chat && currentChat?.id === chatId) {
        chat = currentChat
      }
      
      if (!chat) {
        console.warn('Chat not found for title update:', chatId)
        return
      }

      const updatedChat: ChatData = {
        ...chat,
        title: title.trim() || 'New Chat',
        updatedAt: Date.now(),
      }

      // Save to storage (even if chat has no messages, we want to save the title)
      await storage.saveChat(chatId, updatedChat)

      // Update current chat if it's the one being edited
      if (currentChat?.id === chatId) {
        set({ currentChat: updatedChat })
      }

      // Reload chats to update the list
      await get().loadChats()
    } catch (error) {
      console.error('Failed to update chat title:', error)
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      const storage = getStorage()
      await storage.deleteChat(chatId)
      const { currentChat } = get()
      if (currentChat?.id === chatId) {
        set({ currentChat: null })
      }
      await get().loadChats()
    } catch (error) {
      console.error('Failed to delete chat:', error)
    }
  },

  deleteChats: async (chatIds: string[]) => {
    try {
      const storage = getStorage()
      for (const chatId of chatIds) {
        await storage.deleteChat(chatId)
      }
      const { currentChat } = get()
      if (currentChat && chatIds.includes(currentChat.id)) {
        set({ currentChat: null })
      }
      await get().loadChats()
    } catch (error) {
      console.error('Failed to delete chats:', error)
    }
  },
}))

