const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Paste your Aiven MySQL Service URI inside the quotes below, or set it as DATABASE_URL in Render
const DB_URI = process.env.DATABASE_URL || 'PASTE_YOUR_MYSQL_SERVICE_URI_HERE';

// Strip ?ssl-mode=REQUIRED from Aiven URI and enforce SSL cleanly for mysql2
const cleanUri = DB_URI.replace('?ssl-mode=REQUIRED', '');
const pool = mysql.createPool({
  uri: cleanUri,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 5
});

// Initialize MySQL Tables automatically on startup
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INT PRIMARY KEY,
        data LONGTEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id VARCHAR(64) PRIMARY KEY,
        t VARCHAR(255),
        \`desc\` TEXT,
        \`date\` VARCHAR(32),
        \`time\` VARCHAR(32),
        p VARCHAR(32),
        d INT,
        notes TEXT,
        done TINYINT(1),
        mit TINYINT(1),
        doneAt VARCHAR(32),
        imp VARCHAR(16)
      )
    `);
    console.log('✅ Connected to MySQL & verified tables');
  } catch (err) {
    console.error('❌ MySQL Init Error:', err.message);
  }
}
initDB();

// GET full application state
app.get('/api/state', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT data FROM app_state WHERE id = 1');
    if (rows.length === 0) return res.json(null);
    res.json(JSON.parse(rows[0].data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT full application state AND sync all tasks into the 'todos' table
app.put('/api/state', async (req, res) => {
  try {
    const dataStr = JSON.stringify(req.body);
    await pool.query(
      `INSERT INTO app_state (id, data) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [dataStr]
    );

    if (Array.isArray(req.body.todos)) {
      await pool.query('DELETE FROM todos');
      for (const td of req.body.todos) {
        await pool.query(
          `INSERT INTO todos (id, t, \`desc\`, \`date\`, \`time\`, p, d, notes, done, mit, doneAt, imp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [td.id, td.t, td.desc || '', td.date || '', td.time || '', td.p || 'Medium', td.d || 25, td.notes || '', td.done ? 1 : 0, td.mit ? 1 : 0, td.doneAt || null, td.imp || null]
        );
      }
    }
    res.json({ status: 'saved', xp: req.body.xp, streak: req.body.streak });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE (Reset) application state
app.delete('/api/state', async (req, res) => {
  try {
    await pool.query('DELETE FROM app_state WHERE id = 1');
    await pool.query('DELETE FROM todos');
    res.json({ status: 'reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated CRUD endpoints for Todos (GET, POST, PUT, DELETE)
app.get('/api/todos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM todos');
    res.json(rows.map(r => ({ ...r, done: !!r.done, mit: !!r.mit })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { id, t, desc, date, time, p, d, notes, done, mit } = req.body;
    await pool.query(
      `INSERT INTO todos (id, t, \`desc\`, \`date\`, \`time\`, p, d, notes, done, mit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE t=VALUES(t), \`desc\`=VALUES(\`desc\`), \`date\`=VALUES(\`date\`), \`time\`=VALUES(\`time\`), p=VALUES(p), d=VALUES(d), notes=VALUES(notes), done=VALUES(done), mit=VALUES(mit)`,
      [id, t, desc || '', date || '', time || '', p || 'Medium', d || 25, notes || '', done ? 1 : 0, mit ? 1 : 0]
    );
    res.status(201).json({ status: 'created', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const { t, desc, date, time, p, d, notes, done, mit, doneAt, imp } = req.body;
    await pool.query(
      `UPDATE todos SET t=?, \`desc\`=?, \`date\`=?, \`time\`=?, p=?, d=?, notes=?, done=?, mit=?, doneAt=?, imp=? WHERE id=?`,
      [t, desc || '', date || '', time || '', p || 'Medium', d || 25, notes || '', done ? 1 : 0, mit ? 1 : 0, doneAt || null, imp || null, req.params.id]
    );
    res.json({ status: 'updated', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM todos WHERE id = ?', [req.params.id]);
    res.json({ status: 'deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Focus Path MySQL REST API running on port ${PORT}`);
});
