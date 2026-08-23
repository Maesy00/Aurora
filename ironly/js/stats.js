/*
 * Stats.js — calcule les données de progression et dessine des graphiques
 * SVG faits main (pas de librairie externe, pour rester 100% offline/PWA).
 */

const Stats = (() => {
  function metricValue(set, metric) {
    if (metric === "weight_reps") return set.weight || 0;
    if (metric === "bodyweight_reps") return set.reps || 0;
    if (metric === "time") return set.duration || 0;
    return 0;
  }

  function volumeOfSet(set, metric) {
    if (metric === "weight_reps") return (set.reps || 0) * (set.weight || 0);
    return metricValue(set, metric);
  }

  function metricUnit(metric) {
    if (metric === "weight_reps") return " kg";
    if (metric === "time") return " s";
    return " reps";
  }

  // Progression d'un exercice : la valeur "phare" par séance (charge max
  // pour un exercice à charge, reps max pour du poids de corps, durée max
  // pour du gainage) et le volume total de la séance pour cet exercice.
  function exerciseProgress(exerciseId) {
    const exercise = Exercises.byId(exerciseId);
    if (!exercise) return { exercise: null, points: [] };
    const history = Storage.getHistoryForExercise(exerciseId)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const points = history.map((entry) => ({
      date: entry.date,
      top: Math.max(0, ...entry.sets.map((s) => metricValue(s, exercise.metric))),
      volume: entry.sets.reduce((sum, s) => sum + volumeOfSet(s, exercise.metric), 0),
    }));
    return { exercise, points };
  }

  // Dates (YYYY-MM-DD) qui ont au moins une séance enregistrée — sert au
  // calendrier de régularité.
  function sessionDates() {
    return new Set(Storage.getSessions().map((s) => s.date));
  }

  function formatShortDate(iso) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  function lineChartSVG(points, valueKey, unit) {
    if (points.length === 0) {
      return `<p class="empty-hint">Pas encore de données pour cet exercice.</p>`;
    }
    const width = 320;
    const height = 120;
    const padding = 22;
    const values = points.map((p) => p[valueKey]);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
      x: padding + i * stepX,
      y: height - padding - ((p[valueKey] - min) / range) * (height - padding * 2),
      ...p,
    }));
    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const dots = coords
      .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" class="chart-dot"/>`)
      .join("");
    const last = coords[coords.length - 1];
    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="chart-axis"/>
        <path d="${path}" class="chart-line" fill="none"/>
        ${dots}
      </svg>
      <div class="chart-caption">Dernier : <strong>${last[valueKey]}${unit}</strong> le ${formatShortDate(last.date)}</div>
    `;
  }

  return {
    exerciseProgress,
    sessionDates,
    lineChartSVG,
    metricUnit,
    formatShortDate,
  };
})();
