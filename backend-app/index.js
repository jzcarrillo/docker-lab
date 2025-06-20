const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
// You can keep cors(), but gateway handles CORS; this is a fallback
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'db',
  user: 'user',
  password: 'pass',
  database: 'mydb',
  port: 5432,
});

// POST /api/notes
app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting note:', err);
    res.status(500).json({ error: 'Failed to insert note' });
  }
});

// GET /api/notes
app.get('/api/notes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// ✅ DELETE /api/notes/:id
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM notes WHERE id = $1', [id]);
    res.status(204).send(); // No content
  } catch (err) {
    console.error('❌ Error deleting note:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ✅ PUT /api/notes/:id - Update a note
app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const result = await pool.query(
      'UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING *',
      [title, content, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Backend is up');
});

app.listen(3000, () => {
  console.log('✅ Backend server running on port 3000');
});
