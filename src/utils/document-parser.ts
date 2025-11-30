/**
 * Document parsing utilities for memory nodes
 * 
 * Supported file types:
 * - .txt, .text - Plain text files
 * - .md, .markdown - Markdown files (parsed by sections)
 * - .csv - CSV files (parsed by rows)
 * - .pdf - PDF files (text extraction using pdf.js)
 */

import * as pdfjsLib from 'pdfjs-dist'

// Configure pdf.js worker for Vite - must be set before any PDF operations
// Use worker from public directory (local-first, no CDN)
if (typeof window !== 'undefined') {
  // Set worker source - use absolute path from root
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '/pdf.worker.min.js',
    window.location.origin
  ).href
  
  console.log('📄 [PDF] Worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc)
}

export interface ParsedDocument {
  chunks: Array<{
    id: string
    content: string
    metadata: {
      page?: number
      line?: number
      source?: string
      type?: string
    }
  }>
}

/**
 * Chunk text into smaller pieces for embedding
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = []
  
  // Validate parameters
  if (chunkSize <= 0) chunkSize = 1000
  if (overlap < 0) overlap = 0
  if (overlap >= chunkSize) overlap = Math.floor(chunkSize * 0.2) // Cap overlap at 20% of chunk size
  
  // Safety limit to prevent memory issues
  const MAX_CHUNKS = 10000
  let start = 0
  let iterations = 0

  while (start < text.length && chunks.length < MAX_CHUNKS) {
    iterations++
    // Safety check to prevent infinite loops
    if (iterations > MAX_CHUNKS * 2) {
      console.warn('⚠️ [chunkText] Too many iterations, breaking loop')
      break
    }
    
    const end = Math.min(start + chunkSize, text.length)
    const chunk = text.slice(start, end).trim()
    
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Calculate next start position
    const nextStart = end - overlap
    
    // Ensure we always advance
    if (nextStart <= start) {
      start = end // Move forward by at least chunkSize
    } else {
      start = nextStart
    }
    
    // Final safety check
    if (start >= text.length) break
  }

  if (chunks.length >= MAX_CHUNKS) {
    console.warn(`⚠️ [chunkText] Reached max chunks limit (${MAX_CHUNKS}), text may be truncated`)
  }

  return chunks
}

/**
 * Parse plain text file
 */
export async function parseTextFile(file: File): Promise<ParsedDocument> {
  const text = await file.text()
  const chunks = chunkText(text)

  return {
    chunks: chunks.map((content, index) => ({
      id: `${file.name}-${index}`,
      content,
      metadata: {
        source: file.name,
        type: 'text',
        line: index + 1,
      },
    })),
  }
}

/**
 * Parse markdown file
 */
export async function parseMarkdownFile(file: File): Promise<ParsedDocument> {
  const text = await file.text()
  // Split by headers and paragraphs
  const sections = text.split(/(?=^#+\s)/m).filter(s => s.trim())
  const chunks: ParsedDocument['chunks'] = []

  sections.forEach((section, index) => {
    const subChunks = chunkText(section.trim())
    subChunks.forEach((content, subIndex) => {
      chunks.push({
        id: `${file.name}-${index}-${subIndex}`,
        content,
        metadata: {
          source: file.name,
          type: 'markdown',
          page: index + 1,
        },
      })
    })
  })

  return { chunks }
}

/**
 * Parse CSV file
 */
export async function parseCSVFile(file: File): Promise<ParsedDocument> {
  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())
  const chunks: ParsedDocument['chunks'] = []

  // First line is usually headers
  const headers = lines[0]?.split(',').map(h => h.trim()) || []

  lines.slice(1).forEach((line, index) => {
    const values = line.split(',').map(v => v.trim())
    const rowData = headers.map((header, i) => `${header}: ${values[i] || ''}`).join(', ')
    
    chunks.push({
      id: `${file.name}-row-${index}`,
      content: rowData,
      metadata: {
        source: file.name,
        type: 'csv',
        line: index + 2, // +2 because we skipped header and 1-indexed
      },
    })
  })

  return { chunks }
}

/**
 * Parse PDF file using pdf.js
 * Extracts text from all pages and chunks by page
 */
export async function parsePDFFile(file: File): Promise<ParsedDocument> {
  try {
    // Ensure worker is configured before parsing
    if (typeof window !== 'undefined') {
      const workerPath = new URL('/pdf.worker.min.js', window.location.origin).href
      if (pdfjsLib.GlobalWorkerOptions.workerSrc !== workerPath) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath
        console.log('📄 [PDF] Worker configured in parsePDFFile:', pdfjsLib.GlobalWorkerOptions.workerSrc)
      }
    }
    
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0, // Reduce console noise
    }).promise
    const chunks: ParsedDocument['chunks'] = []
    
    console.log(`📄 [PDF] Parsing PDF: ${file.name}, pages: ${pdf.numPages}`)
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Combine all text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim()
      
      if (pageText.length > 0) {
        // Chunk the page text (in case page is very long)
        const pageChunks = chunkText(pageText)
        
        pageChunks.forEach((chunk, chunkIndex) => {
          chunks.push({
            id: `${file.name}-page-${pageNum}-chunk-${chunkIndex}`,
            content: chunk,
            metadata: {
              source: file.name,
              type: 'pdf',
              page: pageNum,
            },
          })
        })
        
        console.log(`📄 [PDF] Page ${pageNum}: extracted ${pageText.length} chars, ${pageChunks.length} chunks`)
      }
    }
    
    if (chunks.length === 0) {
      console.warn(`⚠️ [PDF] No text extracted from ${file.name}`)
      return {
        chunks: [{
          id: `${file.name}-0`,
          content: `PDF file: ${file.name}\n\nNo extractable text found in this PDF. It may be image-based or encrypted.`,
          metadata: {
            source: file.name,
            type: 'pdf',
          },
        }],
      }
    }
    
    console.log(`✅ [PDF] Successfully parsed ${file.name}: ${chunks.length} chunks from ${pdf.numPages} pages`)
    return { chunks }
  } catch (error) {
    console.error(`❌ [PDF] Error parsing PDF ${file.name}:`, error)
    // Return error message as chunk so user knows what happened
    return {
      chunks: [{
        id: `${file.name}-error`,
        content: `PDF file: ${file.name}\n\nError parsing PDF: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease ensure the PDF is not encrypted or corrupted.`,
        metadata: {
          source: file.name,
          type: 'pdf',
        },
      }],
    }
  }
}

/**
 * Parse file based on its type
 */
export async function parseFile(file: File): Promise<ParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'txt':
    case 'text':
      return parseTextFile(file)
    case 'md':
    case 'markdown':
      return parseMarkdownFile(file)
    case 'csv':
      return parseCSVFile(file)
    case 'pdf':
      return parsePDFFile(file)
    default:
      // Default to text parsing
      return parseTextFile(file)
  }
}

