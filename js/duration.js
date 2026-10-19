/*
 * duration.js — saisie directe de la durée (heures + minutes).
 * La valeur est stockée au format "HH:MM" dans #session-duration, lu
 * ensuite par app.js.
 */

const durationHoursField = document.getElementById("duration-hours");
const durationMinutesField = document.getElementById("duration-minutes");
const durationHidden = document.getElementById("session-duration");

function syncDurationHidden() {
  const hours = parseInt(durationHoursField.value, 10) || 0;
  const minutes = parseInt(durationMinutesField.value, 10) || 0;
  durationHidden.value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

durationHoursField.addEventListener("input", () => {
  durationHoursField.value = durationHoursField.value.replace(/\D/g, "").slice(0, 2);
  syncDurationHidden();
});

durationMinutesField.addEventListener("input", () => {
  const digits = durationMinutesField.value.replace(/\D/g, "").slice(0, 2);
  durationMinutesField.value = Number(digits) > 59 ? "59" : digits;
  syncDurationHidden();
});

function setDuration(hours, minutes) {
  durationHoursField.value = hours ? String(hours) : "";
  durationMinutesField.value = minutes ? String(minutes) : "";
  syncDurationHidden();
}

setDuration(0, 0);
