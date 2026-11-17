const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Set SUPABASE_URL and SUPABASE_KEY in your environment variables (or paste them below for testing)
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================================
// REST API ENDPOINTS — APP STATE SYNC
// ==========================================================

app.get('/api/state', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('data')
      .eq('id', 1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.json(null);
    res.json(JSON.parse(data.data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const dataStr = JSON.stringify(req.body);
    
    // Upsert full app state blob
    const { error: stateErr } = await supabase
      .from('app_state')
      .upsert({ id: 1, data: dataStr });
    
    if (stateErr) throw stateErr;

    // Sync todos table rows
    if (Array.isArray(req.body.todos)) {
      await supabase.from('todos').delete().neq('id', 'KEEP_NONE');
      
      if (req.body.todos.length > 0) {
        const formattedTodos = req.body.todos.map(td => ({
          id: td.id,
          t: td.t,
          desc: td.desc || '',
          date: td.date || '',
          time: td.time || '',
          p: td.p || 'Medium',
          d: td.d || 25,
          notes: td.notes || '',
          done: td.done ? true : false,
          mit: td.mit ? true : false,
          done_at: td.doneAt || null,
          imp: td.imp || null
        }));
        await supabase.from('todos').insert(formattedTodos);
      }
    }

    res.json({ status: 'saved', xp: req.body.xp, streak: req.body.streak });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/state', async (req, res) => {
  try {
    await supabase.from('app_state').delete().eq('id', 1);
    await supabase.from('todos').delete().neq('id', 'KEEP_NONE');
    res.json({ status: 'reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// DEDICATED CRUD REST ENDPOINTS FOR TODOS
// ==========================================================

app.get('/api/todos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('todos').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const td = req.body;
    const { error } = await supabase.from('todos').upsert({
      id: td.id,
      t: td.t,
      desc: td.desc || '',
      date: td.date || '',
      time: td.time || '',
      p: td.p || 'Medium',
      d: td.d || 25,
      notes: td.notes || '',
      done: td.done ? true : false,
      mit: td.mit ? true : false
    });
    if (error) throw error;
    res.status(201).json({ status: 'created', id: td.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const td = req.body;
    const { error } = await supabase.from('todos').update({
      t: td.t,
      desc: td.desc || '',
      date: td.date || '',
      time: td.time || '',
      p: td.p || 'Medium',
      d: td.d || 25,
      notes: td.notes || '',
      done: td.done ? true : false,
      mit: td.mit ? true : false,
      done_at: td.doneAt || null,
      imp: td.imp || null
    }).eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ status: 'updated', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('todos').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ status: 'deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Focus Path Supabase REST API running on port ${PORT}`);
});
