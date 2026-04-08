let ws;

/**
 * Utility to find dynamic class names from the Scratch/TurboWarp DOM.
 */
const ScratchCSS = (() => {
  const cache = new Map();
  function find(prefix) {
    if (cache.has(prefix)) return cache.get(prefix);
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules) {
        if (!rule.selectorText) continue;
        const m = rule.selectorText.match(new RegExp(`\\.(${prefix}[^\\s\\.,:]*)`));
        if (m) {
          cache.set(prefix, m[1]);
          return m[1];
        }
      }
    }
    cache.set(prefix, prefix);
    return prefix;
  }
  return { find };
})();

/**
 * Shared Internal Modal Helper
 */
function createModal(title) {
  const CLOSE_ICON = 'data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3LjQ4IDcuNDgiPjxkZWZzPjxzdHlsZT4uY2xzLTF7ZmlsbDpub25lO3N0cm9rZTojZmZmO3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2Utd2lkdGg6MnB4O308L3N0eWxlPjwvZGVmcz48dGl0bGU+aWNvbi0tYWRkPC90aXRsZT48bGluZSBjbGFzcz0iY2xzLTEiIHgxPSIzLjc0IiB5MT0iNi40OCIgeDI9IjMuNzQiIHkyPSIxIi8+PGxpbmUgY2xhc3M9ImNscy0xIiB4MT0iMSIgeTE9IjMuNzQiIHgyPSI2LjQ4IiB5Mj0iMy43NCIvPjwvc3ZnPg==';

  const backdrop = document.createElement('div');
  backdrop.className = ScratchCSS.find('modal_modal-overlay');
  backdrop.dir = 'ltr';
  backdrop.style.zIndex = '10000';
  document.body.appendChild(backdrop);

  const modal = document.createElement('div');
  modal.className = `${ScratchCSS.find('modal_modal-content')} ${ScratchCSS.find('prompt_modal-content')}`;
  modal.style.width = "600px"
  backdrop.appendChild(modal);

  const header = document.createElement('div');
  header.className = ScratchCSS.find('modal_header');
  modal.appendChild(header);

  const titleEl = document.createElement('div');
  titleEl.className = `${ScratchCSS.find('modal_header-item')} ${ScratchCSS.find('modal_header-item-title')}`;
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeWrap = document.createElement('div');
  closeWrap.className = `${ScratchCSS.find('modal_header-item')} ${ScratchCSS.find('modal_header-item-close')}`;
  header.appendChild(closeWrap);

  const closeBtn = document.createElement('div');
  closeBtn.className = `${ScratchCSS.find('close-button_close-button')} ${ScratchCSS.find('close-button_large')}`;
  closeWrap.appendChild(closeBtn);

  const closeImg = document.createElement('img');
  closeImg.className = ScratchCSS.find('close-button_close-icon');
  closeImg.src = CLOSE_ICON;
  closeImg.style.transform = 'rotate(45deg)';
  closeBtn.appendChild(closeImg);

  const body = document.createElement('div');
  body.className = ScratchCSS.find('prompt_body');
  modal.appendChild(body);

  const close = () => backdrop.remove();
  closeBtn.onclick = close;
  backdrop.onclick = close;
  modal.onclick = (e) => e.stopPropagation();

  return { backdrop, body, close };
}

/**
 * Reconnecting WebSocket Utility
 */
function createReconnectingWebSocket(url, {
  minDelay = 500,
  maxDelay = 10_000,
  factor = 1.5,
} = {}) {
  let ws;
  let retries = 0;
  let closed = false;
  const listeners = {};

  function emit(type, event) {
    listeners[type]?.forEach(fn => fn(event));
  }

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = e => { retries = 0; emit("open", e); };
    ws.onmessage = e => emit("message", e);
    ws.onerror = e => emit("error", e);
    ws.onclose = e => {
      emit("close", e);
      if (closed) return;
      const delay = Math.min(minDelay * Math.pow(factor, retries++), maxDelay);
      setTimeout(connect, delay);
    };
  }

  connect();

  return {
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = listeners[type]?.filter(f => f !== fn); },
    send(data) { if (ws.readyState === WebSocket.OPEN) ws.send(data); },
    get readyState() { return ws.readyState; }, // Export readyState
    close() { closed = true; ws.close(); }
  };
}

/**
 * Request the dev server to open a specific file in the local editor.
 */
export const openInEditor = (file, line = 1, column = 1) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'open_editor',
      file,
      line,
      column
    }));
  } else {
    console.warn("clippy: dev server connection not active");
  }
};

/**
 * Main Development Entry Point
 */
export function dev() {
  ws = createReconnectingWebSocket('ws://localhost:8000');
  
  const overlay = (() => {
    let el;
    return {
      show(msg) {
        if (!el) {
          el = document.createElement('div');
          Object.assign(el.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(200,0,0,0.85)', color: '#fff', fontFamily: 'monospace',
            fontSize: '14px', whiteSpace: 'pre-wrap', zIndex: '10001', padding: '20px', overflowY: 'auto',
          });
          el.id = 'clippy-error-overlay';
          document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.display = 'block';
      },
      hide() { if (el) el.style.display = 'none'; },
    };
  })();

  const toast = (() => {
    let el;
    return {
      show(msg) {
        if (el) el.remove();
        el = document.createElement('div');
        Object.assign(el.style, {
          position: 'fixed', top: 'calc(3rem + 10px)', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#FFF0DF', color: 'var(--text-primary-default)', padding: '10px',
          borderRadius: '4px', zIndex: '10002', fontWeight: 'bold', cursor: 'pointer',
          fontSize: '14px', border: '2px #FF8C1A solid', boxShadow: '0px 0px 0px 2px rgba(255, 140, 26, 0.25)'
        });
        el.textContent = msg;
        el.onclick = () => {
          el.remove();
          showLintingModal();
        };
        document.body.appendChild(el);
        setTimeout(() => el?.remove(), 6000);
      }
    };
  })();

  ws.addEventListener('open', () => console.info('clippy: connected to dev server'));
  ws.addEventListener('message', e => {
    const data = JSON.parse(e.data);
    switch (data.type) {
      case 'extension_update':
        overlay.hide();
        location.reload();
        break;
      case 'extension_update_failed':
        overlay.show(data.error);
        break;
      case 'show_toast':
        toast.show(data.message);
        break;
    }
  });
}

/**
 * Displays a modal with ESLint results
 */
export function showLintingModal() {
  const { backdrop, body, close } = createModal('Linting Results');
  
  Object.assign(body.style, {
    maxHeight: '50vh', overflowY: 'auto', padding: '1rem'
  });

  body.textContent = 'Fetching lint results...';

  fetch('http://localhost:8000/lint-results')
    .then(res => res.json())
    .then(results => {
      body.textContent = '';
      if (!results || results.length === 0) {
        body.innerHTML = '<div style="color: #4cd964; font-weight: bold;">✅ No errors found!</div>';
        return;
      }

      results.forEach(file => {
        const fileHeader = document.createElement('div');
        Object.assign(fileHeader.style, { fontWeight: 'bold', marginTop: '10px', borderBottom: '1px solid #ccc' });
        fileHeader.textContent = file.filePath.split('/').pop();
        body.appendChild(fileHeader);

        file.messages.forEach(msg => {
          const errorLine = document.createElement('div');
          Object.assign(errorLine.style, {
            fontSize: '12px', margin: '4px 0', cursor: 'pointer',
            color: msg.severity === 2 ? '#ff4c4c' : '#ffab19'
          });
          // FIX 2: Make lint errors clickable
          errorLine.onclick = () => {
             openInEditor(file.filePath, msg.line, msg.column);
             close();
          };
          errorLine.textContent = `L${msg.line}: ${msg.message} (${msg.ruleId})`;
          body.appendChild(errorLine);
        });
      });
    })
    .catch(err => { body.textContent = `Failed to load lint results: ${err.message}`; });

  return backdrop;
}

/**
 * Displays a read-only error modal for blocks
 */
export function blockErrorModal(title, errorContent, onOpenFile = console.log) {
  console.log(onOpenFile)
  const { body, close } = createModal(title);

  const label = document.createElement('div');
  label.className = ScratchCSS.find('prompt_label');
  label.textContent = 'This modal was added by Clippy. See the console for more information.';
  label.style.marginTop = '0.5rem';
  body.appendChild(label);

  const errorDisplay = document.createElement('textarea');
  errorDisplay.readOnly = true;
  errorDisplay.rows = 8;
  errorDisplay.value = errorContent;
  
  Object.assign(errorDisplay.style, {
    width: '100%', padding: '0.5rem', border: '1px solid rgba(0, 0, 0, 0.15)',
    borderRadius: '4px', color: 'inherit', fontFamily: 'monospace',
    fontSize: '12px', resize: 'vertical', outline: 'none',
  });
  
  body.appendChild(errorDisplay);

  const buttonRow = document.createElement('div');
  buttonRow.className = ScratchCSS.find('prompt_button-row');

  const openButton = document.createElement('button');
  openButton.className = ScratchCSS.find('prompt_ok-button');
  openButton.textContent = 'Open File';
  // FIX 3: Ensure this calls the function and closes modal
  openButton.onclick = () => {
    onOpenFile();
    close();
  };
  buttonRow.appendChild(openButton);

  const okBtn = document.createElement('button');
  okBtn.className = ScratchCSS.find('prompt_ok-button');
  okBtn.textContent = 'Close';
  okBtn.onclick = close;
  buttonRow.appendChild(okBtn);
  body.appendChild(buttonRow);

  setTimeout(() => errorDisplay.focus(), 10);
}