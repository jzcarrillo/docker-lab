const express = require('express');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

const RABBITMQ_URL = 'amqp://user:pass@rabbitmq:5672';

app.post('/submit', async (req, res) => {
  const { id, title, content } = req.body; // ✅ Include id from frontend
  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    const queue = 'notes';

    await channel.assertQueue(queue, { durable: true });

    const message = JSON.stringify({ id, title, content }); // ✅ Include id in message

    channel.sendToQueue(queue, Buffer.from(message), { persistent: true });

    console.log('✅ Sent to queue:', message);
    await channel.close();
    await conn.close();

    res.status(200).send('Message queued successfully');
  } catch (err) {
    console.error('❌ Failed to send to queue', err);
    res.status(500).send('Queue error');
  }
});

app.listen(8081, () => {
  console.log('🚀 Lambda Producer running on port 8081');
});
