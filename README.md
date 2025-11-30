# OpenCanvas

Local-first LLM workspace with infinite canvas, branching chats, RAG nodes, and multi-provider support.

## Features

- **Chat Mode**: Traditional chat interface with OpenAI, OpenRouter, and Ollama support
- **Canvas Mode**: Infinite canvas with node-based reasoning, branching, and merging
- **Memory Nodes**: Local vector stores for RAG with document upload (PDF, TXT, MD, CSV)
- **Privacy-First**: All data stored locally, no telemetry, no external tracking
- **Multi-Provider**: Support for OpenAI, OpenRouter, and Ollama (local)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- (Optional) Ollama installed locally for offline mode

### Installation Options

#### Option 1: Install via npm (Recommended)

**Global installation:**
```bash
npm install -g @shash992/opencanvas
opencanvas
```

**Or use npx (no installation needed):**
```bash
npx @shash992/opencanvas
```

This will start OpenCanvas on `http://localhost:3000`

#### Option 2: Clone and run locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/shash992/opencanvas.git
   cd opencanvas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - Navigate to `http://localhost:5173`
   - The app will open in your default browser

### First Time Setup

1. **Configure LLM Providers** (Settings → Models/Providers)
   - **Ollama** (Recommended for local/offline use):
     - Install [Ollama](https://ollama.ai)
     - Start Ollama: `ollama serve`
     - Pull a model: `ollama pull llama2` (or any model you prefer)
     - Enable Ollama in settings
   
   - **OpenAI** (Optional):
     - Get API key from [OpenAI](https://platform.openai.com/api-keys)
     - Enter API key in settings
     - Enable OpenAI provider
   
   - **OpenRouter** (Optional):
     - Get API key from [OpenRouter](https://openrouter.ai/keys)
     - Enter API key in settings
     - Enable OpenRouter provider

2. **Configure Embeddings** (Settings → Embeddings)
   - Choose embedding provider (Ollama recommended for local use)
   - Set embedding model (e.g., `nomic-embed-text` for Ollama)

3. **Start Using**
   - Switch to **Chat Mode** for traditional conversations
   - Switch to **Canvas Mode** for node-based reasoning and RAG

## Usage

### Chat Mode

- Create new chats or load existing ones
- Select provider and model from dropdown
- Chat with your LLM of choice
- All conversations are saved locally

### Canvas Mode

- **Create Chat Nodes**: Add chat nodes to the canvas
- **Create Memory Nodes**: Upload documents (PDF, TXT, MD, CSV) for RAG
- **Connect Nodes**: 
  - Connect memory nodes to chat nodes for RAG
  - Connect chat nodes to chat nodes for context sharing
- **Branch & Merge**: Create branches from existing conversations

### Memory Nodes (RAG)

1. Create a Memory Node on the canvas
2. Upload documents (PDF, TXT, MD, CSV)
3. Documents are automatically parsed, chunked, and embedded
4. Connect Memory Node to Chat Node via edge
5. Ask questions - the chat will retrieve relevant context from documents

## Building for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

The built files will be in the `dist/` directory, ready to deploy to any static hosting service.

## Project Structure

```
opencanvas/
├── src/
│   ├── components/     # React components
│   │   ├── chat/       # Chat mode components
│   │   ├── canvas/     # Canvas mode components
│   │   └── settings/   # Settings panel
│   ├── services/       # Business logic
│   │   ├── llm/        # LLM providers
│   │   ├── embeddings/ # Embedding providers & vector store
│   │   └── storage/    # Local storage (IndexedDB)
│   ├── stores/         # Zustand state management
│   └── utils/          # Utility functions
├── public/             # Static assets
├── local_data/         # Local data storage (gitignored)
└── dist/               # Production build (gitignored)
```

## Data Storage

All data is stored locally in your browser:
- **Chats**: IndexedDB
- **Canvas Sessions**: IndexedDB
- **Vector Stores**: IndexedDB
- **Settings**: IndexedDB

No data is sent to external servers except:
- LLM API calls (when using OpenAI/OpenRouter)
- Embedding API calls (when using OpenAI/OpenRouter embeddings)

## Privacy & Security

- ✅ All data stored locally
- ✅ No telemetry or analytics
- ✅ No external tracking
- ✅ API keys stored locally only
- ✅ Works offline with Ollama

## Troubleshooting

### PDF Parsing Not Working
- Ensure `public/pdf.worker.min.js` exists (copied during build)
- Check browser console for errors
- Try refreshing the page

### Ollama Not Connecting
- Ensure Ollama is running: `ollama serve`
- Check Ollama base URL in settings (default: `http://localhost:11434`)
- Verify model is installed: `ollama list`

### RAG Not Working
- Ensure memory node has documents uploaded
- Check that memory node is connected to chat node via edge
- Verify embedding provider is configured
- Check browser console for debug logs

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## License

MIT

