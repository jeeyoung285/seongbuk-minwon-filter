// 로컬 실행: npm start (= node --env-file=.env server.js) → http://localhost:3000
// public 폴더의 화면과 /api/* 를 한 번에 띄운다. Vercel 에서는 이 파일 대신 api/*.js 가 바로 쓰인다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const ROUTES = { classify: require('./api/classify'), chat: require('./api/chat'), law: require('./api/law') };

function wrap(res) {
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const m = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (m) {
    const handler = ROUTES[m[1]];
    if (!handler) return wrap(res).status(404).json({ error: '없는 API' });
    let raw = '';
    for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    return handler(req, wrap(res));
  }
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('없는 파일'); }
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => console.log(`성북 안심 민원 필터: http://localhost:${PORT}`));
