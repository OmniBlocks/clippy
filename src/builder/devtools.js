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

    ws.onopen = e => {
      retries = 0;
      emit("open", e);
    };

    ws.onmessage = e => emit("message", e);

    ws.onerror = e => emit("error", e);

    ws.onclose = e => {
      emit("close", e);
      if (closed) return;

      const delay = Math.min(
        minDelay * Math.pow(factor, retries++),
        maxDelay
      );

      setTimeout(connect, delay);
    };
  }

  connect();

  return {
    addEventListener(type, fn) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type, fn) {
      listeners[type] = listeners[type]?.filter(f => f !== fn);
    },
    send(data) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    close() {
      closed = true;
      ws.close();
    }
  };
}

const ws = createReconnectingWebSocket('ws://localhost:8000');

const overlay = (() => {
  let el;
  return {
    show(msg) {
      if (!el) {
        el = document.createElement('div');
        Object.assign(el.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(200,0,0,0.85)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          zIndex: '9999',
          padding: '20px',
          overflowY: 'auto',
        });
        el.id = 'clippy-error-overlay';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.display = 'block';
    },
    hide() {
      if (el) el.style.display = 'none';
    },
  };
})();

ws.addEventListener('open', () =>
  console.info('clippy: connected to dev server')
);

ws.addEventListener('error', e =>
  console.warn('clippy: disconnected from dev server', e)
);

ws.addEventListener('message', e => {
  const data = JSON.parse(e.data);
  if (data.type === 'extension_update') {
    overlay.hide();
    location.reload();
  } else if (data.type === 'extension_update_failed') {
    overlay.show(data.error);
  }
});
