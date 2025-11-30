/**
 * Agent operation logger
 * Appends entries to AGENT_LOG.md as required by AGENTS.md Section 10
 */

export function logAgentOperation(operation: string, details?: string) {
  const timestamp = new Date().toISOString().split('T')[0]
  const time = new Date().toLocaleTimeString()
  const entry = `\n## ${timestamp} ${time}\n\n- ${operation}${details ? ` - ${details}` : ''}\n`

  // In browser, we'll need to use a different approach
  // For now, this is the interface - actual implementation will depend on environment
  if (typeof window !== 'undefined') {
    // Browser: Could use File System Access API or download
    console.log(`[AGENT_LOG] ${entry}`)
  } else {
    // Node.js: Can write directly
    // This will be implemented in server-side code
    console.log(`[AGENT_LOG] ${entry}`)
  }
}

