/**
 * Dev Tools Integration
 * Handles: Reconnecting WebSocket, Linting Overlay, and Message Bridge
 */

let ws
let lintOverlay = null

/**
 * Main Development Entry Point
 */
export function dev() {
  // 1. Setup WebSocket for HMR and Notifications
  ws = createReconnectingWebSocket('ws://localhost:8000')

  // 2. Setup Message Bridge for Iframe Communication
  window.addEventListener('message', (event) => {
    if (!event.origin === 'http://localhost:8000') return
    switch (event.data.type) {
      case 'close_lint_modal':
        if (lintOverlay) {
          lintOverlay.remove()
          lintOverlay = null
        }
        break
      case 'open_editor':
        openInEditor(event.data.file, event.data.line, event.data.column)
        break
    }
  })

  // 3. Handle incoming server signals
  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data)
    switch (data.type) {
      case 'extension_update':
        location.reload()
        break
      case 'show_toast':
        showToast(data.message)
        break
    }
  })
}

/**
 * Displays the hidden full-screen linting overlay
 */
export function showLintingModal() {
  if (lintOverlay) return

  lintOverlay = document.createElement('div')
  Object.assign(lintOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'transparent',
    zIndex: '20000',
  })

  const iframe = document.createElement('iframe')
  iframe.src = 'http://localhost:8000/lintembed.html'
  iframe.allowTransparency = true
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    border: 'none',
  })

  lintOverlay.appendChild(iframe)
  document.body.appendChild(lintOverlay)
}

/**
 * Open file in editor helper
 */
export const openInEditor = (file, line = 1, column = 1) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'open_editor', file, line, column }))
  }
}

/**
 * Toast notification for triggering the modal
 */
function showToast(msg) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'fixed',
    top: 'calc(3rem + 10px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#FFF0DF',
    color: '#000',
    padding: '10px',
    borderRadius: '4px',
    zIndex: '10002',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    border: '2px #FF8C1A solid',
  })
  el.textContent = msg
  el.onclick = () => {
    el.remove()
    showLintingModal()
  }
  document.body.appendChild(el)
  setTimeout(() => el?.remove(), 6000)
}

/**
 * Reconnecting WebSocket Utility
 */
function createReconnectingWebSocket(url) {
  let ws
  let retries = 0
  function connect() {
    ws = new WebSocket(url)
    ws.onopen = () => (retries = 0)
    ws.onclose = () => setTimeout(connect, Math.min(500 * Math.pow(1.5, retries++), 10000))
    return ws
  }
  return connect()
}
