import { build } from './index.js';
import chokidar from 'chokidar';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createConsola } from 'consola';
import { findProjectPath } from './parse-scratch.js';
import { lintExtensionFiles } from '../lint.js';

export async function startDevServer({ port = 8000, verbose = false, ...argv } = {}) {
  const consola = createConsola({ level: verbose ? 999 : 3 });
  const projectPath = findProjectPath();
  let latestJS = '';
  let lintResults;

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
      broadcastUpdate(); // notify connected clients
      lintResults = await lintExtensionFiles({develop:true});
    }
  }

  // Initial build
  await rebuild();

  const watcher = chokidar.watch(
    [
      `${projectPath}/src`,            // watch the entire src folder
      `${projectPath}/scratch.yaml`,   // watch the single file
    ],
    {
      persistent: true,
      ignoreInitial: true,    // don’t fire for existing files on start
      usePolling: true,       // forces polling (works on weird FS setups)
      interval: 50,          // poll every 500ms
      binaryInterval: 500,    // also poll binary files
      awaitWriteFinish: {
        stabilityThreshold: 200,   // wait for 200ms of no changes
        pollInterval: 100          // check every 100ms
      },
      followSymlinks: true,
      ignorePermissionErrors: true,
    }
  );

  watcher
    .on('error', error => consola.error('Watcher error', error))
    .on('raw', (event, path, details) => {
      consola.debug('Raw event:', event, path, details);
    });

  watcher.on('add', rebuild);
  watcher.on('change', rebuild);
  watcher.on('unlink', rebuild);

  // HTTP server
  const server = http.createServer(async (req, res) => {
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
    } else if (req.url === '/lint-results') {
      if (!lintResults) lintResults = await lintExtensionFiles({develop:true});
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end(lintResults);
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
