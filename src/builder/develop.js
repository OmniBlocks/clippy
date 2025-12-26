import { build } from './index.js';
import chokidar from 'chokidar';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createConsola } from 'consola';

export async function startDevServer({ port = 8000, verbose = false, ...argv } = {}) {
  const consola = createConsola({ level: verbose ? 999 : 3 });
  let latestJS = '';

  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  function broadcastUpdate() {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'extension_update' }));
      }
    });
  }

  async function rebuild() {
    const js = await build({ develop: true, consola, ...argv });
    if (js) {
      latestJS = js;
      consola.success('Build complete!');
      broadcastUpdate(); // notify connected clients
    }
  }

  // Initial build
  await rebuild();

  // Watch src/ and scratch.yaml
  const watcher = chokidar.watch(['src/**/*', 'scratch.yaml'], { ignoreInitial: true });
  watcher.on('all', async (event, file) => {
    consola.info(`File changed: ${file} (${event})`);
    await rebuild();
  });

  // HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === '/clippy.js') {
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.end(latestJS, 'utf8');
    } else if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(302, {
        Location: `https://turbowarp.org/editor?extension=http://localhost:${port}/clippy.js`,
      });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // Upgrade HTTP server to handle WebSocket connections
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });

  server.listen(port, () => {
    consola.success(`http://localhost:${port} redirects to TurboWarp with your extension.`);
  });

  // Optional: log WebSocket connections
  wss.on('connection', ws => {
    consola.info('Extension loaded');
  });

  return { server, wss };
}
