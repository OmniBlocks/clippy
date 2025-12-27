import { build } from './index.js';
import chokidar from 'chokidar';
import http from 'http';
import { WebSocketServer } from 'ws';
import { findProjectPath } from './parse-scratch.js';
import { lintExtensionFiles } from '../lint.js';

export async function startDevServer({ consolaInstance, port = 8000, verbose = false, ...argv } = {}) {
  const consola = consolaInstance;
  const projectPath = findProjectPath();
  let latestJS = '';
  let lintResults;

  const context = await build({ develop: true, verbose, consolaInstance, ...argv });
  if (!context) throw new Error('Failed to create esbuild context');

  try {
    const result = await context.rebuild();
    if (result?.outputFiles?.[0]?.text) latestJS = result.outputFiles[0].text;
    lintResults = await lintExtensionFiles({ develop: true });
  } catch (err) {
    consola.error('[Clippy Dev] Initial build failed:', err);
  }

  const wss = new WebSocketServer({ noServer: true });
  function broadcastUpdate() {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'extension_update' }));
      }
    });
  }

  async function rebuild() {
    try {
      const result = await context.rebuild();
      if (result?.outputFiles?.[0]?.text) {
        latestJS = result.outputFiles[0].text;
        broadcastUpdate();
      }
      lintResults = await lintExtensionFiles({ develop: true });
    } catch (err) {
      consola.error('[Clippy Dev] Rebuild failed:', err);
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'extension_update_failed', error: err.message }));
        }
      });
    }
  }

  const watcher = chokidar.watch(
    [`${projectPath}/src`, `${projectPath}/scratch.*`],
    {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 50,
      binaryInterval: 500,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      followSymlinks: true,
      ignorePermissionErrors: true,
    }
  );

  watcher
    .on('error', error => consola.error('Watcher error', error))
    .on('raw', (event, path, details) => consola.debug('Raw event:', event, path, details))
    .on('add', rebuild)
    .on('change', rebuild)
    .on('unlink', rebuild);

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
      if (!lintResults) lintResults = await lintExtensionFiles({ develop: true });
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(lintResults);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });

  server.listen(port, () => {
    consola.success(`http://localhost:${port} redirects to TurboWarp with your extension.`);
  });

  wss.on('connection', ws => consola.info('Extension loaded'));

  return { server, wss, context };
}
