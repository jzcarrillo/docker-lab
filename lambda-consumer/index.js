const amqp = require('amqplib');
const axios = require('axios');

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

          try {
            const res = await axios.post('http://backend:3000/process', JSON.parse(content));
            console.log('✅ Sent to backend, response status:', res.status);
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
