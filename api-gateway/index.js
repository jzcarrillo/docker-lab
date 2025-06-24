const express = require('express');
const rateLimit = require('express-rate-limit');
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

// 3) Rate Limiting (20 req/min) — apply only to /submit route
const submitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  message: '⚠️ Too many requests to /submit. Please wait a minute.',
});

// 4) Proxy /api/notes to backend (no rate limit)
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

// 5) Proxy /submit to lambda-producer with rate limit
app.use(
  '/submit',
  submitLimiter, // 🛑 Limit only this route
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
