const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize DB file
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ transactions: [], budgets: [] }));
}

function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// -----------------------------------------
// 2. API Routes : Transactions
// -----------------------------------------

// GET all transactions
app.get('/api/transactions', (req, res) => {
  try {
    const db = readDB();
    const transactions = [...db.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new transaction
app.post('/api/transactions', (req, res) => {
  try {
    const db = readDB();
    const newTransaction = { ...req.body, _id: Date.now().toString() + Math.random().toString(36).substring(7) };
    db.transactions.push(newTransaction);
    writeDB(db);
    res.status(201).json(newTransaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a transaction by _id
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const db = readDB();
    db.transactions = db.transactions.filter(t => t._id !== req.params.id);
    writeDB(db);
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------
// 3. API Routes : Category Budgets
// -----------------------------------------

// GET category budgets
app.get('/api/budgets', (req, res) => {
  try {
    const db = readDB();
    const budgetObj = {};
    db.budgets.forEach(b => { 
        budgetObj[b.category] = b.limit; 
    });
    res.json(budgetObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST/Update a category budget
app.post('/api/budgets', (req, res) => {
  const { category, limit } = req.body;
  try {
    const db = readDB();
    if (limit > 0) {
      const idx = db.budgets.findIndex(b => b.category === category);
      if (idx !== -1) {
        db.budgets[idx].limit = limit;
      } else {
        db.budgets.push({ category, limit });
      }
    } else {
      db.budgets = db.budgets.filter(b => b.category !== category);
    }
    writeDB(db);
    res.json({ message: 'Budget saved successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
