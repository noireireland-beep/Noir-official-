import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function vercelApiDevPlugin(): Plugin {
  return {
    name: 'atelier-noire-api-dev',
    configureServer(server) {
      server.middlewares.use('/download/atelier-noire-vercel.zip', (_req, res, next) => {
        try {
          const zipPath = '/tmp/atelier-noire-vercel.zip';
          const pyScript = [
            'import os, zipfile',
            "excludes = {'node_modules', '.aistudio', 'dist', '.git', '.playwright-cli', 'build', 'coverage'}",
            `with zipfile.ZipFile('${zipPath}', 'w', zipfile.ZIP_DEFLATED) as zf:`,
            "    for root, dirs, files in os.walk('.'):",
            '        dirs[:] = [d for d in dirs if d not in excludes]',
            '        for f in files:',
            "            if f.startswith('.local-store') or f.endswith('.log') or f.startswith('.env'):",
            "                if f != '.env.example': continue",
            "            p = os.path.join(root, f)",
            "            zf.write(p, os.path.relpath(p, '.'))",
          ].join('\n');
          execFileSync('python3', ['-c', pyScript], {cwd: process.cwd()});
          const stat = fs.statSync(zipPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename="atelier-noire-vercel.zip"');
          res.setHeader('Content-Length', String(stat.size));
          fs.createReadStream(zipPath).pipe(res);
        } catch (err) {
          next(err);
        }
      });

      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const rawUrl = req.url || '/';
          const fullUrl = `/api${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
          const parsedUrl = new URL(fullUrl, 'http://localhost');

          // Read request body
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let body: unknown = rawBody;
          if (rawBody && req.headers['content-type']?.includes('application/json')) {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = rawBody;
            }
          }

          const query: Record<string, string | string[]> = {};
          parsedUrl.searchParams.forEach((value, key) => {
            const existing = query[key];
            if (existing === undefined) {
              query[key] = value;
            } else if (Array.isArray(existing)) {
              existing.push(value);
            } else {
              query[key] = [existing, value];
            }
          });

          const vercelReq = Object.assign(req, {
            url: fullUrl,
            query,
            body,
            cookies: {},
          });

          const vercelRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vercelRes;
            },
            json(payload: unknown) {
              if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
              }
              res.end(JSON.stringify(payload));
              return vercelRes;
            },
            send(payload: unknown) {
              if (typeof payload === 'object' && payload !== null && !Buffer.isBuffer(payload)) {
                return vercelRes.json(payload);
              }
              res.end(payload);
              return vercelRes;
            },
          });

          const pathname = parsedUrl.pathname;
          if (pathname === '/api/orders' || pathname === '/api/orders/') {
            const mod = await server.ssrLoadModule('/api/orders.ts');
            await mod.default(vercelReq, vercelRes);
            return;
          }

          const catchAll = await server.ssrLoadModule('/api/[...route].ts');
          await catchAll.default(vercelReq, vercelRes);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), vercelApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
