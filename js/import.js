/*
 * import.js — import ponctuel de l'historique depuis un export CSV
 * Strava ou Garmin Connect. Tout se passe dans le navigateur : le
 * fichier n'est jamais envoyé nulle part.
 */

const IMPORT_TYPE_MAP = [
  { match: ["run", "course"], discipline: "running" },
  { match: ["ride", "bike", "cycling", "vélo", "velo", "vtt"], discipline: "cycling" },
  { match: ["swim", "nage", "natation"], discipline: "swimming" },
  { match: ["weight", "strength", "muscu", "hiit", "crossfit", "training"], discipline: "strength" },
  { match: ["yoga", "pilates"], discipline: "yoga" },
];

function mapActivityType(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const entry of IMPORT_TYPE_MAP) {
    if (entry.match.some((m) => lower.includes(m))) return entry.discipline;
  }
  return null;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h === candidate);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDurationToMin(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  if (str.includes(":")) {
    const parts = str.split(":").map(Number);
    if (parts.some(isNaN)) return null;
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else return null;
    return Math.round(seconds / 60);
  }

  const num = Number(str);
  if (isNaN(num)) return null;
  return Math.round(num / 60);
}

function parseImportedCSV(text, distanceAlreadyKm) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const dateCol = findColumn(headers, ["activity date", "date"]);
  const typeCol = findColumn(headers, ["activity type", "type"]);
  const durationCol = findColumn(headers, ["moving time", "elapsed time", "time", "duration"]);
  const distanceCol = findColumn(headers, ["distance"]);

  if (dateCol === -1 || typeCol === -1 || durationCol === -1) return [];

  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const discipline = mapActivityType(row[typeCol]);
    if (!discipline) continue;

    const date = new Date(row[dateCol]);
    if (isNaN(date.getTime())) continue;

    const durationMinutes = parseDurationToMin(row[durationCol]);
    if (!durationMinutes) continue;

    let distanceKm = null;
    if (distanceCol !== -1 && row[distanceCol]) {
      const rawDistance = Number(row[distanceCol]);
      if (!isNaN(rawDistance) && rawDistance > 0) {
        distanceKm = Math.round((distanceAlreadyKm ? rawDistance : rawDistance / 1000) * 100) / 100;
      }
    }

    results.push({
      discipline,
      date: toISO(date),
      durationMinutes,
      distanceKm: DISCIPLINES.find((d) => d.id === discipline).hasDistance ? distanceKm : null,
      notes: "",
    });
  }

  return results;
}

/* --- UI --- */

const importTrigger = document.getElementById("import-trigger");
const importModalOverlay = document.getElementById("import-modal-overlay");
const importModalClose = document.getElementById("import-modal-close");
const importFileInput = document.getElementById("import-file-input");
const importUnitKm = document.getElementById("import-unit-km");
const importStepUpload = document.getElementById("import-step-upload");
const importStepPreview = document.getElementById("import-step-preview");
const importSummary = document.getElementById("import-summary");
const importPreviewList = document.getElementById("import-preview-list");
const importConfirmBtn = document.getElementById("import-confirm-btn");

let importParsedSessions = [];

function openImportModal() {
  importStepUpload.hidden = false;
  importStepPreview.hidden = true;
  importFileInput.value = "";
  importModalOverlay.hidden = false;
}

function closeImportModal() {
  importModalOverlay.hidden = true;
}

importTrigger.addEventListener("click", openImportModal);
importModalClose.addEventListener("click", closeImportModal);
importModalOverlay.addEventListener("click", (event) => {
  if (event.target === importModalOverlay) closeImportModal();
});

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    importParsedSessions = parseImportedCSV(reader.result, importUnitKm.checked);
    renderImportPreview();
  };
  reader.readAsText(file);
});

function renderImportPreview() {
  importStepUpload.hidden = true;
  importStepPreview.hidden = false;

  if (importParsedSessions.length === 0) {
    importSummary.textContent = "Aucune séance reconnue dans ce fichier.";
    importPreviewList.innerHTML = "";
    importConfirmBtn.hidden = true;
    return;
  }

  importConfirmBtn.hidden = false;
  const count = importParsedSessions.length;
  importSummary.textContent = `${count} séance${count > 1 ? "s" : ""} détectée${count > 1 ? "s" : ""} :`;
  importConfirmBtn.textContent = `Importer ${count} séance${count > 1 ? "s" : ""}`;

  importPreviewList.innerHTML = "";
  importParsedSessions.forEach((session) => {
    const discipline = DISCIPLINES.find((d) => d.id === session.discipline);
    const metaParts = [formatDuration(session.durationMinutes)];
    if (session.distanceKm) metaParts.push(`${session.distanceKm} km`);

    const row = document.createElement("div");
    row.className = "import-preview-row";
    row.style.setProperty("--discipline-color", discipline.color);
    row.innerHTML = `
      <div class="import-preview-row-top">
        <span class="import-preview-dot"></span>
        <span class="import-preview-label">${discipline.label}</span>
        <span class="import-preview-date">${formatDisplayDate(session.date)}</span>
      </div>
      <div class="import-preview-meta">${metaParts.join(" · ")}</div>
    `;
    importPreviewList.appendChild(row);
  });
}

importConfirmBtn.addEventListener("click", () => {
  importParsedSessions.forEach((session) => Storage.addSession(session));
  closeImportModal();
  renderHistory();
  renderDashboard();
});
