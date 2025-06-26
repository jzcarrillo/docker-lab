const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

// ✅ Prometheus setup
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics(); // Collect system + Node.js metrics

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

// ✅ Prometheus /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// 3) Rate Limiting
const notesLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: '⚠️ Too many requests to /api/notes. Please wait a minute.',
});

const submitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: '⚠️ Too many requests to /submit. Please wait a minute.',
});

// 4) Proxy /api/notes to backend
app.use(
  '/api/notes',
  notesLimiter,
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

// 5) Proxy /submit to lambda-producer
app.use(
  '/submit',
  submitLimiter,
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

// ✅ Start the server
app.listen(8081, () => {
  console.log('✅ API Gateway running on port 8081');
});
