const express = require('express');
const amqp = require('amqplib');
const fs = require('fs');
const app = express();
const port = 8080;

const RABBITMQ_URL = 'amqp://user:pass@rabbitmq';
const QUEUE = 'logs';
const logPath = './logs.txt';

let channel;

// Ensure logs.txt exists at startup
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, '', 'utf8');
}

// Connect to RabbitMQ
async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE, { durable: true }); // ✅ FIXED: match durability setting
    console.log('✅ Connected to RabbitMQ and queue asserted');
  } catch (err) {
    console.error('❌ Failed to connect to RabbitMQ', err.message);
    setTimeout(connectToRabbitMQ, 5000); // Retry after 5s
  }
}

// Consume messages and append to a log file
async function consumeLogs() {
  if (!channel) return;
  channel.consume(QUEUE, (msg) => {
    if (msg) {
      const log = msg.content.toString();
      fs.appendFileSync(logPath, `${new Date().toISOString()} - ${log}\n`);
      console.log('📩 Received:', log);
      channel.ack(msg);
    }
  });
}

// Health/info route for root
app.get('/', (req, res) => {
  res.send('✅ RabbitMQ Logger Service is running. Visit <a href="/logs">/logs</a> to view logs.');
});

// Serve logs via HTTP
app.get('/logs', (req, res) => {
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Failed to read log file:', err.message);
      return res.status(500).send('❌ Error reading logs.');
    }
    res.type('text/plain').send(data);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`📊 RabbitMQ logger service starting on port ${port}`);
  connectToRabbitMQ().then(consumeLogs);
});
