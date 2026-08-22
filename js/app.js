/*
 * app.js — logique d'interface : navigation entre onglets, formulaire
 * de saisie d'une séance, et historique. Le bilan arrive à l'étape
 * suivante.
 */

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;

    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanels.forEach((panel) =>
      panel.classList.toggle("active", panel.id === target)
    );

    if (target === "history") renderHistory();
    if (target === "dashboard") renderDashboard();
  });
});

/* --- Formulaire de saisie --- */

const disciplinePicker = document.getElementById("discipline-picker");
const distanceField = document.getElementById("distance-field");
const sessionForm = document.getElementById("session-form");
const dateInput = document.getElementById("session-date");
const durationInput = document.getElementById("session-duration");
const distanceInput = document.getElementById("session-distance");
const notesInput = document.getElementById("session-notes");
const sessionFormTitleText = document.getElementById("session-form-title-text");
const sessionSubmitBtn = document.getElementById("session-submit-btn");
const newSessionSection = document.getElementById("new-session");
const sessionFormWrapper = document.getElementById("session-form-wrapper");
const editModalOverlay = document.getElementById("edit-modal-overlay");
const modalFormSlot = document.getElementById("modal-form-slot");
const modalCloseBtn = document.getElementById("modal-close-btn");

let selectedDiscipline = null;
let editingSessionId = null;

function openEditModal() {
  modalFormSlot.appendChild(sessionFormWrapper);
  editModalOverlay.hidden = false;
}

function closeEditModal() {
  newSessionSection.appendChild(sessionFormWrapper);
  editModalOverlay.hidden = true;
}

modalCloseBtn.addEventListener("click", () => {
  resetFormFields();
  exitEditMode();
  closeEditModal();
});

editModalOverlay.addEventListener("click", (event) => {
  if (event.target === editModalOverlay) {
    resetFormFields();
    exitEditMode();
    closeEditModal();
  }
});

function renderDisciplinePicker() {
  DISCIPLINES.forEach((discipline) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "discipline-btn";
    btn.dataset.id = discipline.id;
    btn.style.setProperty("--discipline-color", discipline.color);
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${discipline.icon}</svg>
      <span>${discipline.label}</span>
    `;
    btn.addEventListener("click", () => selectDiscipline(discipline));
    disciplinePicker.appendChild(btn);
  });
}

function selectDiscipline(discipline) {
  selectedDiscipline = discipline;
  document.querySelectorAll(".discipline-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.id === discipline.id);
  });
  distanceField.hidden = !discipline.hasDistance;
}

function parseDurationToMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseISODate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function decomposeDistance(km) {
  const rounded = Math.round(km * 10) / 10;
  const intPart = Math.floor(rounded);
  const decimalDigit = Math.round((rounded - intPart) * 10);
  return { intPart, decimalDigit };
}

function resetFormFields() {
  sessionForm.reset();
  setSelectedDate(new Date());
  setDuration(0, 0, true);
  clearDistance();
  distanceField.hidden = true;
  document
    .querySelectorAll(".discipline-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  selectedDiscipline = null;
}

function exitEditMode() {
  editingSessionId = null;
  sessionFormTitleText.textContent = "Nouvelle séance";
  sessionSubmitBtn.textContent = "Enregistrer la séance";
}

function editSession(session) {
  const discipline = DISCIPLINES.find((d) => d.id === session.discipline);
  selectDiscipline(discipline);
  setSelectedDate(parseISODate(session.date));
  setDuration(Math.floor(session.durationMinutes / 60), session.durationMinutes % 60, true);

  if (session.distanceKm) {
    const { intPart, decimalDigit } = decomposeDistance(session.distanceKm);
    setDistance(intPart, decimalDigit, true);
  } else {
    clearDistance();
  }

  notesInput.value = session.notes || "";

  editingSessionId = session.id;
  sessionFormTitleText.textContent = "Modifier la séance";
  sessionSubmitBtn.textContent = "Enregistrer les modifications";

  openEditModal();
}

sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!selectedDiscipline) {
    alert("Choisis une discipline avant d'enregistrer.");
    return;
  }

  const durationMinutes = parseDurationToMinutes(durationInput.value);
  if (!durationMinutes) {
    alert("Indique une durée valide.");
    return;
  }

  const sessionData = {
    discipline: selectedDiscipline.id,
    date: dateInput.value,
    durationMinutes,
    distanceKm:
      selectedDiscipline.hasDistance && distanceInput.value
        ? Number(distanceInput.value)
        : null,
    notes: notesInput.value.trim(),
  };

  const wasEditing = Boolean(editingSessionId);
  if (wasEditing) {
    Storage.updateSession(editingSessionId, sessionData);
    renderHistory();
  } else {
    Storage.addSession(sessionData);
  }

  resetFormFields();
  exitEditMode();
  if (wasEditing) closeEditModal();
});

renderDisciplinePicker();

/* --- Historique --- */

const historyList = document.getElementById("history-list");
const historyPeriodTabs = document.querySelectorAll("#history-period-tabs .period-btn");
const historyDisciplineFilter = document.getElementById("history-discipline-filter");
const historyPeriodNav = document.getElementById("history-period-nav");
const historyPeriodLabel = document.getElementById("history-period-label");

let historyPeriod = "all";
let historyDiscipline = "all";
let historyOffset = 0;

function formatDisplayDate(iso) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hoursLabel = hours.toLocaleString("fr-FR");
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hoursLabel}h`;
  return `${hoursLabel}h${String(mins).padStart(2, "0")}`;
}

function renderHistoryDisciplineChips() {
  DISCIPLINES.forEach((discipline) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "discipline-chip";
    chip.dataset.discipline = discipline.id;
    chip.style.setProperty("--discipline-color", discipline.color);
    chip.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${discipline.icon}</svg>
      <span>${discipline.label}</span>
    `;
    chip.addEventListener("click", () => {
      historyDiscipline = discipline.id;
      document
        .querySelectorAll(".discipline-chip")
        .forEach((c) => c.classList.toggle("active", c === chip));
      renderHistory();
    });
    historyDisciplineFilter.appendChild(chip);
  });
}

historyDisciplineFilter
  .querySelector('[data-discipline="all"]')
  .addEventListener("click", (event) => {
    historyDiscipline = "all";
    document
      .querySelectorAll(".discipline-chip")
      .forEach((c) => c.classList.toggle("active", c === event.currentTarget));
    renderHistory();
  });

historyPeriodTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    historyPeriod = btn.dataset.period;
    historyOffset = 0;
    historyPeriodTabs.forEach((b) => b.classList.toggle("active", b === btn));
    historyPeriodNav.hidden = historyPeriod === "all";
    renderHistory();
  });
});

document.querySelectorAll("[data-history-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    historyOffset += btn.dataset.historyNav === "next" ? 1 : -1;
    renderHistory();
  });
});

historyPeriodLabel.addEventListener("click", () => {
  if (historyOffset !== 0) {
    historyOffset = 0;
    renderHistory();
  }
});

function renderHistory() {
  let sessions = Storage.getSessions();
  const hadAnySession = sessions.length > 0;

  if (historyPeriod !== "all") {
    const range = getPeriodRange(historyPeriod, historyOffset);
    historyPeriodLabel.textContent = formatPeriodLabel(historyPeriod, range);
    const startISO = toISO(range.start);
    const endISO = toISO(range.end);
    sessions = sessions.filter((s) => s.date >= startISO && s.date <= endISO);
  }

  if (historyDiscipline !== "all") {
    sessions = sessions.filter((s) => s.discipline === historyDiscipline);
  }

  sessions = sessions.sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) {
    historyList.innerHTML = hadAnySession
      ? `<p class="placeholder">Aucune séance ne correspond à ce filtre.</p>`
      : `<p class="placeholder">Aucune séance enregistrée pour l'instant.<br>Direction l'onglet "Séance" pour ajouter la première !</p>`;
    return;
  }

  historyList.innerHTML = "";

  sessions.forEach((session) => {
    const discipline = DISCIPLINES.find((d) => d.id === session.discipline);

    const item = document.createElement("div");
    item.className = "card session-item";
    item.style.setProperty("--discipline-color", discipline.color);

    const metaParts = [formatDuration(session.durationMinutes)];
    if (session.distanceKm) metaParts.push(formatDistance(session.distanceKm));

    item.innerHTML = `
      <div class="session-icon-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${discipline.icon}</svg>
      </div>
      <div class="session-info">
        <div class="session-discipline">${discipline.label}</div>
        <div class="session-meta">${metaParts.join(" · ")}</div>
        ${session.notes ? `<div class="session-note">${session.notes}</div>` : ""}
      </div>
      <div class="session-date">${formatDisplayDate(session.date)}</div>
      <div class="session-actions">
        <button type="button" class="session-action-btn" data-action="edit" aria-label="Modifier la séance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button type="button" class="session-action-btn session-delete" data-action="delete" aria-label="Supprimer la séance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>
        </button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener("click", () => editSession(session));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (confirm("Supprimer cette séance ?")) {
        Storage.deleteSession(session.id);
        renderHistory();
      }
    });

    historyList.appendChild(item);
  });
}

renderHistoryDisciplineChips();

/* --- Bilan --- */

const summaryCard = document.getElementById("summary-card");
const disciplineStats = document.getElementById("discipline-stats");
const periodButtons = document.querySelectorAll("#dashboard-period-tabs .period-btn");
const dashboardPeriodLabel = document.getElementById("dashboard-period-label");
const dashboardPeriodNav = document.getElementById("dashboard-period-nav");

let currentPeriod = "week";
let dashboardOffset = 0;

function getPeriodRange(period, offset = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "week") {
    const offsetFromMonday = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - offsetFromMonday + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  if (period === "month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth() + offset, 1),
      end: new Date(today.getFullYear(), today.getMonth() + offset + 1, 0),
    };
  }

  return {
    start: new Date(today.getFullYear() + offset, 0, 1),
    end: new Date(today.getFullYear() + offset, 11, 31),
  };
}

function formatPeriodLabel(period, range) {
  if (period === "week") {
    const startLabel = `${range.start.getDate()} ${MONTHS_FR[range.start.getMonth()]}`;
    const endLabel = `${range.end.getDate()} ${MONTHS_FR[range.end.getMonth()]} ${range.end.getFullYear()}`;
    return `${startLabel} – ${endLabel}`;
  }

  if (period === "month") {
    return `${MONTHS_FR[range.start.getMonth()]} ${range.start.getFullYear()}`;
  }

  return `${range.start.getFullYear()}`;
}

function formatDistance(km) {
  const formatted = km.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} km`;
}

periodButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentPeriod = btn.dataset.period;
    dashboardOffset = 0;
    periodButtons.forEach((b) => b.classList.toggle("active", b === btn));
    dashboardPeriodNav.hidden = currentPeriod === "all";
    renderDashboard();
  });
});

document.querySelectorAll("[data-dashboard-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    dashboardOffset += btn.dataset.dashboardNav === "next" ? 1 : -1;
    renderDashboard();
  });
});

dashboardPeriodLabel.addEventListener("click", () => {
  if (dashboardOffset !== 0) {
    dashboardOffset = 0;
    renderDashboard();
  }
});

function renderDashboard() {
  let sessions = Storage.getSessions();

  if (currentPeriod !== "all") {
    const range = getPeriodRange(currentPeriod, dashboardOffset);
    dashboardPeriodLabel.textContent = formatPeriodLabel(currentPeriod, range);
    const startISO = toISO(range.start);
    const endISO = toISO(range.end);
    sessions = sessions.filter((s) => s.date >= startISO && s.date <= endISO);
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalDistance = sessions.reduce((sum, s) => sum + (s.distanceKm || 0), 0);

  summaryCard.innerHTML = `
    <div class="summary-row">
      <span class="summary-label">Séance${sessions.length > 1 ? "s" : ""}</span>
      <span class="summary-value">${sessions.length.toLocaleString("fr-FR")}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Temps</span>
      <span class="summary-value">${sessions.length ? formatDuration(totalMinutes) : "—"}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Distance</span>
      <span class="summary-value">${totalDistance > 0 ? formatDistance(totalDistance) : "—"}</span>
    </div>
  `;

  if (sessions.length === 0) {
    disciplineStats.innerHTML = `<p class="placeholder">Aucune séance sur cette période.</p>`;
    return;
  }

  disciplineStats.innerHTML = "";

  DISCIPLINES.map((discipline) => {
    const disciplineSessions = sessions.filter((s) => s.discipline === discipline.id);
    const minutes = disciplineSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const distance = disciplineSessions.reduce((sum, s) => sum + (s.distanceKm || 0), 0);
    return { discipline, disciplineSessions, minutes, distance };
  })
    .filter((entry) => entry.disciplineSessions.length > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .forEach(({ discipline, disciplineSessions, minutes, distance }) => {
    const minutesPct = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : null;

    const item = document.createElement("div");
    item.className = "card discipline-stat-item";
    item.style.setProperty("--discipline-color", discipline.color);

    const numbers = [
      `${disciplineSessions.length} séance${disciplineSessions.length > 1 ? "s" : ""}`,
      formatDuration(minutes),
      discipline.hasDistance && distance > 0 ? formatDistance(distance) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    item.innerHTML = `
      <div class="session-icon-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${discipline.icon}</svg>
      </div>
      <div class="discipline-stat-info">
        <div class="discipline-stat-name">${discipline.label}</div>
        <div class="discipline-stat-numbers">${numbers}</div>
      </div>
      ${minutesPct !== null ? `<div class="discipline-pct-badge">${minutesPct}%</div>` : ""}
    `;

    disciplineStats.appendChild(item);
  });
}

renderDashboard();
