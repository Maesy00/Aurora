/*
 * import.js — import ponctuel de l'historique depuis un export CSV
 * Strava ou Garmin Connect. Tout se passe dans le navigateur : le
 * fichier n'est jamais envoyé nulle part.
 */

const IMPORT_TYPE_MAP = [
  { match: ["run", "course"], discipline: "running" },
  { match: ["ride", "bike", "cycling", "vélo", "velo", "vtt"], discipline: "cycling" },
  { match: ["swim", "nage", "natation"], discipline: "swimming" },
  {
    match: [
      "weight", "strength", "muscu", "hiit", "crossfit",
      "poids", "renforcement", "entraînement", "entrainement", "workout",
    ],
    discipline: "strength",
  },
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

const FRENCH_MONTHS = {
  janv: 0, janvier: 0,
  févr: 1, fevr: 1, février: 1, fevrier: 1,
  mars: 2,
  avr: 3, avril: 3,
  mai: 4,
  juin: 5,
  juil: 6, juillet: 6,
  août: 7, aout: 7,
  sept: 8, septembre: 8,
  oct: 9, octobre: 9,
  nov: 10, novembre: 10,
  déc: 11, dec: 11, décembre: 11, decembre: 11,
};

function parseImportDate(raw) {
  if (!raw) return null;
  const str = String(raw).trim();

  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;

  const match = str.match(/^(\d{1,2})\s+([a-zéèêàôûîç]+)\.?\s+(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
  if (match) {
    const [, day, monthRaw, year, hour, minute, second] = match;
    const month = FRENCH_MONTHS[monthRaw.toLowerCase()];
    if (month !== undefined) {
      return new Date(
        Number(year), month, Number(day),
        hour ? Number(hour) : 0, minute ? Number(minute) : 0, second ? Number(second) : 0
      );
    }
  }

  return null;
}

function parseDistanceValue(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[\s  ]/g, "").replace(",", ".");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
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
    const idx = lower.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

/*
 * L'export Strava contient deux colonnes "Distance" : une résumée dans
 * l'unité d'affichage du compte (parfois km, parfois m selon le sport),
 * et une seconde, toujours en mètres bruts. On cible cette dernière en
 * cherchant la dernière colonne correspondante plutôt que la première.
 */
function findLastColumn(headers, candidates) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if (lower[i] === candidate) return i;
    }
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
  const dateCol = findColumn(headers, ["activity date", "date de l'activité", "date"]);
  const typeCol = findColumn(headers, ["activity type", "type d'activité", "type"]);
  const durationCol = findColumn(headers, [
    "moving time", "durée de déplacement", "duree de deplacement",
    "elapsed time", "temps écoulé", "temps ecoule",
    "time", "duration", "durée",
  ]);
  const distanceCol = findLastColumn(headers, ["distance"]);

  if (dateCol === -1 || typeCol === -1 || durationCol === -1) return [];

  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const discipline = mapActivityType(row[typeCol]);
    if (!discipline) continue;

    const date = parseImportDate(row[dateCol]);
    if (!date) continue;

    const durationMinutes = parseDurationToMin(row[durationCol]);
    if (!durationMinutes) continue;

    let distanceKm = null;
    if (distanceCol !== -1 && row[distanceCol]) {
      const rawDistance = parseDistanceValue(row[distanceCol]);
      if (rawDistance !== null && rawDistance > 0) {
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
