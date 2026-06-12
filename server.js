// ============================================================
// NindraSync — Backend Server (Node.js + Express + SQLite)
// ============================================================
// Run: npm install && npm start
// Server starts on: http://localhost:3000
// ============================================================

const express = require('express');
const cors    = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SQLite Database Setup ─────────────────────────────────
const db = new sqlite3.Database('./nindrasync.db', (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('✅ SQLite database connected.');
});

const DEFAULT_USER_ID = 1;

db.serialize(() => {
  // Sleep logs table
  db.run(`CREATE TABLE IF NOT EXISTS sleep_logs (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    userId   INTEGER NOT NULL DEFAULT 1,
    date     TEXT    NOT NULL,
    bedtime  TEXT    NOT NULL,
    wake     TEXT    NOT NULL,
    duration TEXT    NOT NULL,
    quality  INTEGER NOT NULL DEFAULT 3,
    notes    TEXT    DEFAULT '',
    createdAt TEXT   DEFAULT (datetime('now'))
  )`);

  // Mood logs table
  db.run(`CREATE TABLE IF NOT EXISTS mood_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    INTEGER NOT NULL DEFAULT 1,
    mood      TEXT    NOT NULL,
    loggedAt  TEXT    DEFAULT (datetime('now'))
  )`);

  // Habits table
  db.run(`CREATE TABLE IF NOT EXISTS habits (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    INTEGER NOT NULL DEFAULT 1,
    name      TEXT    NOT NULL,
    icon      TEXT    DEFAULT '✅',
    done      INTEGER DEFAULT 0,
    streak    INTEGER DEFAULT 0,
    updatedAt TEXT    DEFAULT (datetime('now'))
  )`);

  // Seed default habits if none exist
  db.get('SELECT COUNT(*) as cnt FROM habits WHERE userId=?', [DEFAULT_USER_ID], (err, row) => {
    if (!err && row && row.cnt === 0) {
      const defaults = [
        { name: 'Morning Yoga', icon: '🧘' },
        { name: 'Drink Water (8 glasses)', icon: '💧' },
        { name: 'Meditation 10 min', icon: '🪔' },
        { name: 'No screen 1hr before bed', icon: '📵' },
      ];
      defaults.forEach(h => {
        db.run('INSERT INTO habits (userId, name, icon) VALUES (?,?,?)', [DEFAULT_USER_ID, h.name, h.icon]);
      });
    }
  });
});

// ─── Helper ───────────────────────────────────────────────
const dbRun  = (sql, params=[]) => new Promise((res,rej) => db.run(sql,params,function(err){ err?rej(err):res(this); }));
const dbGet  = (sql, params=[]) => new Promise((res,rej) => db.get(sql,params,(err,row)=>err?rej(err):res(row)));
const dbAll  = (sql, params=[]) => new Promise((res,rej) => db.all(sql,params,(err,rows)=>err?rej(err):res(rows)));


// ============================================================
//  SLEEP LOG ROUTES
// ============================================================

// GET /api/sleep — get all logs for user
app.get('/api/sleep', async (req, res) => {
  try {
    const logs = await dbAll(
      'SELECT * FROM sleep_logs WHERE userId=? ORDER BY date DESC, createdAt DESC',
      [DEFAULT_USER_ID]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sleep — add new log
app.post('/api/sleep', async (req, res) => {
  try {
    const { date, bedtime, wake, duration, quality=3, notes='' } = req.body;
    if (!date || !bedtime || !wake || !duration)
      return res.status(400).json({ error: 'date, bedtime, wake, duration are required.' });

    const result = await dbRun(
      'INSERT INTO sleep_logs (userId, date, bedtime, wake, duration, quality, notes) VALUES (?,?,?,?,?,?,?)',
      [DEFAULT_USER_ID, date, bedtime, wake, duration, quality, notes]
    );
    const log = await dbGet('SELECT * FROM sleep_logs WHERE id=?', [result.lastID]);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sleep/:id — delete a log
app.delete('/api/sleep/:id', async (req, res) => {
  try {
    const log = await dbGet('SELECT * FROM sleep_logs WHERE id=? AND userId=?', [req.params.id, DEFAULT_USER_ID]);
    if (!log) return res.status(404).json({ error: 'Log not found.' });
    await dbRun('DELETE FROM sleep_logs WHERE id=?', [req.params.id]);
    res.json({ message: 'Log deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sleep/stats — analytics summary
app.get('/api/sleep/stats', async (req, res) => {
  try {
    const logs = await dbAll(
      'SELECT * FROM sleep_logs WHERE userId=? ORDER BY date DESC LIMIT 30',
      [DEFAULT_USER_ID]
    );
    if (logs.length === 0) return res.json({ avgDuration: null, avgQuality: null, streak: 0 });

    // Parse duration strings like "7h 24m" into minutes
    const toMins = (d) => {
      const h = (d.match(/(\d+)h/) || [0,0])[1];
      const m = (d.match(/(\d+)m/) || [0,0])[1];
      return parseInt(h)*60 + parseInt(m);
    };
    const totalMins = logs.reduce((s,l) => s + toMins(l.duration), 0);
    const avgMins   = Math.round(totalMins / logs.length);
    const avgQuality= (logs.reduce((s,l) => s + l.quality, 0) / logs.length).toFixed(1);

    // Streak: consecutive days from today
    let streak = 0;
    const dates = logs.map(l => l.date);
    const today = new Date().toISOString().split('T')[0];
    let check = today;
    for (let i = 0; i < 60; i++) {
      if (dates.includes(check)) { streak++; }
      else if (i > 0) break;
      const d = new Date(check);
      d.setDate(d.getDate() - 1);
      check = d.toISOString().split('T')[0];
    }

    res.json({
      avgDuration: `${Math.floor(avgMins/60)}h ${avgMins%60}m`,
      avgQuality,
      streak,
      totalEntries: logs.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
//  MOOD LOG ROUTES
// ============================================================

// GET /api/mood — recent moods
app.get('/api/mood', async (req, res) => {
  try {
    const moods = await dbAll(
      'SELECT * FROM mood_logs WHERE userId=? ORDER BY loggedAt DESC LIMIT 30',
      [DEFAULT_USER_ID]
    );
    res.json(moods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mood — log a mood
app.post('/api/mood', async (req, res) => {
  try {
    const { mood } = req.body;
    if (!mood) return res.status(400).json({ error: 'mood is required.' });
    const result = await dbRun('INSERT INTO mood_logs (userId, mood) VALUES (?,?)', [DEFAULT_USER_ID, mood]);
    const log = await dbGet('SELECT * FROM mood_logs WHERE id=?', [result.lastID]);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
//  HABITS ROUTES
// ============================================================

// GET /api/habits
app.get('/api/habits', async (req, res) => {
  try {
    const habits = await dbAll('SELECT * FROM habits WHERE userId=? ORDER BY id', [DEFAULT_USER_ID]);
    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/habits — add habit
app.post('/api/habits', async (req, res) => {
  try {
    const { name, icon='✅' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required.' });
    const result = await dbRun('INSERT INTO habits (userId, name, icon) VALUES (?,?,?)', [DEFAULT_USER_ID, name, icon]);
    const habit  = await dbGet('SELECT * FROM habits WHERE id=?', [result.lastID]);
    res.status(201).json(habit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/habits/:id/toggle — mark done/undone
app.patch('/api/habits/:id/toggle', async (req, res) => {
  try {
    const habit = await dbGet('SELECT * FROM habits WHERE id=? AND userId=?', [req.params.id, DEFAULT_USER_ID]);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });

    const newDone   = habit.done ? 0 : 1;
    const newStreak = newDone ? habit.streak + 1 : Math.max(0, habit.streak - 1);
    await dbRun(
      'UPDATE habits SET done=?, streak=?, updatedAt=datetime("now") WHERE id=?',
      [newDone, newStreak, req.params.id]
    );
    const updated = await dbGet('SELECT * FROM habits WHERE id=?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/habits/:id
app.delete('/api/habits/:id', async (req, res) => {
  try {
    const habit = await dbGet('SELECT * FROM habits WHERE id=? AND userId=?', [req.params.id, DEFAULT_USER_ID]);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    await dbRun('DELETE FROM habits WHERE id=?', [req.params.id]);
    res.json({ message: 'Habit deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/data/clear — clear all user data (sleep, mood, habits)
app.delete('/api/data/clear', async (req, res) => {
  try {
    await dbRun('DELETE FROM sleep_logs WHERE userId=?', [DEFAULT_USER_ID]);
    await dbRun('DELETE FROM mood_logs  WHERE userId=?', [DEFAULT_USER_ID]);
    await dbRun('DELETE FROM habits     WHERE userId=?', [DEFAULT_USER_ID]);
    res.json({ message: 'All data cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🌙 NindraSync Backend Running     ║
  ║   http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝
  `);
});
