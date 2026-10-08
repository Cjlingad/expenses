// The app keeps its small data set in localStorage so it survives refreshes.
const STORAGE_KEYS = {
  budget: "dailyExpenseBudget",
  expenses: "dailyExpenses",
  savingsEntries: "dailyExpenseSavingsEntries",
  notificationMilestones: "dailyExpenseNotificationMilestones",
  dailyReminder: "dailyExpenseDailyReminder",
  dailyReminderTime: "dailyExpenseDailyReminderTime",
  weeklySummary: "dailyExpenseWeeklySummary",
  weeklySummaryTime: "dailyExpenseWeeklySummaryTime",
  lastDailyReminder: "dailyExpenseLastReminderDate",
  lastWeeklySummary: "dailyExpenseLastWeeklySummary"
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
const dailyReminder = document.getElementById("dailyReminder");
const dailyReminderTime = document.getElementById("dailyReminderTime");
const weeklySummary = document.getElementById("weeklySummary");
const weeklySummaryTime = document.getElementById("weeklySummaryTime");
const installButton = document.getElementById("installButton");
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
let deferredInstallPrompt;

dailyReminder.checked = localStorage.getItem(STORAGE_KEYS.dailyReminder) === "true";
dailyReminderTime.value = localStorage.getItem(STORAGE_KEYS.dailyReminderTime) || "20:00";
weeklySummary.checked = localStorage.getItem(STORAGE_KEYS.weeklySummary) === "true";
weeklySummaryTime.value = localStorage.getItem(STORAGE_KEYS.weeklySummaryTime) || "19:00";

function showMessage(message) {
  appMessage.textContent = message;
  appMessage.hidden = false;
}

// Use today's date as the default for new expenses.
const today = new Date();
const todayString = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
expenseDate.value = todayString;
document.getElementById("todayDate").textContent = today.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

budgetInput.value = budget || "";
budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  budget = Math.max(0, Number(budgetInput.value) || 0);
  localStorage.setItem(STORAGE_KEYS.budget, String(budget));
  const todayKey = getLocalDateKey();
  const savingsContribution = Math.round(budget * 5) / 100;
  addBudgetSavingsContribution(todayKey, savingsContribution);
  render();
  showMessage(`Daily budget saved. ${formatMoney(savingsContribution)} added to savings.`);
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
  const currentDateKey = getLocalDateKey();
  const todayTotalBefore = getExpenseTotalForDate(currentDateKey);
  expenses.unshift(newExpense);
  saveExpenses();
  expenseForm.reset();
  expenseDate.value = getLocalDateKey();
  render();
  if (newExpense.date === currentDateKey) {
    notifyBudgetMilestones(todayTotalBefore, todayTotalBefore + newExpense.amount);
  }
  showMessage("Expense added.");
});

for (const input of [dailyReminder, dailyReminderTime, weeklySummary, weeklySummaryTime]) {
  input.addEventListener("change", saveNotificationSettings);
}

notificationButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showMessage("Notifications aren’t supported by this browser, but your tracker still works offline.");
    return;
  }

  if (Notification.permission === "granted") {
    checkScheduledNotifications();
    showMessage("Notifications are enabled for budget alerts and any scheduled reminders you turn on.");
    return;
  }

  if (Notification.permission === "denied") {
    showMessage("Alerts are blocked in your browser settings. Allow notifications for this site to turn them on.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    updateNotificationButton();
    if (permission === "granted") checkScheduledNotifications();
    showMessage(permission === "granted"
      ? "Notifications are enabled for budget alerts and any scheduled reminders you turn on."
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
window.addEventListener("focus", checkScheduledNotifications);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkScheduledNotifications();
});
window.setInterval(checkScheduledNotifications, 60_000);

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
    notificationButton.setAttribute("aria-label", "Notifications unavailable");
    notificationButton.title = "Notifications unavailable";
    notificationButton.classList.remove("notifications-enabled");
    return;
  }
  const enabled = Notification.permission === "granted";
  const label = enabled ? "Notifications enabled" : "Enable notifications";
  notificationButton.setAttribute("aria-label", label);
  notificationButton.title = label;
  notificationButton.classList.toggle("notifications-enabled", enabled);
}

function saveNotificationSettings() {
  localStorage.setItem(STORAGE_KEYS.dailyReminder, String(dailyReminder.checked));
  localStorage.setItem(STORAGE_KEYS.dailyReminderTime, dailyReminderTime.value);
  localStorage.setItem(STORAGE_KEYS.weeklySummary, String(weeklySummary.checked));
  localStorage.setItem(STORAGE_KEYS.weeklySummaryTime, weeklySummaryTime.value);
  checkScheduledNotifications();

  if (dailyReminder.checked || weeklySummary.checked) {
    if (!("Notification" in window)) {
      showMessage("Reminder preferences saved, but this browser does not support notifications.");
    } else if (Notification.permission !== "granted") {
      showMessage("Reminder preferences saved. Enable browser notifications above to receive alerts while the app is open.");
    } else {
      showMessage("Notification preferences saved.");
    }
  } else {
    showMessage("Notification preferences saved.");
  }
}

function notifyBudgetMilestones(previousTotal, currentTotal) {
  const spendingBudget = budget * 0.95;
  if (!("Notification" in window) || Notification.permission !== "granted" || spendingBudget <= 0) return;

  const dateKey = getLocalDateKey();
  const savedState = JSON.parse(localStorage.getItem(STORAGE_KEYS.notificationMilestones) || "{}");
  const state = savedState.date === dateKey
    ? savedState
    : { date: dateKey, milestones: [] };
  const milestones = new Set(state.milestones);
  const crossed80 = previousTotal < spendingBudget * 0.8 && currentTotal >= spendingBudget * 0.8;
  const crossed100 = previousTotal < spendingBudget && currentTotal >= spendingBudget;

  if (crossed80 && !milestones.has(80) && !crossed100) {
    showNotification("Budget check-in", `You’ve used 80% of today’s ${formatMoney(spendingBudget)} spending budget.`);
    milestones.add(80);
  }

  if (crossed100 && !milestones.has(100)) {
    showNotification("Daily budget reached", `You’ve spent ${formatMoney(currentTotal)} of your ${formatMoney(spendingBudget)} spending budget today.`);
    milestones.add(100);
  }

  if (crossed100) milestones.add(80);
  localStorage.setItem(STORAGE_KEYS.notificationMilestones, JSON.stringify({
    date: dateKey,
    milestones: [...milestones]
  }));
}

function showNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const notification = new Notification(title, {
    body,
    icon: "./icons/icon.png",
    badge: "./icons/icon.png"
  });
  notification.addEventListener("click", () => window.focus());
}

function checkScheduledNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const dateKey = getLocalDateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (dailyReminder.checked && dailyReminderTime.value && currentTime >= dailyReminderTime.value &&
      getExpenseTotalForDate(dateKey) === 0 &&
      localStorage.getItem(STORAGE_KEYS.lastDailyReminder) !== dateKey) {
    showNotification("Daily expense reminder", "No expenses are recorded for today yet. Add one if you have spending to log.");
    localStorage.setItem(STORAGE_KEYS.lastDailyReminder, dateKey);
  }

  const weekKey = getWeekStartDateKey(now);
  if (weeklySummary.checked && weeklySummaryTime.value && now.getDay() === 0 &&
      currentTime >= weeklySummaryTime.value &&
      localStorage.getItem(STORAGE_KEYS.lastWeeklySummary) !== weekKey) {
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const weekStartKey = getLocalDateKey(weekStart);
    const weekExpenses = expenses.filter((expense) => expense.date >= weekStartKey && expense.date <= dateKey);
    const weekTotal = weekExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    showNotification("Your weekly spending summary", `${weekExpenses.length} expenses this week, totaling ${formatMoney(weekTotal)}.`);
    localStorage.setItem(STORAGE_KEYS.lastWeeklySummary, weekKey);
  }
}

function getExpenseTotalForDate(dateKey) {
  return expenses
    .filter((expense) => expense.date === dateKey)
    .reduce((sum, expense) => sum + expense.amount, 0);
}

function getLocalDateKey(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

function getWeekStartDateKey(date) {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return getLocalDateKey(sunday);
}

function addBudgetSavingsContribution(date, amount) {
  const entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.savingsEntries) || "[]")
    .filter((entry) => !(entry.source === "budget" && entry.date === date));
  if (amount > 0) {
    entries.push({
      id: `budget-${date}`,
      amount,
      date,
      source: "budget"
    });
  }
  localStorage.setItem(STORAGE_KEYS.savingsEntries, JSON.stringify(entries));
}

function getSpendingBudget() {
  return budget * 0.95;
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
  checkScheduledNotifications();
}

function render() {
  const todayKey = getLocalDateKey();
  const todaysExpenses = expenses.filter((expense) => expense.date === todayKey);
  const total = todaysExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const spendingBudget = getSpendingBudget();
  const remaining = spendingBudget - total;
  document.getElementById("budgetDisplay").textContent = formatMoney(spendingBudget);
  document.getElementById("totalDisplay").textContent = formatMoney(total);
  document.getElementById("remainingDisplay").textContent = formatMoney(remaining);
  document.getElementById("remainingDisplay").classList.toggle("over-budget", remaining < 0);
  document.getElementById("countDisplay").textContent = todaysExpenses.length;
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
    const categoryTotal = todaysExpenses
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
