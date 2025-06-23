const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const FRONTEND = 'https://vigilant-space-guide-v65wvgjx5ppqcxxr-443.app.github.dev';

// 1) CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 2) Health-check
app.get('/', (req, res) => {
  res.send('✅ API Gateway is up. Use /api/notes and /submit');
});

// 3) Proxy /api/notes to backend
app.use(
  '/api/notes',
  createProxyMiddleware({
    target: 'http://backend:3000',
    changeOrigin: true,
    onProxyRes(proxyRes) {
      proxyRes.headers['Access-Control-Allow-Origin'] = FRONTEND;
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type';
    },
  })
);

// 4) Proxy /submit to lambda-producer
app.use(
  '/submit',
  createProxyMiddleware({
    target: 'http://lambda-producer:8081',
    changeOrigin: true,
    onProxyRes(proxyRes) {
      proxyRes.headers['Access-Control-Allow-Origin'] = FRONTEND;
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type';
    },
  })
);

app.listen(8081, () => {
  console.log('✅ API Gateway running on port 8081');
});
