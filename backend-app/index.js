const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

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

// Create a new note
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

// Get all notes
app.get('/api/notes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM notes WHERE id = $1', [id]);
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
      // Try to update if ID is present
      const result = await pool.query(
        'UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING *',
        [title, content, id]
      );

      if (result.rowCount > 0) {
        console.log('✏️ Updated via /process:', result.rows[0]);
        return res.status(200).json({ message: 'Note updated' });
      }

      // If update did not affect any row, fallback to insert
      console.log(`ℹ️ No note found with id ${id}, inserting new note...`);
    }

    // Insert if no ID or update failed
    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    console.log('🆕 Inserted via /process:', result.rows[0]);
    res.status(201).json({ message: 'Note inserted' });

  } catch (err) {
    console.error('❌ Error in /process:', err);
    res.status(500).json({ error: 'Failed to process note' });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Backend is up');
});

app.listen(3000, () => {
  console.log('✅ Backend server running on port 3000');
});
