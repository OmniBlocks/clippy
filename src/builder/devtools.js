import ReconnectingWebSocket from 'reconnecting-websocket';

const ws = new ReconnectingWebSocket('ws://localhost:8000');

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

ws.addEventListener('open', () => console.info('clippy: connected to dev server'));
ws.addEventListener('error', e => console.warn('clippy: disconnected from dev server', e));
ws.addEventListener('message', e => {
  const data = JSON.parse(e.data);
  if (data.type === 'extension_update') {
    overlay.hide();
    location.reload();
  } else if (data.type === 'extension_update_failed') {
    overlay.show(data.error);
  }
});
