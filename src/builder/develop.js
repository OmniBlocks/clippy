import { build } from './index.js';
import chokidar from 'chokidar';
import http from 'http';
import { WebSocketServer } from 'ws';
import { findProjectPath, parseScratch } from './parse-scratch.js';
import { lintExtensionFiles } from '../lint.js';
import { logZodError } from "./format-zod-error.js";
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read the file as a string
const lintview = readFileSync(resolve(import.meta.dirname, 'lintview.html'), 'utf8');
import { mods } from './mod-info.js';
import launchEditor from 'launch-editor';
import path from 'path';

export async function startDevServer({ consolaInstance, port = 8000, verbose = false, ...argv } = {}) {
  const consola = consolaInstance;
  const projectPath = findProjectPath();
  let latestJS = '';
  let lintResults = '{}';

  let projectConfig;
  try {
    projectConfig = parseScratch();
  } catch (err) {
    if (err.name === "ZodError") {
      logZodError(consola, err, { verbose });
      process.exit(1);
    }
    throw err;
  }
  if (!projectConfig.sandboxAllowed && port !== 8000) {
    throw new Error("Port must be 8000 if extension must be unsandboxed")
  }
  
  const selectedModKey = mods[argv.mod] ? argv.mod : 'tw';
  const currentMod = mods[selectedModKey];

  // Initialize the Rolldown build context
  const buildContext = await build({ 
    develop: true, 
    verbose, 
    consolaInstance, 
    ...argv 
  });

  if (!buildContext) {
    throw new Error('Failed to create build context. Check logs above.');
  }

  const wss = new WebSocketServer({ noServer: true });

  const broadcast = (data) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(message);
    });
  };

  const getErrorCount = (results) => {
    try {
      const parsed = typeof results === 'string' ? JSON.parse(results) : results;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.reduce((acc, file) => acc + (file.errorCount || 0), 0);
    } catch (e) { return 0; }
  };
                                       
  const performRebuild = async (isInitial = false) => {
    try {
      const result = await buildContext.rebuild();
      
      // Rolldown output is an array of chunks/assets
      const chunk = result.output.find(o => o.type === 'chunk');
      if (chunk?.code) {
        latestJS = chunk.code;
      }

      lintResults = await lintExtensionFiles({ develop: true });
      
      const errorCount = getErrorCount(lintResults);
      if (errorCount > 0) {
        consola.warn(`Linting failed with ${errorCount} errors.`);
        broadcast({ 
          type: 'show_toast', 
          message: 'Extension has lint errors!',
          severity: 'error'
        });
      }

      if (!isInitial) {
        broadcast({ type: 'extension_update' });
      }
    } catch (err) {
      consola.error(`\x1b[31mBuild error:\x1b[0m`, err);
    }
  };

  // Run the first build
  await performRebuild(true);

  // Watcher setup
  const watcher = chokidar.watch([`${projectPath}/src`, `${projectPath}/scratch.*`], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 50 },
  });

  watcher.on('change', (filePath) => {
    if (verbose) consola.info(`File changed: ${path.relative(projectPath, filePath)}`);
    performRebuild();
  });

  // HTTP Server
  const server = http.createServer(async (req, res) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    };

    if (req.method === 'OPTIONS') return res.writeHead(204, headers).end();

    if (req.url === '/clippy.js') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/javascript' });
      return res.end(latestJS);
    }

    if (req.url === '/lint-results') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      return res.end(typeof lintResults === 'string' ? lintResults : JSON.stringify(lintResults));
    }

    if (req.url === '/lintembed.html') {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html' });
      return res.end(lintview);
    }

    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(302, { Location: currentMod.url(port) });
      return res.end();
    }

    res.writeHead(404, headers).end();
  });

  // WebSocket Server for Editor Integration and Toasts
  server.on('upgrade', (req, sock, head) => {
    wss.handleUpgrade(req, sock, head, (ws) => {
      wss.emit('connection', ws, req);
      
      ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data);
          if (payload.type === 'open_editor') {
            const { file, line = 1, column = 1 } = payload;
            const absolutePath = path.isAbsolute(file) ? file : path.resolve(projectPath, file);

            consola.info(`Opening ${path.basename(file)}:${line} in editor...`);
            launchEditor(`${absolutePath}:${line}:${column}`, (f, e) => {
              consola.error(`Could not open editor for ${f}: ${e}`);
            });
          }
        } catch (e) { consola.error('WS Message Error:', e); }
      });

      // Show initial lint status on connection
      if (getErrorCount(lintResults) > 0) {
        setTimeout(() => ws.send(JSON.stringify({ 
          type: 'show_toast', 
          message: 'Extension has lint errors! Click to view.',
          severity: 'error'
        })), 500);
      }
    });
  });

  server.listen(port, () => {
    consola.success(`Dev server: http://localhost:${port}`);
    consola.info(`Serving extension at http://localhost:${port}/clippy.js`);
  });

  return { server, wss, buildContext };
}