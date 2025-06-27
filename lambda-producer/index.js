require('./tracing');

const express = require('express');
const amqp = require('amqplib');
const client = require('prom-client');

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics(); // Enables default system & Node.js metrics

// === Logging Setup ===
let logs = [];

// Preserve original console methods to avoid recursion
const originalLog = console.log;
const originalInfo = console.info;
const originalError = console.error;

const customLogger = (msg) => {
  const entry = `${new Date().toISOString()} - ${msg}`;
  logs.push(entry);
  if (logs.length > 1000) logs.shift(); // keep log size manageable
  originalLog(entry); // Use preserved original console.log
};

console.log = customLogger;
console.info = customLogger;
console.error = (msg) => {
  const entry = `${new Date().toISOString()} - ERROR: ${msg}`;
  logs.push(entry);
  if (logs.length > 1000) logs.shift();
  originalError(entry); // Use preserved original console.error
};

const app = express();
app.set('trust proxy', true);
app.use(express.json());

// ✅ CORS middleware
const FRONTEND = 'https://vigilant-space-guide-v65wvgjx5ppqcxxr-443.app.github.dev';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const RABBITMQ_URL = 'amqp://user:pass@rabbitmq:5672';

// ✅ Prometheus /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send('🚀 Lambda Producer is healthy');
});

// ✅ Logs route
app.get('/logs', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(logs.slice(-100).join('\n')); // show last 100 logs
});

app.post('/submit', async (req, res) => {
  const { id, title, content } = req.body;

  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    const queue = 'notes';

    await channel.assertQueue(queue, { durable: true });

    const message = JSON.stringify({ id, title, content });
    channel.sendToQueue(queue, Buffer.from(message), { persistent: true });

    console.log('✅ Sent to queue:', message);
    await channel.close();
    await conn.close();

    res.status(200).send('Message queued successfully');
  } catch (err) {
    console.error(`❌ Failed to send to queue: ${err.message}`);
    res.status(500).send('Queue error');
  }
});

app.listen(8081, () => {
  console.log('🚀 Lambda Producer running on port 8081');
});
