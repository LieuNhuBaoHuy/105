// server.js — Thay thế VS Code Live Server
// Chạy: node server.js
// Truy cập: http://localhost:3000

import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = 3000;
const LEVEL_PATH = path.join(__dirname, 'resource', 'level.json');

// ─── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
    '.html' : 'text/html',
    '.js'   : 'application/javascript',
    '.json' : 'application/json',
    '.jpg'  : 'image/jpeg',
    '.jpeg' : 'image/jpeg',
    '.png'  : 'image/png',
    '.glb'  : 'model/gltf-binary',
    '.mp3'  : 'audio/mpeg',
    '.wav'  : 'audio/wav',
    '.css'  : 'text/css',
    '.ico'  : 'image/x-icon',
};

// ─── Server ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {

    // ── CORS (cho import map từ unpkg) ──────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ── POST /save-level → ghi level.json ──────────────────────────────────
    if (req.method === 'POST' && req.url === '/save-level') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                // Validate JSON trước khi ghi
                const data = JSON.parse(body);
                const pretty = JSON.stringify(data, null, 2);
                fs.writeFileSync(LEVEL_PATH, pretty, 'utf8');
                console.log('[server] level.json saved —', Object.keys(data).length, 'keys');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                console.error('[server] save-level error:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // ── GET static files ────────────────────────────────────────────────────
    let urlPath = req.url.split('?')[0];  // bỏ query string
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = path.join(__dirname, urlPath);

    // Bảo vệ: không cho truy cập ra ngoài thư mục project
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`404 Not Found: ${urlPath}`);
            } else {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
            return;
        }
        const ext  = path.extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n🎮  Game server running at  http://localhost:${PORT}`);
    console.log(`📁  Serving from: ${__dirname}`);
    console.log(`💾  level.json:   ${LEVEL_PATH}\n`);
});
