const STORAGE_KEY = "smartTrackTransactions";

const form = document.getElementById("transaction-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const transactionList = document.getElementById("transaction-list");
const emptyMessage = document.getElementById("empty-message");
const searchInput = document.getElementById("search");
const filterType = document.getElementById("filter-type");
const filterCategory = document.getElementById("filter-category");
const toast = document.getElementById("toast");

let transactions = loadTransactions();
let toastTimeout;

const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});

function money(value) {
    return currency.format(value);
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function loadTransactions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(item =>
            item &&
            typeof item.id === "string" &&
            typeof item.description === "string" &&
            Number.isFinite(item.amount) &&
            item.amount > 0 &&
            ["income", "expense"].includes(item.type) &&
            typeof item.category === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        );
    } catch (error) {
        console.error("Could not load saved transactions:", error);
        return [];
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        console.error("Could not save transactions:", error);
        showToast("Could not save data. Check browser storage.");
        return false;
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

function formatDate(dateString) {
    const parts = dateString.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function updateSummary() {
    const income = transactions
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expenses = transactions
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    document.getElementById("balance").textContent =
        money(income - expenses);

    document.getElementById("income").textContent = money(income);
    document.getElementById("expenses").textContent = money(expenses);
    document.getElementById("chart-total").textContent = money(expenses);
}

function renderChart() {
    const chart = document.getElementById("category-chart");

    const totals = {};

    transactions
        .filter(item => item.type === "expense")
        .forEach(item => {
            totals[item.category] =
                (totals[item.category] || 0) + item.amount;
        });

    const categories = Object.entries(totals)
        .sort((a, b) => b[1] - a[1]);

    chart.replaceChildren();

    if (categories.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-chart";
        empty.textContent = "Add an expense to see your chart.";
        chart.appendChild(empty);
        return;
    }

    const maxAmount = categories[0][1];

    categories.forEach(([category, total]) => {
        const row = document.createElement("div");
        row.className = "chart-row";

        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = category;

        const track = document.createElement("div");
        track.className = "bar-track";

        const bar = document.createElement("div");
        bar.className = "bar-fill";
        bar.style.width = `${(total / maxAmount) * 100}%`;
        bar.title = `${category}: ${money(total)}`;

        track.appendChild(bar);

        const value = document.createElement("span");
        value.className = "chart-value";
        value.textContent = money(total);

        row.append(label, track, value);
        chart.appendChild(row);
    });
}

function createCell(className, text) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
}

function renderTransactions() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedType = filterType.value;
    const selectedCategory = filterCategory.value;

    const filtered = transactions
        .filter(item => {
            const matchesSearch =
                item.description.toLowerCase().includes(searchTerm) ||
                item.category.toLowerCase().includes(searchTerm);

            const matchesType =
                selectedType === "all" || item.type === selectedType;

            const matchesCategory =
                selectedCategory === "all" ||
                item.category === selectedCategory;

            return matchesSearch && matchesType && matchesCategory;
        })
        .sort((a, b) =>
            b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
        );

    transactionList.replaceChildren();

    filtered.forEach(item => {
        const row = document.createElement("tr");

        row.appendChild(createCell("description-cell", item.description));
        const categoryCell = createCell("", "");
        const categoryPill = document.createElement("span");
        categoryPill.className = "category-pill";
        categoryPill.textContent = item.category;
        categoryCell.appendChild(categoryPill);
        row.appendChild(categoryCell);

        row.appendChild(createCell("", formatDate(item.date)));

        const typeCell = createCell("", "");
        const typePill = document.createElement("span");
        typePill.className = `type-pill ${item.type}`;
        typePill.textContent =
            item.type === "income" ? "↗ Income" : "↘ Expense";
        typeCell.appendChild(typePill);
        row.appendChild(typeCell);

        row.appendChild(createCell(
            `amount-cell ${item.type}`,
            `${item.type === "income" ? "+" : "−"}${money(item.amount)}`
        ));

        const actionCell = createCell("", "");
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute(
            "aria-label",
            `Delete transaction ${item.description}`
        );
        deleteButton.addEventListener("click", () => {
            deleteTransaction(item.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        transactionList.appendChild(row);
    });

    emptyMessage.style.display = filtered.length === 0 ? "block" : "none";

    if (filtered.length === 0) {
        emptyMessage.textContent = transactions.length === 0
            ? "No transactions yet. Add your first transaction above!"
            : "No matching transactions. Try changing your search or filters.";
    }

    document.getElementById("transaction-count").textContent =
        `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;
}

function renderApp() {
    updateSummary();
    renderChart();
    renderTransactions();
}

form.addEventListener("submit", event => {
    event.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const type = typeInput.value;
    const category = categoryInput.value;
    const date = dateInput.value;

    if (!description) {
        showToast("Please enter a description.");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
        showToast("Please enter a valid amount.");
        return;
    }

    if (!["income", "expense"].includes(type)) {
        showToast("Please select a valid transaction type.");
        return;
    }

    if (!date || date > localDateString()) {
        showToast("Please select a valid date (not in the future).");
        return;
    }

    const transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        description,
        amount,
        type,
        category,
        date
    };

    transactions.push(transaction);

    if (!saveTransactions()) {
        transactions.pop();
        return;
    }

    form.reset();
    dateInput.value = localDateString();
    typeInput.value = "expense";

    renderApp();
    showToast("Transaction added successfully!");
});

function deleteTransaction(id) {
    const previous = transactions;
    transactions = transactions.filter(item => item.id !== id);

    if (!saveTransactions()) {
        transactions = previous;
        return;
    }

    renderApp();
    showToast("Transaction deleted.");
}

searchInput.addEventListener("input", renderTransactions);
filterType.addEventListener("change", renderTransactions);
filterCategory.addEventListener("change", renderTransactions);

document.getElementById("export-button").addEventListener("click", () => {
    if (transactions.length === 0) {
        showToast("Add a transaction before exporting.");
        return;
    }

    const headers = [
        "Description", "Amount", "Type", "Category", "Date"
    ];

    const escapeCSV = value =>
        `"${String(value).replace(/"/g, '""')}"`;

    const rows = transactions.map(item => [
        item.description,
        item.amount.toFixed(2),
        item.type,
        item.category,
        item.date
    ]);

    const csv = "\uFEFF" + [headers, ...rows]
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `smart-track-${localDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    showToast("CSV file exported successfully!");
});

document.getElementById("today-date").textContent =
    new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

dateInput.max = localDateString();
dateInput.value = localDateString();

renderApp();