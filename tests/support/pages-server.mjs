import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

/** Serve only the deployed artifact, below the real repository URL prefix. */
export async function servePages(outDir) {
  const root = resolve(outDir);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/hashirase/')) throw new Error('Outside repository path');
      const path = resolve(root, pathname.slice('/hashirase/'.length) || 'index.html');
      if (!path.startsWith(root + sep)) throw new Error('Outside artifact');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch { res.writeHead(404, { 'content-type': 'text/html' }).end(await readFile(resolve(root, '404.html'))); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { baseURL: `http://127.0.0.1:${server.address().port}/hashirase/`, close: () => new Promise(resolve => server.close(resolve)) };
}
