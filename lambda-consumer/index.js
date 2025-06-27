require('./tracing');

const amqp = require('amqplib');
const axios = require('axios');
const express = require('express');
const client = require('prom-client');

// === Prometheus Setup ===
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const messagesProcessed = new client.Counter({
  name: 'rabbitmq_messages_processed_total',
  help: 'Total number of messages processed by the consumer',
});

// === Logging Setup ===
let logs = [];
const rawConsoleLog = console.log;
const rawConsoleError = console.error;
const rawConsoleInfo = console.info;

function customLogger(msg) {
  const entry = `${new Date().toISOString()} - ${msg}`;
  logs.push(entry);
  if (logs.length > 1000) logs.shift();
  rawConsoleLog(entry); // Avoid recursion
}

function customErrorLogger(msg) {
  const entry = `${new Date().toISOString()} - ERROR: ${msg}`;
  logs.push(entry);
  if (logs.length > 1000) logs.shift();
  rawConsoleError(entry); // Avoid recursion
}

console.log = customLogger;
console.info = customLogger;
console.error = customErrorLogger;

// === Express App ===
const app = express();
app.set('trust proxy', true);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/', (req, res) => {
  res.send('🧪 Lambda Consumer is alive');
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/logs', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(logs.slice(-100).join('\n'));
});

app.listen(8080, () => {
  console.log('📊 Lambda Consumer metrics server running on port 8080');
});

// === RabbitMQ Consumption ===
async function connectWithRetry() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const conn = await amqp.connect('amqp://user:pass@rabbitmq:5672');
      const ch = await conn.createChannel();
      const q = 'notes';

      await ch.assertQueue(q);
      console.log('✅ Connected to RabbitMQ. Waiting for messages...');

      ch.consume(q, async (msg) => {
        if (msg !== null) {
          const content = msg.content.toString();
          console.log('📨 Received from queue:', content);
          messagesProcessed.inc();

          try {
            const data = JSON.parse(content);
            let response;

            if (data.id) {
              response = await axios.put(
                `http://backend:3000/api/notes/${data.id}`,
                { title: data.title, content: data.content }
              );
              console.log(`✅ Updated note ID ${data.id}, status:`, response.status);
            } else {
              response = await axios.post(
                'http://backend:3000/api/notes',
                { title: data.title, content: data.content }
              );
              console.log('✅ Inserted new note, status:', response.status);
            }
          } catch (err) {
            console.error('❌ Error forwarding to backend:', err.message);
          }

          ch.ack(msg);
        }
      });

      return;
    } catch (err) {
      console.error(`⚠️ RabbitMQ not ready (attempt ${attempt}/5)...`);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  console.error('❌ Failed to connect to RabbitMQ after 5 attempts');
  process.exit(1);
}

connectWithRetry();
