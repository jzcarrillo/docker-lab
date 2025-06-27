const express = require('express');
const amqp = require('amqplib');
const fs = require('fs');
const app = express();
const port = 8080;

const RABBITMQ_URL = 'amqp://user:pass@rabbitmq';
const QUEUE = 'logs';
const logPath = './logs.txt';

let channel = null;

// Ensure logs.txt exists
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, '', 'utf8');
  console.log('📝 Created logs.txt');
}

// Connect to RabbitMQ and consume logs
async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE, { durable: true }); // Must match producer

    console.log('✅ Connected to RabbitMQ and queue asserted');

    // Start consuming logs
    channel.consume(QUEUE, (msg) => {
      if (msg) {
        const log = msg.content.toString();
        const timestamp = `${new Date().toISOString()} - ${log}\n`;
        fs.appendFileSync(logPath, timestamp);
        console.log('📩 Received log:', log);
        channel.ack(msg);
      }
    });
  } catch (err) {
    console.error('❌ Failed to connect or consume from RabbitMQ:', err.message);
    setTimeout(connectToRabbitMQ, 5000); // Retry after 5s
  }
}

// Routes
app.get('/', (req, res) => {
  res.send('✅ RabbitMQ Logger Service is running. Visit <a href="/logs">/logs</a> to view logs.');
});

app.get('/logs', (req, res) => {
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Failed to read log file:', err.message);
      return res.status(500).send('❌ Error reading logs.');
    }
    res.type('text/plain').send(data || '📭 No logs yet.');
  });
});

// Start service
app.listen(port, () => {
  console.log(`📊 RabbitMQ Logger service started on port ${port}`);
  connectToRabbitMQ();
});
