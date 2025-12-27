import blockDefinitions from 'clippy:blocks';
import menuDefinitions from 'clippy:menus';
import config from 'clippy:config';
import { isDevelop } from 'clippy:info';

if (isDevelop) {
  try {
    const ws = new WebSocket('ws://localhost:8000');

    function showOverlay(message) {
      let overlay = document.getElementById('clippy-error-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'clippy-error-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(200,0,0,0.85)';
        overlay.style.color = '#fff';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '14px';
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.style.zIndex = '9999';
        overlay.style.padding = '20px';
        overlay.style.overflowY = 'auto';
        document.body.appendChild(overlay);
      }
      overlay.textContent = message;
      overlay.style.display = 'block';
    }

    function hideOverlay() {
      const overlay = document.getElementById('clippy-error-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'extension_update') {
        hideOverlay();
        location.reload();
      } else if (data.type === 'extension_update_failed') {
        showOverlay(data.error);
      }
    };

    ws.onopen = () => console.log('[Clippy Dev] Connected');
    ws.onerror = (e) => console.warn('[Clippy Dev] WebSocket error', e);
  } catch (e) {
    console.warn('[Clippy Dev] WebSocket failed', e);
  }
}

if (!Scratch.extensions.unsandboxed && !config.sandboxAllowed) {
  throw new Error(`${config.name} must run unsandboxed`);
}

class Extension {
  getInfo() {
    const blocks = blockDefinitions.map(b => ({
      opcode: b.opcode,
      ...Object.fromEntries(
        Object.entries(b.module).filter(([k]) => k !== 'def')
      )
    }));

    if (isDevelop) {
      blocks.unshift({
        func: 'viewLintResults',
        blockType: Scratch.BlockType.BUTTON,
        text: 'Open lint results (developer)'
      });
    }

    return {
      id: config.id,
      name: config.name,
      docsURI: config?.docsURI ?? undefined,
      color1: config?.colors?.[0] ?? undefined,
      color2: config?.colors?.[1] ?? undefined,
      color3: config?.colors?.[2] ?? undefined,
      blocks: blocks,
      menus: Object.fromEntries(
        menuDefinitions.map(m => [m.opcode, m.module])
      )
    };
  }

  viewLintResults() {
    /* @__PURE__ */ window.open("http://localhost:8000/lint-results");
  }
}

for (const b of blockDefinitions) {
  Extension.prototype[b.opcode] = function(args) {
    if (typeof b.module.def === 'function') {
      return b.module.def(args);
    }
    return undefined;
  };
}

const extension = new Extension();
if (config.expose) Scratch.vm.runtime[`ext_${config.id}`] = extension;
Scratch.extensions.register(extension);
