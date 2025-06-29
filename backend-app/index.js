const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const trace = require('./tracing');
const fs = require('fs');
const path = require('path');

const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'db',
  user: 'user',
  password: 'pass',
  database: 'mydb',
  port: 5432,
});

const redis = new Redis({
  host: 'redis',
  port: 6379
});

const notesRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    status: 429,
    error: "Too many requests. Please try again later."
  }
});

app.use('/api/notes', notesRateLimiter);

// Prometheus /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    await redis.del('notes:all');
    trace('Inserted note via POST /api/notes');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    trace(`Error inserting note: ${err.message}`);
    res.status(500).json({ error: 'Failed to insert note' });
  }
});

app.get('/api/notes', async (req, res) => {
  try {
    const cacheKey = 'notes:all';
    const cached = await redis.get(cacheKey);

    if (cached) {
      trace('📦 Returned notes from Redis cache');
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query('SELECT * FROM notes ORDER BY id DESC');
    await redis.set(cacheKey, JSON.stringify(result.rows), 'EX', 60);

    trace('💾 Returned notes from DB and cached');
    res.json(result.rows);
  } catch (err) {
    trace(`Error fetching notes: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await redis.del('notes:all');
    await redis.del(`note:${id}`);
    trace(`🗑️ Deleted note ${id}`);
    res.status(200).json({ message: 'Note deleted' });
  } catch (err) {
    trace(`Error deleting note: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const result = await pool.query(
      'UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING *',
      [title, content, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await redis.del('notes:all');
    await redis.del(`note:${id}`);
    trace(`✏️ Updated note ${id}`);
    res.status(200).json(result.rows[0]);
  } catch (err) {
    trace(`Error updating note: ${err.message}`);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.post('/process', async (req, res) => {
  const { id, title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing title or content' });
  }

  try {
    if (id) {
      const result = await pool.query(
        'UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING *',
        [title, content, id]
      );

      if (result.rowCount > 0) {
        await redis.del('notes:all');
        await redis.del(`note:${id}`);
        trace(`✏️ Updated via /process: ${JSON.stringify(result.rows[0])}`);
        return res.status(200).json({ message: 'Note updated' });
      }

      trace(`ℹ️ No note found with id ${id}, inserting new note...`);
    }

    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );

    await redis.del('notes:all');
    trace(`🆕 Inserted via /process: ${JSON.stringify(result.rows[0])}`);
    res.status(201).json({ message: 'Note inserted' });

  } catch (err) {
    trace(`❌ Error in /process: ${err.message}`);
    res.status(500).json({ error: 'Failed to process note' });
  }
});

// 🆕 Serve logs.txt via GET /logs
app.get('/logs', (req, res) => {
  const logFilePath = path.join(__dirname, 'logs.txt');

  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      trace(`❌ Failed to read logs.txt: ${err.message}`);
      return res.status(500).json({ error: 'Unable to read logs.txt' });
    }

    res.type('text/plain').send(data);
  });
});

app.get('/', (req, res) => {
  trace('Pinged root route');
  res.send('✅ Backend is up and running');
});

app.listen(3000, '0.0.0.0', () => {
  trace('✅ Backend server running on port 3000');
});
