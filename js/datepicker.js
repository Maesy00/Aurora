/*
 * datepicker.js — petit calendrier maison pour remplacer le sélecteur
 * de date natif du navigateur (peu personnalisable visuellement).
 * Écrit une date ISO (yyyy-mm-dd) dans #session-date, lu ensuite par
 * app.js exactement comme un input date classique.
 */

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const trigger = document.getElementById("date-trigger");
const triggerLabel = document.getElementById("date-trigger-label");
const hiddenInput = document.getElementById("session-date");
const popover = document.getElementById("date-popover");
const popoverTitle = document.getElementById("date-popover-title");
const popoverGrid = document.getElementById("date-popover-grid");

let selectedDate = new Date();
let viewYear = selectedDate.getFullYear();
let viewMonth = selectedDate.getMonth();

function toISO(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLabel(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function setSelectedDate(date) {
  selectedDate = date;
  viewYear = date.getFullYear();
  viewMonth = date.getMonth();
  hiddenInput.value = toISO(date);
  triggerLabel.textContent = formatLabel(date);
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(year, month, 1 - startOffset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function renderCalendar() {
  popoverTitle.textContent = `${MONTHS_FR[viewMonth]} ${viewYear}`;
  popoverGrid.innerHTML = "";

  const today = new Date();
  const days = buildMonthGrid(viewYear, viewMonth);

  days.forEach((day) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-btn";
    btn.textContent = day.getDate();

    if (day.getMonth() !== viewMonth) btn.classList.add("muted");
    if (isSameDay(day, today)) btn.classList.add("today");
    if (isSameDay(day, selectedDate)) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      setSelectedDate(day);
      closePopover();
    });

    popoverGrid.appendChild(btn);
  });
}

function openPopover() {
  viewYear = selectedDate.getFullYear();
  viewMonth = selectedDate.getMonth();
  renderCalendar();
  popover.hidden = false;
}

function closePopover() {
  popover.hidden = true;
}

trigger.addEventListener("click", (event) => {
  event.stopPropagation();
  const wasHidden = popover.hidden;
  document.getElementById("duration-popover").hidden = true;
  document.getElementById("distance-popover").hidden = true;
  wasHidden ? openPopover() : closePopover();
});

document.getElementById("date-prev").addEventListener("click", () => {
  viewMonth -= 1;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  }
  renderCalendar();
});

document.getElementById("date-next").addEventListener("click", () => {
  viewMonth += 1;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  renderCalendar();
});

document.getElementById("date-today").addEventListener("click", () => {
  setSelectedDate(new Date());
  closePopover();
});

document.addEventListener("click", (event) => {
  if (!popover.hidden && !popover.contains(event.target) && event.target !== trigger) {
    closePopover();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePopover();
});

setSelectedDate(new Date());
