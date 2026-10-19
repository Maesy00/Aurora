/*
 * distance.js — saisie directe de la distance (clavier numérique).
 * Kilomètres avec décimales pour la course et le vélo, mètres pour la
 * natation. La valeur est toujours stockée en km dans #session-distance,
 * pour rester compatible avec le reste de l'app.
 */

const distanceInputField = document.getElementById("distance-input");
const distanceUnitLabel = document.getElementById("distance-unit");
const distanceHidden = document.getElementById("session-distance");

let distanceMode = "km";

function sanitizeDistanceText(raw) {
  if (distanceMode === "meters") return raw.replace(/\D/g, "");

  const cleaned = raw.replace(/[^\d.,]/g, "");
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) return cleaned;

  const integerPart = cleaned.slice(0, separatorIndex);
  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, "").slice(0, 2);
  return `${integerPart},${decimalPart}`;
}

function syncDistanceHidden() {
  const value = parseFloat(distanceInputField.value.replace(",", "."));

  if (!Number.isFinite(value) || value <= 0) {
    distanceHidden.value = "";
    return;
  }

  const km = distanceMode === "meters" ? Math.round(value) / 1000 : Math.round(value * 100) / 100;
  distanceHidden.value = String(km);
}

distanceInputField.addEventListener("input", () => {
  distanceInputField.value = sanitizeDistanceText(distanceInputField.value);
  syncDistanceHidden();
});

function setDistanceMode(mode) {
  if (mode === distanceMode) return;

  distanceMode = mode;
  clearDistance();

  if (mode === "meters") {
    distanceUnitLabel.textContent = "m";
    distanceInputField.placeholder = "Ex. 1500";
    distanceInputField.inputMode = "numeric";
  } else {
    distanceUnitLabel.textContent = "km";
    distanceInputField.placeholder = "Ex. 10,5";
    distanceInputField.inputMode = "decimal";
  }
}

function applyDistanceKmValue(kmValue) {
  distanceInputField.value =
    distanceMode === "meters"
      ? String(Math.round(kmValue * 1000))
      : String(Math.round(kmValue * 100) / 100).replace(".", ",");
  syncDistanceHidden();
}

function clearDistance() {
  distanceInputField.value = "";
  distanceHidden.value = "";
}
