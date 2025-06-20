const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const FRONTEND = 'https://vigilant-space-guide-v65wvgjx5ppqcxxr-8080.app.github.dev';

// 1) CORS middleware for all routes & methods
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    // Preflight: respond immediately
    return res.sendStatus(204);
  }
  next();
});

// 2) Optional health-check
app.get('/', (req, res) => {
  res.send('✅ API Gateway is up. Use /api/notes');
});

// 3) Proxy /api/notes to backend
app.use(
  '/api/notes',
  createProxyMiddleware({
    target: 'http://backend:3000',
    changeOrigin: true,
    onProxyRes(proxyRes, req, res) {
      // Ensure CORS headers are forwarded in proxied response
      proxyRes.headers['Access-Control-Allow-Origin'] = FRONTEND;
       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type';
    },
  })
);

app.listen(8081, () => {
  console.log('✅ API Gateway running on port 8081');
});
