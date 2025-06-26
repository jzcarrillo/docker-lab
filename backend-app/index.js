const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');

const app = express(); // ✅ Define app first
app.set('trust proxy', true); // ✅ Then set trust proxy

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

app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    await redis.del('notes:all');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting note:', err);
    res.status(500).json({ error: 'Failed to insert note' });
  }
});

app.get('/api/notes', async (req, res) => {
  try {
    const cacheKey = 'notes:all';
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log('📦 Returned from Redis cache');
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query('SELECT * FROM notes ORDER BY id DESC');
    await redis.set(cacheKey, JSON.stringify(result.rows), 'EX', 60);

    console.log('💾 Returned from DB and cached');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notes:', err);
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
    res.status(200).json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Error deleting note:', err);
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
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating note:', err);
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
        console.log('✏️ Updated via /process:', result.rows[0]);
        return res.status(200).json({ message: 'Note updated' });
      }

      console.log(`ℹ️ No note found with id ${id}, inserting new note...`);
    }

    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );

    await redis.del('notes:all');
    console.log('🆕 Inserted via /process:', result.rows[0]);
    res.status(201).json({ message: 'Note inserted' });

  } catch (err) {
    console.error('❌ Error in /process:', err);
    res.status(500).json({ error: 'Failed to process note' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Backend is up and running');
});

app.listen(3000, '0.0.0.0', () => {
  console.log('✅ Backend server running on port 3000');
});
