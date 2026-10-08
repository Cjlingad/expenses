const SAVINGS_KEYS = {
  entries: "dailyExpenseSavingsEntries",
  goal: "dailyExpenseSavingsGoal"
};

const savingsTotal = document.getElementById("savingsTotal");
const savingsGoalInput = document.getElementById("savingsGoalInput");
const savingsAddInput = document.getElementById("savingsAddInput");
const savingsGoalForm = document.getElementById("savingsGoalForm");
const savingsAddForm = document.getElementById("savingsAddForm");
const savingsMessage = document.getElementById("savingsMessage");
const savingsHistory = document.getElementById("savingsHistory");
const savingsEmptyState = document.getElementById("savingsEmptyState");
const savingsProgress = document.getElementById("savingsProgress");
const savingsProgressBar = document.getElementById("savingsProgressBar");
const savingsProgressLabel = document.getElementById("savingsProgressLabel");
const savingsProgressPercent = document.getElementById("savingsProgressPercent");
const savingsGoalCaption = document.getElementById("savingsGoalCaption");
const savingsEntryCount = document.getElementById("savingsEntryCount");
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

let entries = JSON.parse(localStorage.getItem(SAVINGS_KEYS.entries) || "[]");
let goal = Number(localStorage.getItem(SAVINGS_KEYS.goal)) || 0;
savingsGoalInput.value = goal || "";

savingsGoalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  goal = Number(savingsGoalInput.value);
  if (!Number.isFinite(goal) || goal <= 0) return;
  localStorage.setItem(SAVINGS_KEYS.goal, String(goal));
  renderSavings();
  showSavingsMessage("Savings goal saved.");
});

savingsAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(savingsAddInput.value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  entries.push({
    id: `manual-${Date.now()}`,
    amount,
    date: getLocalDateKey(),
    source: "manual"
  });
  saveSavings();
  savingsAddForm.reset();
  renderSavings();
  showSavingsMessage(`${formatMoney(amount)} added to your savings.`);
});

function renderSavings() {
  entries = JSON.parse(localStorage.getItem(SAVINGS_KEYS.entries) || "[]");
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const progress = goal > 0 ? Math.min(100, (total / goal) * 100) : 0;
  const remaining = Math.max(0, goal - total);

  savingsTotal.textContent = formatMoney(total);
  savingsProgressPercent.textContent = `${Math.floor(progress)}%`;
  savingsProgressBar.style.width = `${progress}%`;
  savingsProgress.setAttribute("aria-valuenow", String(Math.floor(progress)));
  savingsProgressLabel.textContent = goal > 0
    ? `${formatMoney(total)} saved of ${formatMoney(goal)}`
    : "Set a goal to track your progress";
  savingsGoalCaption.textContent = goal > 0
    ? remaining > 0
      ? `${formatMoney(remaining)} to go. Keep building your savings.`
      : "You reached your savings goal. Great job!"
    : "5% of each saved daily budget goes here automatically.";

  const displayedEntries = [...entries].sort((first, second) =>
    second.date.localeCompare(first.date) || String(second.id).localeCompare(String(first.id))
  );
  savingsEntryCount.textContent = `${entries.length} deposit${entries.length === 1 ? "" : "s"}`;
  savingsEmptyState.hidden = entries.length > 0;
  savingsHistory.querySelectorAll(".savings-entry").forEach((entry) => entry.remove());
  savingsHistory.insertAdjacentHTML("afterbegin", displayedEntries.map((entry) => {
    const source = entry.source === "budget" ? "5% budget savings" : "Manual deposit";
    return `<article class="savings-entry"><div><strong>${source}</strong><span>${formatSavingsDate(entry.date)}</span></div><strong class="savings-entry-amount">+${formatMoney(Number(entry.amount))}</strong></article>`;
  }).join(""));
}

function saveSavings() {
  localStorage.setItem(SAVINGS_KEYS.entries, JSON.stringify(entries));
}

function showSavingsMessage(message) {
  savingsMessage.textContent = message;
  savingsMessage.hidden = false;
}

function formatMoney(amount) {
  return peso.format(amount).replace("PHP", "₱").replace(/\s/g, "");
}

function formatSavingsDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getLocalDateKey(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

renderSavings();
