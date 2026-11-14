const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const db = new sqlite3.Database('./focuspath.db');

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    t TEXT,
    desc TEXT,
    date TEXT,
    time TEXT,
    p TEXT,
    d INTEGER,
    notes TEXT,
    done INTEGER,
    mit INTEGER,
    doneAt TEXT,
    imp TEXT
  )`);
});

// ==========================================================
// REST API ENDPOINTS — APP STATE SYNC
// ==========================================================

// GET full application state
app.get('/api/state', (req, res) => {
  db.get('SELECT data FROM app_state WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json(null);
    res.json(JSON.parse(row.data));
  });
});

// PUT (Save/Update) full application state
app.put('/api/state', (req, res) => {
  const dataStr = JSON.stringify(req.body);
  db.run(
    `INSERT INTO app_state (id, data) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [dataStr],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: 'saved', xp: req.body.xp, streak: req.body.streak });
    }
  );
});

// DELETE (Reset) application state
app.delete('/api/state', (req, res) => {
  db.run('DELETE FROM app_state WHERE id = 1', err => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM todos', () => {
      res.json({ status: 'reset' });
    });
  });
});

// ==========================================================
// DEDICATED CRUD REST ENDPOINTS FOR TODOS (GET, POST, PUT, DELETE)
// ==========================================================

app.get('/api/todos', (req, res) => {
  db.all('SELECT * FROM todos', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, done: !!r.done, mit: !!r.mit })));
  });
});

app.post('/api/todos', (req, res) => {
  const { id, t, desc, date, time, p, d, notes, done, mit } = req.body;
  db.run(
    `INSERT OR REPLACE INTO todos (id, t, desc, date, time, p, d, notes, done, mit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, t, desc, date, time, p, d, notes, done ? 1 : 0, mit ? 1 : 0],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ status: 'created', id });
    }
  );
});

app.put('/api/todos/:id', (req, res) => {
  const { t, desc, date, time, p, d, notes, done, mit, doneAt, imp } = req.body;
  db.run(
    `UPDATE todos SET t=?, desc=?, date=?, time=?, p=?, d=?, notes=?, done=?, mit=?, doneAt=?, imp=? WHERE id=?`,
    [t, desc, date, time, p, d, notes, done ? 1 : 0, mit ? 1 : 0, doneAt || null, imp || null, req.params.id],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: 'updated', id: req.params.id });
    }
  );
});

app.delete('/api/todos/:id', (req, res) => {
  db.run('DELETE FROM todos WHERE id = ?', [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: 'deleted', id: req.params.id });
  });
});

app.listen(PORT, () => {
  console.log(`Focus Path REST API running on port ${PORT}`);
});