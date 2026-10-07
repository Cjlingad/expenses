// The app keeps its small data set in localStorage so it survives refreshes.
const STORAGE_KEYS = {
  budget: "dailyExpenseBudget",
  expenses: "dailyExpenses"
};

const categories = ["Food", "Transportation", "School", "Entertainment", "Other"];
let budget = Number(localStorage.getItem(STORAGE_KEYS.budget)) || 0;
let expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || "[]");

const budgetForm = document.getElementById("budgetForm");
const budgetInput = document.getElementById("budgetInput");
const expenseForm = document.getElementById("expenseForm");
const expenseDate = document.getElementById("expenseDate");
const tableBody = document.getElementById("expenseTableBody");
const emptyState = document.getElementById("emptyState");
const appMessage = document.getElementById("appMessage");
const notificationButton = document.getElementById("notificationButton");
const installButton = document.getElementById("installButton");
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
let deferredInstallPrompt;

function showMessage(message) {
  appMessage.textContent = message;
  appMessage.hidden = false;
}

// Use today's date as the default for new expenses.
const today = new Date();
const todayString = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
expenseDate.value = todayString;
document.getElementById("todayLabel").textContent = today.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

budgetInput.value = budget || "";
budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  budget = Math.max(0, Number(budgetInput.value) || 0);
  localStorage.setItem(STORAGE_KEYS.budget, String(budget));
  render();
  showMessage("Daily budget saved.");
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const newExpense = {
    id: Date.now(),
    name: document.getElementById("expenseName").value.trim(),
    amount: Number(document.getElementById("expenseAmount").value),
    category: document.getElementById("expenseCategory").value,
    date: expenseDate.value
  };

  if (!newExpense.name || newExpense.amount <= 0 || !newExpense.category || !newExpense.date) return;
  const previousTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  expenses.unshift(newExpense);
  saveExpenses();
  expenseForm.reset();
  expenseDate.value = todayString;
  render();
  notifyBudgetMilestone(previousTotal, previousTotal + newExpense.amount);
  showMessage("Expense added.");
});

notificationButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showMessage("Notifications aren’t supported by this browser, but your tracker still works offline.");
    return;
  }

  if (Notification.permission === "granted") {
    showMessage("Notifications are enabled. You’ll be notified as you approach your budget.");
    return;
  }

  if (Notification.permission === "denied") {
    showMessage("Alerts are blocked in your browser settings. Allow notifications for this site to turn them on.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    updateNotificationButton();
    showMessage(permission === "granted"
      ? "Notifications are enabled. You’ll be notified as you approach your budget."
      : "Notifications remain off. You can enable them in your browser settings.");
  } catch (error) {
    console.error("Could not request notification permission.", error);
    showMessage("Your browser couldn’t enable alerts. Please check its notification settings and try again.");
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

installButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    showMessage(outcome === "accepted"
      ? "Daily Expenses Tracker is ready to install."
      : "Installation was cancelled. You can install the app at any time.");
    deferredInstallPrompt = null;
    return;
  }

  const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
  showMessage(isAppleMobile
    ? "To install, tap Share in Safari, then choose “Add to Home Screen”."
    : "To install, open your browser menu and choose “Install app” or “Add to Home Screen”.");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showMessage("Daily Expenses Tracker has been installed.");
});

window.addEventListener("online", () => showMessage("You are online. Your saved expenses are available."));
window.addEventListener("offline", () => showMessage("You are offline. The tracker remains available on this device."));

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(() => showMessage("Offline access is ready."))
      .catch((error) => {
        console.error("Could not register the offline app service worker.", error);
        showMessage("Offline setup could not start. Open the tracker over HTTPS or localhost and try again.");
      });
  });
} else {
  showMessage("Offline mode needs a secure connection (HTTPS or localhost).");
}

function updateNotificationButton() {
  if (!("Notification" in window)) {
    notificationButton.textContent = "Notifications unavailable";
    return;
  }
  notificationButton.textContent = Notification.permission === "granted"
    ? "Notifications enabled"
    : "Enable notifications";
}

function notifyBudgetMilestone(previousTotal, currentTotal) {
  if (!("Notification" in window) || Notification.permission !== "granted" || budget <= 0) return;

  const warningLimit = budget * 0.8;
  if (previousTotal < warningLimit && currentTotal >= warningLimit) {
    const overBudget = currentTotal >= budget;
    const notification = new Notification(overBudget ? "Daily budget reached" : "A little budget check-in", {
      body: overBudget
        ? `You’ve spent ${formatMoney(currentTotal)} of your ${formatMoney(budget)} budget today.`
        : `You’ve used 80% of today’s ${formatMoney(budget)} budget. Keep an eye on your remaining balance.`,
      icon: "./icons/icon.png",
      badge: "./icons/icon.png"
    });
    notification.addEventListener("click", () => window.focus());
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
}

function formatMoney(amount) {
  return peso.format(amount).replace("PHP", "₱").replace(/\s/g, "");
}

function formatDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function deleteExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  render();
  updateNotificationButton();
}

function render() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = budget - total;
  document.getElementById("budgetDisplay").textContent = formatMoney(budget);
  document.getElementById("totalDisplay").textContent = formatMoney(total);
  document.getElementById("remainingDisplay").textContent = formatMoney(remaining);
  document.getElementById("remainingDisplay").classList.toggle("over-budget", remaining < 0);
  document.getElementById("countDisplay").textContent = expenses.length;
  document.getElementById("historyCount").textContent = `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`;

  tableBody.innerHTML = expenses.map((expense) => `
    <tr>
      <td>${escapeHtml(expense.name)}</td>
      <td><span class="category-tag">${escapeHtml(expense.category)}</span></td>
      <td class="amount">${formatMoney(expense.amount)}</td>
      <td>${formatDate(expense.date)}</td>
      <td><button class="delete-button" type="button" data-id="${expense.id}" aria-label="Delete ${escapeHtml(expense.name)}">Delete</button></td>
    </tr>
  `).join("");
  emptyState.hidden = expenses.length > 0;

  document.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", () => deleteExpense(Number(button.dataset.id)));
  });

  const categoryList = document.getElementById("categoryList");
  categoryList.innerHTML = categories.map((category) => {
    const categoryTotal = expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const percentage = total ? Math.min(100, (categoryTotal / total) * 100) : 0;
    return `<div class="category-row"><div class="category-line"><span>${category}</span><span>${formatMoney(categoryTotal)}</span></div><div class="progress-track"><div class="progress-bar" style="width: ${percentage}%"></div></div></div>`;
  }).join("");
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

render();
