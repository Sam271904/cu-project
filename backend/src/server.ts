import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { loadAppConfig } from './config';
import { openDb } from './db/db';
import { createApiHandler } from './routes/api';

export function createServer(options?: { db?: Database.Database; frontendDistPath?: string }) {
  const shouldCloseDb = !options?.db;
  const db = options?.db ?? openDb();
  const apiHandler = createApiHandler(db);

  function resolveFrontendDistPath(): string {
    const candidates = [
      // built runtime: backend/dist -> ../../frontend/dist
      path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
      // ts-node runtime: backend/src -> ../../../frontend/dist
      path.resolve(__dirname, '..', '..', '..', 'frontend', 'dist'),
      // workspace root cwd
      path.resolve(process.cwd(), 'frontend', 'dist'),
      // backend workspace cwd
      path.resolve(process.cwd(), '..', 'frontend', 'dist'),
    ];
    for (const c of candidates) {
      const index = path.join(c, 'index.html');
      if (fs.existsSync(index)) return c;
    }
    // fallback keeps previous behavior for unknown layouts
    return candidates[0];
  }

  const frontendDistPath = options?.frontendDistPath ?? resolveFrontendDistPath();

  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '';

    if (url === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Static file serving for the (minimal) frontend dist folder.
    // IMPORTANT: only serve real files (and `/`), so we don't抢占后端动态路由 like `/push-demo`.
    if (req.method === 'GET' && !url.startsWith('/api/') && url !== '' && url !== '/health' && url !== '/sw.js' && url !== '/push-demo') {
      const safeUrlPath = url.replace(/\\/g, '/');
      const relPath = safeUrlPath === '/' ? 'index.html' : safeUrlPath.replace(/^\//, '');

      const resolved = path.join(frontendDistPath, relPath);
      // Prevent directory traversal.
      if (!resolved.startsWith(frontendDistPath)) {
        res.statusCode = 403;
        res.end('forbidden');
        return;
      }

      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        const ext = path.extname(resolved).toLowerCase();
        const contentType =
          ext === '.html'
            ? 'text/html; charset=utf-8'
            : ext === '.js'
              ? 'application/javascript; charset=utf-8'
              : ext === '.css'
                ? 'text/css; charset=utf-8'
                : 'application/octet-stream';
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(resolved).pipe(res);
        return;
      }
      // If not a real file, keep going so backend routes can handle it.
    }

    if (url === '/sw.js') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(`self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data = {};
  }

  const title = (data && typeof data.title === 'string' && data.title) ? data.title : 'Push Notification';
  const body = (data && typeof data.short_summary === 'string') ? data.short_summary : '';
  const options = {
    body,
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification && event.notification.data ? event.notification.data : null;
  const target = (data && data.url && typeof data.url === 'string') ? data.url : '/';
  event.waitUntil(clients.openWindow(target));
});
`);
      return;
    }

    if (url === '/push-demo') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Push Demo</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; padding: 16px; }
      button { margin: 8px 0; padding: 10px 12px; cursor: pointer; }
      pre { background: #f6f8fa; padding: 12px; overflow: auto; }
      .row { margin: 8px 0; }
      .muted { color: #666; }
    </style>
  </head>
  <body>
    <h2>Push Demo（订阅 -> 入库 -> 分发 -> 通知）</h2>
    <div class="row muted">注意：需要在服务端配置 VAPID：VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY。并且浏览器必须支持 Push（Chrome/Edge 需开启站点通知权限）。</div>

    <div class="row"><button id="btnPerm">检查权限</button></div>
    <div class="row"><button id="btnVapid">拉取 VAPID 公钥</button></div>
    <div class="row"><button id="btnSubscribe">请求权限并订阅</button></div>
    <div class="row"><button id="btnEnqueue">入队测试事件</button></div>
    <div class="row"><button id="btnSendReal">发送 queued（real 模式）</button></div>

    <div class="row">
      <div><b>当前 Notification.permission：</b><span id="perm">?</span></div>
      <div><b>当前 VAPID 公钥：</b><span id="pubkey" class="muted">未获取</span></div>
    </div>

    <pre id="log"></pre>

    <script>
      const logEl = document.getElementById('log');
      function log(x) {
        console.log(x);
        logEl.textContent += (logEl.textContent ? '\\n' : '') + JSON.stringify(x, null, 2);
      }

      const permEl = document.getElementById('perm');
      const pubEl = document.getElementById('pubkey');
      let vapidPublicKey = null;

      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      }

      async function fetchJson(path, opts) {
        const res = await fetch(path, opts);
        const text = await res.text();
        let body = null;
        try { body = JSON.parse(text); } catch {}
        return { status: res.status, body };
      }

      document.getElementById('btnPerm').onclick = async () => {
        permEl.textContent = Notification.permission;
      };

      document.getElementById('btnVapid').onclick = async () => {
        const r = await fetchJson('/api/push/vapid-public-key');
        if (r.status !== 200) { log({ error: 'http_error', status: r.status }); return; }
        if (!r.body || !r.body.success) { log(r.body || { success: false }); return; }
        vapidPublicKey = r.body.publicKey;
        pubEl.textContent = vapidPublicKey ? '已获取' : '未获取';
        log({ ok: true, publicKeyPresent: !!vapidPublicKey });
      };

      document.getElementById('btnSubscribe').onclick = async () => {
        if (!vapidPublicKey) {
          log({ error: 'missing_vapid_public_key', hint: '先点「拉取 VAPID 公钥」' });
          return;
        }

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          log({ error: 'not_supported' });
          return;
        }

        const perm = await Notification.requestPermission();
        permEl.textContent = perm;
        if (perm !== 'granted') {
          log({ error: 'permission_not_granted', permission: perm });
          return;
        }

        const reg = await navigator.serviceWorker.register('/sw.js');

        const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        });

        // PushSubscription.toJSON() is commonly supported
        const subJson = sub.toJSON ? sub.toJSON() : sub;
        log({ subscribed: true, endpoint: subJson.endpoint });

        const r = await fetchJson('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
        });
        if (r.status !== 200 || !r.body?.success) {
          log({ error: 'subscribe_failed', status: r.status, body: r.body });
          return;
        }
        log({ ok: true, subscriptionSaved: true });
      };

      document.getElementById('btnEnqueue').onclick = async () => {
        const r = await fetchJson('/api/push/enqueue-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ reminder_level: 'high' }),
        });
        log({ enqueue: r.body, status: r.status });
      };

      document.getElementById('btnSendReal').onclick = async () => {
        const r = await fetchJson('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ mode: 'real', limit: 10 }),
        });
        log({ sendReal: r.body, status: r.status });
      };

      permEl.textContent = Notification.permission;
    </script>
  </body>
</html>`);
      return;
    }

    void apiHandler(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('api error', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, error: 'internal_error' }));
    });
  });

  if (shouldCloseDb) {
    server.on('close', () => {
      db.close();
    });
  }

  return server;
}

// 仅在通过 `node/ts-node src/server.ts` 直接运行时启动监听
if (require.main === module) {
  const { port } = loadAppConfig();
  const server = createServer();
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`backend listening on http://localhost:${port}/health`);
  });
}

