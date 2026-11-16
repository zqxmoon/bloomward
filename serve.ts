// serve.ts — a tiny static file server for playing Bloomward locally.
// Node 22, standard library only. Run `node serve.ts`, then open the
// address it prints (http://localhost:8077 by default; PORT overrides).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const port = Number(process.env.PORT) || 8077;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const filePath = join(root, rel === '' ? 'index.html' : rel);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Bloomward is growing at http://localhost:${port}`);
});
