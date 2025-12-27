import { build } from './index.js';
import chokidar from 'chokidar';
import http from 'http';
import { WebSocketServer } from 'ws';
import { findProjectPath } from './parse-scratch.js';
import { lintExtensionFiles } from '../lint.js';
import { performance } from 'perf_hooks';

const MODS = {
  tw: { name: 'TurboWarp', url: (p) => `https://turbowarp.org/editor?extension=http://localhost:${p}/clippy.js` },
  amp: { name: 'AmpMod', url: (p) => `https://ampmod.codeberg.page/editor?extension=http://localhost:${p}/clippy.js` },
  pm: { name: 'PenguinMod', url: (p) => `https://studio.penguinmod.com/editor.html?extension=http://localhost:${p}/clippy.js` }
};

export async function startDevServer({ consolaInstance, port = 8000, verbose = false, ...argv } = {}) {
  const consola = consolaInstance;
  const projectPath = findProjectPath();
  let latestJS = '';
  let lastBuildTime = 0;
  let lintResults;

  const selectedModKey = MODS[argv.mod] ? argv.mod : 'tw';
  const currentMod = MODS[selectedModKey];

  const context = await build({ develop: true, verbose, consolaInstance, ...argv });
  if (!context) throw new Error('Failed to create esbuild context');

  const performRebuild = async (isInitial = false) => {
    const start = performance.now();
    try {
      const result = await context.rebuild();
      if (result?.outputFiles?.[0]?.text) {
        latestJS = result.outputFiles[0].text;
        if (!isInitial) {
          broadcastUpdate();
        }
      }
      lintResults = await lintExtensionFiles({ develop: true });
    } catch (err) {
      consola.error(`\x1b[31mbuild error\x1b[0m\n`, err.message);
    }
  };

  // Initial Build
  await performRebuild(true);

  const wss = new WebSocketServer({ noServer: true });
  function broadcastUpdate() {
    wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'extension_update' })));
  }

  // Vite-style Watcher
  const watcher = chokidar.watch([`${projectPath}/src`, `${projectPath}/scratch.*`], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 50 },
  });

  watcher.on('change', (path) => {
    performRebuild();
  });

  const server = http.createServer(async (req, res) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      return res.end();
    }

    if (req.url === '/clippy.js') {
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'ETag': `W/"${lastBuildTime}"`
      });
      return res.end(latestJS);
    } 
    
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(302, { Location: currentMod.url(port) });
      return res.end();
    }

    res.writeHead(404, headers);
    res.end();
  });

  server.on('upgrade', (req, sock, head) => {
    wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws, req));
  });

  server.listen(port, () => {consola.info(`Redirect to editor: http://localhost:${port}`)});

  return { server, wss, context };
}