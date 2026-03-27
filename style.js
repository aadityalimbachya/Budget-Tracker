// ================== DOM ELEMENTS ==================
const expenseForm = document.getElementById('expense-form');
const expenseTableBody = document.getElementById('expense-table-body');
const categorySelect = document.getElementById('category');
const typeSelect = document.getElementById('type');
const addCategoryBtn = document.getElementById('add-category');
const newCatContainer = document.getElementById('new-category-container');
const newCatInput = document.getElementById('new-category-input');
const saveCategoryBtn = document.getElementById('save-category');
const submitBtn = document.getElementById('submit-btn');

// Dashboard elements
const displayIncome = document.getElementById('display-income');
const displayExpense = document.getElementById('display-expense');
const displaySavings = document.getElementById('display-savings');
const globalProgressFill = document.getElementById('global-progress-fill');
const globalStatusText = document.getElementById('global-status-text');

// Budgets elements
const categoryBudgetsList = document.getElementById('category-budgets-list');

// Backend State
const API_URL = 'http://localhost:5000/api';
let transactions = [];
let categoryBudgets = {};

// Charts
let pieChartInstance = null;
let lineChartInstance = null;

// ================== PAGE LOAD & DB FETCH ==================
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Fetch current Category Budgets
    const budgetRes = await fetch(`${API_URL}/budgets`);
    if (budgetRes.ok) {
      categoryBudgets = await budgetRes.json();
    }

    // 2. Fetch all stored Transactions
    const txRes = await fetch(`${API_URL}/transactions`);
    if (txRes.ok) {
      transactions = await txRes.json();
    }
  } catch(err) {
    console.warn("Backend not reachable. Falling back to empty state. Start your server!", err);
    showNotification("Could not connect to database backend.", "error");
  }

  // Handle custom categories locally 
  const storedCategories = JSON.parse(localStorage.getItem('customCategories')) || [];
  storedCategories.forEach(cat => addCategoryToSelect(cat));

  document.getElementById('date').value = new Date().toISOString().split('T')[0];

  renderTable();
  renderSummary();
  renderCategoryBudgets();
});

// Dynamic form submit button color
typeSelect.addEventListener('change', () => {
  if (typeSelect.value === 'income') {
    submitBtn.style.backgroundColor = '#10b981';
    submitBtn.textContent = 'Add Income';
  } else {
    submitBtn.style.backgroundColor = '#ef4444';
    submitBtn.textContent = 'Add Expense';
  }
});

// ================== TOAST NOTIFICATIONS ==================
function showNotification(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 300);
  }, 3000);
}

// ================== CATEGORY SETUP ==================
addCategoryBtn.addEventListener('click', () => {
  newCatContainer.style.display = 'flex';
  newCatInput.focus();
});

saveCategoryBtn.addEventListener('click', () => {
  const newCategory = newCatInput.value.trim();
  if (!newCategory) return;

  addCategoryToSelect(newCategory);

  let storedCategories = JSON.parse(localStorage.getItem('customCategories')) || [];
  if (!storedCategories.includes(newCategory)) {
    storedCategories.push(newCategory);
    localStorage.setItem('customCategories', JSON.stringify(storedCategories));
  }

  categorySelect.value = newCategory;
  newCatInput.value = '';
  newCatContainer.style.display = 'none';
  renderCategoryBudgets(); 
  showNotification(`Category '${newCategory}' added`, 'success');
});

function addCategoryToSelect(category) {
  if ([...categorySelect.options].some(o => o.value === category)) return;
  categorySelect.add(new Option(category, category));
  const filterSelect = document.getElementById('filter-category');
  filterSelect.add(new Option(category, category));
}

// ================== FORM SUBMIT TO DB ==================
expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const date = document.getElementById('date').value;
  const type = typeSelect.value;
  const category = categorySelect.value;
  const amountInput = document.getElementById('amount');
  const amount = parseFloat(amountInput.value);
  const note = document.getElementById('note').value;

  amountInput.style.borderColor = '';
  if (!date || !category || isNaN(amount)) {
    amountInput.style.borderColor = 'red';
    showNotification("Please enter a valid amount and required fields.", "error");
    return;
  }

  const payload = { date, type, category, amount, note };
  
  try {
    const response = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error("Failed to post to API");
    
    const savedTransaction = await response.json();
    transactions.push(savedTransaction);
    
    // Reset Form
    expenseForm.reset();
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    if (type === 'income') {
      submitBtn.style.backgroundColor = '#10b981';
      submitBtn.textContent = 'Add Income';
    } else {
      submitBtn.style.backgroundColor = '#ef4444';
      submitBtn.textContent = 'Add Expense';
    }

    renderTable();
    renderSummary();
    renderCategoryBudgets(); 
    
    // Category Budgets Checks
    if (type === 'expense') {
      const catBudget = categoryBudgets[category];
      if (catBudget && catBudget > 0) {
        const expensesForCat = transactions.filter(t => t.type === 'expense' && t.category === category).reduce((sum, t) => sum + t.amount, 0);
        if (expensesForCat > catBudget) {
          showNotification(`Warning: You have exceeded your budget for ${category}!`, "error");
        } else if (expensesForCat > catBudget * 0.8) {
          showNotification(`Watch out! You are near your ${category} limit.`, "warning");
        } else {
          showNotification("Transaction saved to database!", "success");
        }
      } else {
          showNotification("Transaction saved to database!", "success");
      }
    } else {
        showNotification("Income saved to database!", "success");
    }
  } catch(err) {
      showNotification("Error: Need running server to add transactions.", "error");
      console.error(err);
  }
});

// ================== CATEGORY BUDGETS (POST TO DB) ==================
function renderCategoryBudgets() {
  categoryBudgetsList.innerHTML = '';
  const allCategories = [...categorySelect.options].map(o => o.value);
  
  const expenseDict = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    expenseDict[t.category] = (expenseDict[t.category] || 0) + t.amount;
  });

  allCategories.forEach(cat => {
    const savedAmount = categoryBudgets[cat] || '';
    const spent = expenseDict[cat] || 0;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'cat-budget-item';

    const label = document.createElement('strong');
    label.style.width = "120px";
    label.textContent = cat;

    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'cat-progress-container';
    
    const limit = savedAmount ? parseFloat(savedAmount) : 0;
    let progressHtml = '';
    
    if (limit > 0) {
      const pct = Math.min((spent / limit) * 100, 100);
      let pClass = 'cat-budget-fill';
      if (pct > 90) pClass += ' danger';
      else if (pct > 75) pClass += ' warning';
      
      progressHtml = `
        <div style="font-size:0.8rem; display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Spent: ₹${spent.toFixed(2)}</span>
          <span>Limit: ₹${limit.toFixed(2)}</span>
        </div>
        <div class="cat-budget-bar"><div class="${pClass}" style="width:${pct}%"></div></div>
      `;
    } else {
      progressHtml = `<div style="font-size:0.8rem; color:#94a3b8;">Spent: ₹${spent.toFixed(2)} - No Limit Set</div>`;
    }
    progressWrapper.innerHTML = progressHtml;

    const inputWrapper = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'number';
    input.placeholder = 'Budget Limit (₹)';
    input.value = savedAmount;
    
    input.addEventListener('change', async (e) => {
      const val = parseFloat(e.target.value);
      
      try {
        await fetch(`${API_URL}/budgets`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ category: cat, limit: val || 0 })
        });
        
        if (!isNaN(val) && val > 0) {
          categoryBudgets[cat] = val;
        } else {
          delete categoryBudgets[cat];
        }
        renderCategoryBudgets(); 
        showNotification("Budget updated on server", "success");
      } catch (err) {
          showNotification("Failed to update budget on server", "error");
      }
    });
    
    inputWrapper.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(progressWrapper);
    wrapper.appendChild(inputWrapper);
    categoryBudgetsList.appendChild(wrapper);
  });
}

// ================== FILTER & TABLE ==================
function getFilteredTransactions() {
  const filterType = document.getElementById('filter-type').value;
  const filterCategory = document.getElementById('filter-category').value;
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  return transactions.filter(exp => {
    if (filterType && exp.type !== filterType) return false;
    if (filterCategory && exp.category !== filterCategory) return false;
    if (startDate && exp.date < startDate) return false;
    if (endDate && exp.date > endDate) return false;
    return true;
  });
}

function renderTable(data = transactions) {
  expenseTableBody.innerHTML = '';

  if (data.length === 0) {
    expenseTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:grey;">No records found</td></tr>`;
    return;
  }

  const sortedData = [...data].sort((a,b) => new Date(b.date) - new Date(a.date));

  sortedData.forEach((t) => {
    // Determine the array index to perform splice on exactly
    const trueIndex = transactions.indexOf(t); 
    const row = document.createElement('tr');
    
    const typeLabel = t.type === 'income' ? 'Income' : 'Expense';
    const typeClass = t.type === 'income' ? 'type-income' : 'type-expense';

    row.innerHTML = `
      <td>${t.date}</td>
      <td><span class="type-badge ${typeClass}">${typeLabel}</span></td>
      <td>
          <span class="category-badge ${getCategoryClass(t.category)}">${t.category}</span>
      </td>
      <td style="font-weight:600; color:${t.type==='income'?'#10b981':'#ef4444'}">
        ${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}
      </td>
      <td>${t.note || '-'}</td>
      <td><button class="delete-btn" data-index="${trueIndex}">Delete</button></td>
    `;
    expenseTableBody.appendChild(row);
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.index));
  });
}

// DELETE FROM DB
async function deleteTransaction(index) {
  const tx = transactions[index];
  
  try {
    if(tx._id) {
       await fetch(`${API_URL}/transactions/${tx._id}`, { method: 'DELETE' });
    }
    
    // Remove locally after DB deletion
    transactions.splice(index, 1);
    renderTable();
    renderSummary();
    renderCategoryBudgets();
    showNotification('Transaction deleted off server', 'warning');
  } catch(err) {
      showNotification("Failed deleting server transaction", "error");
  }
}

document.getElementById('filter-btn').addEventListener('click', () => {
  const filtered = getFilteredTransactions();
  renderTable(filtered);
  renderSummary(filtered);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  renderTable();
  renderSummary();
});

// ================== SUMMARY & CHARTS ==================
function renderSummary(data = transactions) {
  const totalIncome = data.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const savings = totalIncome - totalExpense;

  displayIncome.textContent = `₹${totalIncome.toFixed(2)}`;
  displayExpense.textContent = `₹${totalExpense.toFixed(2)}`;
  displaySavings.textContent = `₹${savings.toFixed(2)}`;
  displaySavings.style.color = savings >= 0 ? '#3b82f6' : '#ef4444';

  if (totalIncome > 0) {
    const pct = Math.min((totalExpense / totalIncome) * 100, 100);
    globalProgressFill.style.width = `${pct}%`;
    globalProgressFill.className = '';
    
    if (pct < 70) {
      globalStatusText.textContent = `Great! You've used ${pct.toFixed(0)}% of your income.`;
    } else if (pct < 95) {
      globalProgressFill.classList.add('warning');
      globalStatusText.textContent = `Warning: High expenses, ${pct.toFixed(0)}% of income used.`;
    } else {
      globalProgressFill.classList.add('danger');
      globalStatusText.textContent = `Alert: You are spending more than or almost equal to your income!`;
    }
  } else {
    globalProgressFill.style.width = `0%`;
    globalProgressFill.className = '';
    globalStatusText.textContent = `Add income to start calculating relative spending.`;
  }

  updateCharts(data);
}

// Chart.js Implementations
function updateCharts(data) {
  const ctxPie = document.getElementById('categoryPieChart').getContext('2d');
  const ctxLine = document.getElementById('trendLineChart').getContext('2d');

  const expenseData = data.filter(t => t.type === 'expense');
  const catSums = {};
  expenseData.forEach(e => { catSums[e.category] = (catSums[e.category] || 0) + e.amount; });
  
  const pieLabels = Object.keys(catSums);
  const pieValues = Object.values(catSums);
  const colors = pieLabels.map((_, i) => [`#3b82f6`, `#f59e0b`, `#ec4899`, `#10b981`, `#8b5cf6`, `#14b8a6`, `#f43f5e`][i % 7]);

  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels: pieLabels,
      datasets: [{ data: pieValues, backgroundColor: colors }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });

  const currentMonth = new Date().toISOString().substring(0,7); 
  const currentMonthData = expenseData.filter(d => d.date.startsWith(currentMonth));
  
  const dailySums = {};
  currentMonthData.forEach(d => {
    const day = d.date.substring(8, 10);
    dailySums[day] = (dailySums[day] || 0) + d.amount;
  });

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const lineLabels = Array.from({length: daysInMonth}, (_, i) => String(i + 1).padStart(2, '0'));
  const lineValues = lineLabels.map(day => dailySums[day] || 0);

  if (lineChartInstance) lineChartInstance.destroy();
  lineChartInstance = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: lineLabels,
      datasets: [{
        label: 'Daily Spending (₹)',
        data: lineValues,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

function getCategoryClass(category) {
  const predefined = {
    Food: "category-food",
    Transport: "category-transport",
    Entertainment: "category-entertainment",
    Salary: "category-salary"
  };
  if (predefined[category]) return predefined[category];
  return `category-badge`;
}
