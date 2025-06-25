const express = require('express');
const router = express.Router();
const redis = require('redis');

const client = redis.createClient({
  url: 'redis://redis:6379' // Container name = redis
});

client.connect().catch(console.error);

// POST /cache
router.post('/cache', async (req, res) => {
  const { key, value } = req.body;
  try {
    await client.set(key, value);
    res.json({ success: true, message: `Stored ${key}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /cache/:key
router.get('/cache/:key', async (req, res) => {
  const key = req.params.key;
  try {
    const value = await client.get(key);
    res.json({ key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
