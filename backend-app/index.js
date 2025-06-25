const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis'); // 🔌 Add Redis

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'db',
  user: 'user',
  password: 'pass',
  database: 'mydb',
  port: 5432,
});

// 🔌 Initialize Redis
const redis = new Redis({
  host: 'redis',
  port: 6379
});

// Create a new note
app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );

    // ❌ Invalidate Redis cache
    await redis.del('notes:all');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting note:', err);
    res.status(500).json({ error: 'Failed to insert note' });
  }
});

// Get all notes with Redis caching
app.get('/api/notes', async (req, res) => {
  try {
    const cacheKey = 'notes:all';
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log('📦 Returned from Redis cache');
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query('SELECT * FROM notes ORDER BY id DESC');

    // 💾 Cache in Redis (TTL: 60 seconds)
    await redis.set(cacheKey, JSON.stringify(result.rows), 'EX', 60);

    console.log('💾 Returned from DB and cached');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Get a single note by ID with Redis cache
app.get('/api/notes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const cacheKey = `note:${id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`📦 Cache hit for note ${id}`);
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
    const note = result.rows[0];

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await redis.set(cacheKey, JSON.stringify(note), 'EX', 60); // cache for 60s
    console.log(`💾 Cache set for note ${id}`);
    res.json(note);
  } catch (err) {
    console.error(`❌ Error fetching note ${id}:`, err);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM notes WHERE id = $1', [id]);

    // ❌ Invalidate Redis cache
    await redis.del('notes:all');
    await redis.del(`note:${id}`);

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Update a note
app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const result = await pool.query(
      'UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING *',
      [title, content, id]
    );

    // ❌ Invalidate Redis cache
    await redis.del('notes:all');
    await redis.del(`note:${id}`);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// ✅ Process queue message from Lambda Consumer
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

// ✅ Redis Test: Set key-value
app.post('/cache', async (req, res) => {
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Missing key or value' });
  }

  try {
    await redis.set(key, value, 'EX', 60); // store for 60 seconds
    res.status(201).json({ message: `Key ${key} set`, ttl: 60 });
  } catch (err) {
    console.error('Error setting Redis key:', err);
    res.status(500).json({ error: 'Failed to set Redis key' });
  }
});

// ✅ Redis Test: Get key-value
app.get('/cache/:key', async (req, res) => {
  const { key } = req.params;

  try {
    const value = await redis.get(key);
    if (value === null) {
      return res.status(404).json({ error: `Key ${key} not found` });
    }
    res.json({ key, value });
  } catch (err) {
    console.error('Error getting Redis key:', err);
    res.status(500).json({ error: 'Failed to get Redis key' });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Backend is up');
});

app.listen(3000, () => {
  console.log('✅ Backend server running on port 3000');
});
