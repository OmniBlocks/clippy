import { build } from './index.js';
import chokidar from 'chokidar';
import http from 'http';
import { WebSocketServer } from 'ws';
import { findProjectPath } from './parse-scratch.js';
import { lintExtensionFiles } from '../lint.js';
import { mods } from './mod-info.js';
import launchEditor from 'launch-editor';
import path from 'path';

export async function startDevServer({ consolaInstance, port = 8000, verbose = false, ...argv } = {}) {
  const consola = consolaInstance;
  const projectPath = findProjectPath();
  let latestJS = '';
  let lintResults = '{}';
  
  const selectedModKey = mods[argv.mod] ? argv.mod : 'tw';
  const currentMod = mods[selectedModKey];

  const context = await build({ develop: true, verbose, consolaInstance, ...argv });
  if (!context) throw new Error('Failed to create esbuild context');

  const wss = new WebSocketServer({ noServer: true });

  /**
   * Helper to notify all connected clients
   */
  const broadcast = (data) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  };

  /**
   * Logic to check lintResults for errors
   */
  const getErrorCount = (results) => {
    try {
      const parsed = typeof results === 'string' ? JSON.parse(results) : results;
      if (Array.isArray(parsed)) {
        return parsed.reduce((acc, file) => acc + (file.errorCount || 0), 0);
      }
      return parsed.errorCount || 0;
    } catch (e) {
      return 0;
    }
  };

  /**
   * Handles building, linting, and notifying the client
   */
  const performRebuild = async (isInitial = false) => {
    try {
      const result = await context.rebuild();
      if (result?.outputFiles?.[0]?.text) {
        latestJS = result.outputFiles[0].text;
      }

      lintResults = await lintExtensionFiles({ develop: true });
      
      const errorCount = getErrorCount(lintResults);
      if (errorCount > 0) {
        consola.warn(`Linting failed with ${errorCount} errors.`);
        broadcast({ 
          type: 'show_toast', 
          message: 'Your extension has lint errors!',
          severity: 'error'
        });
      }

      if (!isInitial) {
        broadcast({ type: 'extension_update' });
      }
    } catch (err) {
      consola.error(`\x1b[31mbuild error\x1b[0m\n`, err.message);
    }
  };

  await performRebuild(true);

  const watcher = chokidar.watch([`${projectPath}/src`, `${projectPath}/scratch.*`], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 50 },
  });

  watcher.on('change', () => performRebuild());

  const server = http.createServer(async (req, res) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      return res.end();
    }

    if (req.url === '/clippy.js') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/javascript' });
      return res.end(latestJS);
    }

    if (req.url === '/lint-results') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      return res.end(typeof lintResults === 'string' ? lintResults : JSON.stringify(lintResults));
    }

    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(302, { Location: currentMod.url(port) });
      return res.end();
    }

    res.writeHead(404, headers);
    res.end();
  });

  server.on('upgrade', (req, sock, head) => {
    wss.handleUpgrade(req, sock, head, (ws) => {
      wss.emit('connection', ws, req);
      
      // Listen for client requests to open files
      ws.on('message', (data) => {
        if (verbose) consolaInstance.debug("WebSocket message received", data)
        try {
          const payload = JSON.parse(data);
          if (payload.type === 'open_editor') {
            const { file, line = 1, column = 1 } = payload;
            
            if (!file) return;

            // Resolve path relative to project root
            const absolutePath = path.isAbsolute(file) 
              ? file 
              : path.resolve(projectPath, file);

            consola.info(`Opening ${path.basename(file)}:${line} in editor...`);
            
            launchEditor(`${absolutePath}:${line}:${column}`, (fileName, errorMsg) => {
              consola.error(`Could not open ${fileName}: ${errorMsg}`);
            });
          }
        } catch (e) {
          consola.error('Error handling WebSocket message:', e);
        }
      });

      // Send initial lint status
      setTimeout(() => {
        if (getErrorCount(lintResults) > 0) {
          ws.send(JSON.stringify({ 
            type: 'show_toast', 
            message: 'Your extension has lint errors! Click this toast for more information.',
            severity: 'error'
          }));
        }
      }, 500);
    });
  });

  server.listen(port, () => { 
    consola.success(`Dev server running at http://localhost:${port}`);
  });

  return { server, wss, context };
}