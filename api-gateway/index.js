require('./tracing'); 

const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const client = require('prom-client');

// === Prometheus setup ===
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Define custom metrics
const totalRequests = new client.Counter({
  name: 'api_gateway_requests_total',
  help: 'Total number of requests to API Gateway',
  labelNames: ['route', 'method'],
});

const throttledRequests = new client.Counter({
  name: 'api_gateway_429_total',
  help: 'Total number of 429 responses from API Gateway',
  labelNames: ['route'],
});

register.registerMetric(totalRequests);
register.registerMetric(throttledRequests);

const app = express();
const FRONTEND = 'https://vigilant-space-guide-v65wvgjx5ppqcxxr-443.app.github.dev';

// === Middleware ===
// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Count total requests
app.use((req, res, next) => {
  totalRequests.inc({ route: req.path, method: req.method });
  next();
});

// Health-check
app.get('/', (req, res) => {
  res.send('✅ API Gateway is up. Use /api/notes and /submit');
});

// Prometheus /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// === Rate Limiters ===
const notesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  handler: (req, res) => {
    throttledRequests.inc({ route: '/api/notes' });
    res.status(429).json({ message: '⚠️ Too many requests to /api/notes. Please wait.' });
  },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  handler: (req, res) => {
    throttledRequests.inc({ route: '/submit' });
    res.status(429).json({ message: '⚠️ Too many requests to /submit. Please wait.' });
  },
});

// === Routes ===
// Proxy /api/notes to backend
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

// Proxy /submit to lambda-producer
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

// Start the server
app.listen(8081, () => {
  console.log('✅ API Gateway running on port 8081');
});
