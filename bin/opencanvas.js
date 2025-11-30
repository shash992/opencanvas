#!/usr/bin/env node

/**
 * OpenCanvas CLI - Starts the local development server
 */

import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

// Find the package root (where node_modules is or package root)
function findPackageRoot(startDir) {
  let dir = startDir
  
  // First, check if we're in node_modules (global/local install)
  while (dir !== '/') {
    // Check for scoped package: @shash992/opencanvas
    if (existsSync(join(dir, 'node_modules', '@shash992', 'opencanvas'))) {
      const pkgPath = join(dir, 'node_modules', '@shash992', 'opencanvas')
      if (existsSync(join(pkgPath, 'dist'))) {
        return pkgPath
      }
    }
    // Also check for unscoped (backward compatibility)
    if (existsSync(join(dir, 'node_modules', 'opencanvas'))) {
      const pkgPath = join(dir, 'node_modules', 'opencanvas')
      if (existsSync(join(pkgPath, 'dist'))) {
        return pkgPath
      }
    }
    if (existsSync(join(dir, 'package.json'))) {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
      if ((pkg.name === '@shash992/opencanvas' || pkg.name === 'opencanvas') && existsSync(join(dir, 'dist'))) {
        return dir
      }
    }
    const parent = join(dir, '..')
    if (parent === dir) break // Reached root
    dir = parent
  }
  
  // Fallback: use __dirname (for development)
  return __dirname
}

const packageRoot = findPackageRoot(__dirname)
const distPath = join(packageRoot, 'dist')

// Check if dist exists, if not, try to build
if (!existsSync(distPath)) {
  console.error('❌ Error: dist folder not found. Please run "npm run build" first.')
  console.error('   Or install with: npm install -g opencanvas')
  process.exit(1)
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

function getMimeType(filePath) {
  const ext = filePath.substring(filePath.lastIndexOf('.'))
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function serveFile(filePath, res) {
  try {
    const content = readFileSync(filePath)
    const mimeType = getMimeType(filePath)
    res.writeHead(200, { 'Content-Type': mimeType })
    res.end(content)
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('File not found')
  }
}

const server = createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  let filePath = req.url === '/' ? '/index.html' : req.url
  filePath = filePath.split('?')[0] // Remove query string
  
  // Security: prevent directory traversal
  if (filePath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }

  const fullPath = join(distPath, filePath)

  // Check if file exists
  if (existsSync(fullPath)) {
    serveFile(fullPath, res)
  } else {
    // SPA fallback: serve index.html for routes
    serveFile(join(distPath, 'index.html'), res)
  }
})

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || 'localhost'

// Try to find an available port
function findAvailablePort(startPort, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const tryPort = (port) => {
      if (attempts >= maxAttempts) {
        reject(new Error(`Could not find an available port after ${maxAttempts} attempts`))
        return
      }
      
      const testServer = createServer()
      testServer.listen(port, HOST, () => {
        testServer.close(() => resolve(port))
      })
      testServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          attempts++
          tryPort(port + 1)
        } else {
          reject(err)
        }
      })
    }
    tryPort(startPort)
  })
}

// Start server on available port
findAvailablePort(PORT)
  .then((availablePort) => {
    server.listen(availablePort, HOST, () => {
      console.log('🚀 OpenCanvas is running!')
      if (availablePort !== PORT) {
        console.log(`⚠️  Port ${PORT} was in use, using port ${availablePort} instead`)
      }
      console.log(`📱 Open your browser: http://${HOST}:${availablePort}`)
      console.log(`\n💡 Press Ctrl+C to stop the server\n`)
    })
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err.message)
    process.exit(1)
  })

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down OpenCanvas...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

