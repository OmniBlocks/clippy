/**
 * Dev Tools Integration
 * Handles: Reconnecting WebSocket, Linting Overlay, and Message Bridge
 */

let lintOverlay = null

/**
 * Every reload re-evaluates this whole module from scratch.
 */
function getHotState() {
  return (globalThis.__clippyHot ??= { ws: null, extensions: new Map() })
}

/**
 * Main Development Entry Point
 * Called again on every hot reload, but only sets up the socket and message bridge once.
 */
export function dev() {
  const hot = getHotState()
  if (hot.ws) return

  // 1. Setup WebSocket for HMR and Notifications
  hot.ws = createReconnectingWebSocket('ws://localhost:8000')

  // 2. Setup Message Bridge for Iframe Communication
  window.addEventListener('message', (event) => {
    if (event.origin !== 'http://localhost:8000') return
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
  hot.ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data)
    switch (data.type) {
      case 'extension_update':
        loadUpdatedExtension()
        break
      case 'show_toast':
        showToast(data.message)
        break
    }
  })
}

/**
 * Registers the extension with the VM the first time it's seen.
 */
export function publish(id, extension, Scratch) {
  const hot = getHotState()
  const live = hot.extensions.get(id)

  if (!live) {
    Scratch.extensions.register(extension)
    hot.extensions.set(id, extension)
    return
  }

  Object.setPrototypeOf(live, Object.getPrototypeOf(extension))
  Scratch.vm.extensionManager.refreshBlocks?.(id)?.catch?.(() => {})
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
  const { ws } = getHotState()
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
 * Fetches the rebuilt extension bundle via a plain <script> tag, cache-busted with the
 * current time so the browser can't serve a stale copy of clippy.js.
 */
function loadUpdatedExtension() {
  const script = document.createElement('script')

  script.src = `http://localhost:8000/clippy.js?v=${Date.now()}`
  script.onload = () => script.remove()
  script.onerror = () => {
    script.remove()
    console.error('Could not load the rebuilt extension; keeping the current one.')
  }

  document.head.append(script)
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
