/* =========================================================
   Expense & Budget Visualizer — app.js
   =========================================================
   MVP Features:
     - Add transactions (name, amount, category)
     - Form validation
     - Scrollable transaction list with delete
     - Total balance (auto-updates)
     - Pie chart via Chart.js (auto-updates)

   Optional Challenges implemented (3 of 5):
     1. Allow users to add custom categories
     2. Sort transactions by amount or category
     3. Highlight spending over a set limit
     4. Dark / light mode toggle
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   Constants & Storage Keys
   --------------------------------------------------------- */
const STORAGE_KEY_TRANSACTIONS = 'ebv_transactions';
const STORAGE_KEY_THEME        = 'ebv_theme';
const STORAGE_KEY_LIMIT        = 'ebv_spending_limit';
const STORAGE_KEY_CATEGORIES   = 'ebv_custom_categories';

/* Fixed category colour palette */
const CATEGORY_COLORS = {
  Food:      '#22c55e',
  Transport: '#3b82f6',
  Fun:       '#f97316',
};

/* Colours for custom categories (cycling palette) */
const EXTRA_COLORS = [
  '#8b5cf6', '#ec4899', '#14b8a6', '#eab308',
  '#06b6d4', '#f43f5e', '#a3e635', '#fb923c',
];

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */
let transactions    = [];   // [{ id, name, amount, category, timestamp }]
let customCategories = [];  // ['Health', ...]
let spendingLimit   = 0;    // 0 = no limit set
let sortMode        = 'date-desc';
let chartInstance   = null;

/* ---------------------------------------------------------
   DOM References
   --------------------------------------------------------- */
const totalBalanceEl   = document.getElementById('total-balance');
const transactionList  = document.getElementById('transaction-list');
const emptyState       = document.getElementById('empty-state');
const form             = document.getElementById('transaction-form');
const itemNameInput    = document.getElementById('item-name');
const amountInput      = document.getElementById('amount');
const categorySelect   = document.getElementById('category');
const nameError        = document.getElementById('name-error');
const amountError      = document.getElementById('amount-error');
const categoryError    = document.getElementById('category-error');
const sortSelect       = document.getElementById('sort-select');
const themeToggleBtn   = document.getElementById('theme-toggle');
const themeIcon        = document.getElementById('theme-icon');
const spendingLimitInput = document.getElementById('spending-limit');
const setLimitBtn      = document.getElementById('set-limit-btn');
const limitStatus      = document.getElementById('limit-status');
const newCategoryInput = document.getElementById('new-category');
const addCategoryBtn   = document.getElementById('add-category-btn');
const chartCanvas      = document.getElementById('spending-chart');
const chartEmpty       = document.getElementById('chart-empty');

/* ---------------------------------------------------------
   Initialisation
   --------------------------------------------------------- */
function init() {
  loadFromStorage();
  applyTheme(loadTheme());
  renderCategoryOptions();
  renderTransactions();
  renderChart();
  updateBalance();
  attachEventListeners();
}

/* ---------------------------------------------------------
   Local Storage Helpers
   --------------------------------------------------------- */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
}

function saveCustomCategories() {
  localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
}

function saveLimit() {
  localStorage.setItem(STORAGE_KEY_LIMIT, String(spendingLimit));
}

function loadFromStorage() {
  // Transactions
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }

  // Custom categories
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    customCategories = raw ? JSON.parse(raw) : [];
  } catch {
    customCategories = [];
  }

  // Spending limit
  const rawLimit = localStorage.getItem(STORAGE_KEY_LIMIT);
  spendingLimit = rawLimit ? parseFloat(rawLimit) : 0;
  if (spendingLimit > 0) {
    spendingLimitInput.value = spendingLimit;
    limitStatus.textContent = `Limit set: $${formatAmount(spendingLimit)}`;
  }
}

function loadTheme() {
  return localStorage.getItem(STORAGE_KEY_THEME) || 'light';
}

function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

/* ---------------------------------------------------------
   Theme Toggle
   --------------------------------------------------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  // Update chart colours if chart exists
  if (chartInstance) {
    updateChartTheme();
    chartInstance.update();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
}

/* ---------------------------------------------------------
   Category Helpers
   --------------------------------------------------------- */
function getCategoryColor(category) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const idx = customCategories.indexOf(category);
  return EXTRA_COLORS[idx % EXTRA_COLORS.length] || '#8b5cf6';
}

function getCategoryClass(category) {
  const map = { Food: 'cat-food', Transport: 'cat-transport', Fun: 'cat-fun' };
  return map[category] || 'cat-default';
}

function renderCategoryOptions() {
  // Remove any previously added custom options (keep the 3 fixed ones + placeholder)
  const fixed = ['', 'Food', 'Transport', 'Fun'];
  // Clear all then re-add fixed + custom
  categorySelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Select Category --';
  categorySelect.appendChild(placeholder);

  ['Food', 'Transport', 'Fun'].forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  customCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

function addCustomCategory() {
  const name = newCategoryInput.value.trim();
  if (!name) return;

  const allCategories = ['Food', 'Transport', 'Fun', ...customCategories];
  if (allCategories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
    newCategoryInput.style.borderColor = 'var(--danger)';
    setTimeout(() => { newCategoryInput.style.borderColor = ''; }, 1500);
    return;
  }

  customCategories.push(name);
  saveCustomCategories();
  renderCategoryOptions();
  newCategoryInput.value = '';
  // Brief visual feedback
  newCategoryInput.placeholder = `"${name}" added!`;
  setTimeout(() => { newCategoryInput.placeholder = 'e.g. Health'; }, 2000);
}

/* ---------------------------------------------------------
   Form Validation
   --------------------------------------------------------- */
function clearErrors() {
  nameError.textContent    = '';
  amountError.textContent  = '';
  categoryError.textContent = '';
  itemNameInput.classList.remove('error');
  amountInput.classList.remove('error');
  categorySelect.classList.remove('error');
}

function validateForm() {
  clearErrors();
  let valid = true;

  const name     = itemNameInput.value.trim();
  const amount   = amountInput.value.trim();
  const category = categorySelect.value;

  if (!name) {
    nameError.textContent = 'Item name is required.';
    itemNameInput.classList.add('error');
    valid = false;
  }

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    amountError.textContent = 'Please enter a valid amount greater than 0.';
    amountInput.classList.add('error');
    valid = false;
  }

  if (!category) {
    categoryError.textContent = 'Please select a category.';
    categorySelect.classList.add('error');
    valid = false;
  }

  return valid;
}

/* ---------------------------------------------------------
   Add Transaction
   --------------------------------------------------------- */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const transaction = {
    id:        crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    name:      itemNameInput.value.trim(),
    amount:    parseFloat(parseFloat(amountInput.value).toFixed(2)),
    category:  categorySelect.value,
    timestamp: Date.now(),
  };

  transactions.unshift(transaction);
  saveTransactions();

  // Reset form
  form.reset();
  clearErrors();

  renderTransactions();
  renderChart();
  updateBalance();
}

/* ---------------------------------------------------------
   Delete Transaction
   --------------------------------------------------------- */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderTransactions();
  renderChart();
  updateBalance();
}

/* ---------------------------------------------------------
   Spending Limit
   --------------------------------------------------------- */
function handleSetLimit() {
  const val = parseFloat(spendingLimitInput.value);
  if (isNaN(val) || val < 0) {
    limitStatus.textContent  = 'Please enter a valid positive number.';
    limitStatus.style.color  = 'var(--danger)';
    return;
  }
  spendingLimit = val;
  saveLimit();
  if (val === 0) {
    limitStatus.textContent = 'Limit cleared.';
  } else {
    limitStatus.textContent = `Limit set: $${formatAmount(val)}`;
  }
  limitStatus.style.color = 'var(--success)';
  // Re-render to update highlights
  renderTransactions();
}

/* ---------------------------------------------------------
   Sort
   --------------------------------------------------------- */
function getSortedTransactions() {
  const copy = [...transactions];
  switch (sortMode) {
    case 'date-desc':
      return copy.sort((a, b) => b.timestamp - a.timestamp);
    case 'date-asc':
      return copy.sort((a, b) => a.timestamp - b.timestamp);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'category-asc':
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    case 'category-desc':
      return copy.sort((a, b) => b.category.localeCompare(a.category));
    default:
      return copy;
  }
}

/* ---------------------------------------------------------
   Render Transaction List
   --------------------------------------------------------- */
function renderTransactions() {
  // Clear existing items (keep empty-state node)
  transactionList.innerHTML = '';

  const sorted = getSortedTransactions();

  if (sorted.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.id = 'empty-state';
    li.textContent = 'No transactions yet. Add one above!';
    transactionList.appendChild(li);
    return;
  }

  sorted.forEach(tx => {
    const isOverLimit = spendingLimit > 0 && tx.amount > spendingLimit;

    const li = document.createElement('li');
    li.className = 'transaction-item' + (isOverLimit ? ' over-limit' : '');
    li.dataset.id = tx.id;

    li.innerHTML = `
      <div class="tx-info">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-amount">$${formatAmount(tx.amount)}</div>
        <span class="tx-category ${getCategoryClass(tx.category)}"
              style="background-color:${getCategoryColor(tx.category)}">
          ${escapeHtml(tx.category)}
        </span>
      </div>
      <button
        class="btn btn-danger"
        aria-label="Delete ${escapeHtml(tx.name)}"
        data-id="${tx.id}"
      >Delete</button>
    `;

    transactionList.appendChild(li);
  });
}

/* ---------------------------------------------------------
   Update Total Balance
   --------------------------------------------------------- */
function updateBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalBalanceEl.textContent = `$${formatAmount(total)}`;
}

/* ---------------------------------------------------------
   Chart
   --------------------------------------------------------- */
function buildChartData() {
  const totals = {};
  transactions.forEach(tx => {
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map(getCategoryColor);

  return { labels, data, colors };
}

function getChartThemeOptions() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    legendColor: isDark ? '#9ba3b8' : '#6b7280',
  };
}

function updateChartTheme() {
  if (!chartInstance) return;
  const opts = getChartThemeOptions();
  chartInstance.options.plugins.legend.labels.color = opts.legendColor;
}

function renderChart() {
  const { labels, data, colors } = buildChartData();
  const hasData = data.length > 0;

  chartEmpty.style.display = hasData ? 'none' : 'block';

  const themeOpts = getChartThemeOptions();

  if (chartInstance) {
    chartInstance.data.labels         = labels;
    chartInstance.data.datasets[0].data   = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    updateChartTheme();
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(chartCanvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 2,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 400 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: themeOpts.legendColor,
            padding: 14,
            font: { size: 12, family: "'Segoe UI', system-ui, sans-serif" },
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: $${formatAmount(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/* ---------------------------------------------------------
   Utilities
   --------------------------------------------------------- */
function formatAmount(num) {
  return Number(num).toFixed(2);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ---------------------------------------------------------
   Event Listeners
   --------------------------------------------------------- */
function attachEventListeners() {
  // Add transaction
  form.addEventListener('submit', handleFormSubmit);

  // Delete transaction (event delegation on the list)
  transactionList.addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (btn && btn.classList.contains('btn-danger')) {
      deleteTransaction(btn.dataset.id);
    }
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    sortMode = sortSelect.value;
    renderTransactions();
  });

  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Spending limit
  setLimitBtn.addEventListener('click', handleSetLimit);
  spendingLimitInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSetLimit();
  });

  // Custom category
  addCategoryBtn.addEventListener('click', addCustomCategory);
  newCategoryInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomCategory();
    }
  });

  // Clear error styles on input
  itemNameInput.addEventListener('input',   () => { nameError.textContent = '';     itemNameInput.classList.remove('error'); });
  amountInput.addEventListener('input',     () => { amountError.textContent = '';   amountInput.classList.remove('error'); });
  categorySelect.addEventListener('change', () => { categoryError.textContent = ''; categorySelect.classList.remove('error'); });
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
init();
