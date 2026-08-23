/*
 * App.js — logique et rendu de l'interface Ironly.
 * Pas de framework : on redessine les portions de page concernées après
 * chaque action. La séance en cours est sauvegardée en brouillon à chaque
 * changement pour ne rien perdre si le téléphone se verrouille en salle.
 */

const DRAFT_KEY = "ironly:draft-session";

let activeSession = null; // { date, planId, planName, exercises: [{exerciseId, sets:[]}] }
let planDraft = null; // { id, name, exercises: [{exerciseId, targetSets, targetReps}] }
let pickerOnSelect = null;

// ---------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function formatDateLong(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatSetsSummary(sets, metric) {
  if (!sets || sets.length === 0) return "—";
  if (metric === "weight_reps") {
    return sets.map((s) => `${s.reps || 0}×${s.weight || 0}kg`).join(" · ");
  }
  if (metric === "time") {
    return sets.map((s) => `${s.duration || 0}s`).join(" · ");
  }
  return sets.map((s) => s.reps || 0).join("-") + " reps";
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), 2200);
}

function openModal(contentHTML) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-overlay"><div class="modal-card">${contentHTML}</div></div>`;
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  pickerOnSelect = null;
}

// window.confirm() est silencieusement désactivé dans les PWA iOS ajoutées
// à l'écran d'accueil (mode standalone) : on utilise notre propre modale
// pour que "Annuler"/"Supprimer" fonctionnent aussi une fois l'app installée.
function confirmDialog(message) {
  return new Promise((resolve) => {
    openModal(`
      <p class="confirm-message">${message}</p>
      <div class="session-actions">
        <button type="button" class="btn btn-ghost" data-action="confirm-no">Annuler</button>
        <button type="button" class="btn btn-primary" data-action="confirm-yes">Confirmer</button>
      </div>
    `);
    const root = document.getElementById("modal-root");
    root.onclick = (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        closeModal();
        resolve(false);
        return;
      }
      if (e.target.closest('[data-action="confirm-yes"]')) {
        closeModal();
        resolve(true);
        return;
      }
      if (e.target.closest('[data-action="confirm-no"]')) {
        closeModal();
        resolve(false);
      }
    };
  });
}

// ---------------------------------------------------------------------
// Sélecteur d'exercice (modale partagée entre Séance et Plans)
// ---------------------------------------------------------------------

function pickerResultsHTML(query) {
  const list = Exercises.all().filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()));
  const byGroup = {};
  list.forEach((e) => (byGroup[e.group] = byGroup[e.group] || []).push(e));
  const groupKeys = Object.keys(byGroup);
  if (groupKeys.length === 0) return `<p class="empty-hint">Aucun résultat.</p>`;
  return groupKeys
    .map(
      (g) => `
      <div class="picker-group">
        <h4>${Exercises.groups[g] || g}</h4>
        ${byGroup[g].map((e) => `<button type="button" class="picker-item" data-exercise-id="${e.id}">${e.name}</button>`).join("")}
      </div>`
    )
    .join("");
}

function exercisePickerHTML() {
  const groupOptions = Object.entries(Exercises.groups)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  return `
    <h3 class="modal-title">Choisir un exercice</h3>
    <input type="search" id="picker-search" placeholder="Rechercher…" autocomplete="off">
    <div id="picker-results">${pickerResultsHTML("")}</div>
    <details class="picker-custom">
      <summary>+ Créer un exercice personnalisé</summary>
      <label class="field"><span>Nom</span><input type="text" id="custom-ex-name"></label>
      <label class="field"><span>Groupe musculaire</span>
        <select id="custom-ex-group">${groupOptions}</select>
      </label>
      <label class="field"><span>Type de suivi</span>
        <select id="custom-ex-metric">
          <option value="weight_reps">Charge + répétitions</option>
          <option value="bodyweight_reps">Répétitions seules</option>
          <option value="time">Durée tenue</option>
        </select>
      </label>
      <button type="button" id="btn-create-custom-exercise" class="btn btn-secondary btn-block">Ajouter au catalogue</button>
    </details>
    <button type="button" class="btn btn-ghost btn-block" data-action="close-modal">Fermer</button>
  `;
}

function openExercisePicker(onSelect) {
  pickerOnSelect = onSelect;
  openModal(exercisePickerHTML());
  const root = document.getElementById("modal-root");

  root.onclick = async (e) => {
    if (e.target.classList.contains("modal-overlay") || e.target.closest('[data-action="close-modal"]')) {
      closeModal();
      return;
    }
    const item = e.target.closest(".picker-item");
    if (item) {
      const exercise = Exercises.byId(item.dataset.exerciseId);
      const cb = pickerOnSelect;
      closeModal();
      cb(exercise);
      return;
    }
    if (e.target.id === "btn-create-custom-exercise") {
      const name = root.querySelector("#custom-ex-name").value.trim();
      if (!name) {
        showToast("Donne un nom à l'exercice");
        return;
      }
      const group = root.querySelector("#custom-ex-group").value;
      const metric = root.querySelector("#custom-ex-metric").value;
      const cb = pickerOnSelect;
      closeModal();
      const exercise = await Exercises.createCustom(name, group, metric);
      cb(exercise);
    }
  };

  root.oninput = (e) => {
    if (e.target.id === "picker-search") {
      root.querySelector("#picker-results").innerHTML = pickerResultsHTML(e.target.value);
    }
  };
}

// ---------------------------------------------------------------------
// Vue Séance
// ---------------------------------------------------------------------

function saveDraft() {
  if (activeSession) localStorage.setItem(DRAFT_KEY, JSON.stringify(activeSession));
  else localStorage.removeItem(DRAFT_KEY);
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setInputsForMetric(metric) {
  if (metric === "weight_reps") {
    return [
      { key: "reps", label: "Reps", unit: "reps", type: "number", inputmode: "numeric" },
      { key: "weight", label: "Kg", unit: "kg", type: "number", inputmode: "decimal" },
    ];
  }
  if (metric === "time") {
    return [{ key: "duration", label: "Secondes", unit: "s", type: "number", inputmode: "numeric" }];
  }
  return [{ key: "reps", label: "Reps", unit: "reps", type: "number", inputmode: "numeric" }];
}

function sessionExerciseCardHTML(entry) {
  const exercise = Exercises.byId(entry.exerciseId);
  if (!exercise) return "";
  const fields = setInputsForMetric(exercise.metric);
  const history = Storage.getHistoryForExercise(exercise.id);
  const lastHint = history[0]
    ? `Dernière fois (${formatDateLong(history[0].date)}) : ${formatSetsSummary(history[0].sets, exercise.metric)}`
    : "Pas d'historique pour cet exercice.";

  const rows = entry.sets
    .map(
      (set, i) => `
      <div class="set-row" data-exercise-id="${exercise.id}" data-set-index="${i}">
        <span class="set-index">${i + 1}</span>
        ${fields
          .map(
            (f) => `
          <span class="set-field">
            <input class="set-input" type="${f.type}" inputmode="${f.inputmode}" min="0" step="${f.key === "weight" ? "0.5" : "1"}"
              placeholder="${f.label}" data-field="${f.key}"
              data-exercise-id="${exercise.id}" data-set-index="${i}"
              value="${set[f.key] ?? ""}">
            <span class="set-unit">${f.unit}</span>
          </span>
        `
          )
          .join("")}
        <button type="button" class="set-remove" data-action="remove-set" data-exercise-id="${exercise.id}" data-set-index="${i}" aria-label="Retirer la série">✕</button>
      </div>`
    )
    .join("");

  return `
    <div class="card exercise-card" data-exercise-id="${exercise.id}">
      <div class="exercise-card-head">
        <div>
          <span class="group-badge">${Exercises.groups[exercise.group] || exercise.group}</span>
          <h3>${exercise.name}</h3>
        </div>
        <button type="button" class="icon-btn" data-action="remove-exercise" data-exercise-id="${exercise.id}" aria-label="Retirer l'exercice">✕</button>
      </div>
      <p class="history-hint">${lastHint}</p>
      <div class="set-rows">${rows}</div>
      <button type="button" class="btn btn-tertiary" data-action="add-set" data-exercise-id="${exercise.id}">+ Série</button>
    </div>
  `;
}

function renderSessionExercises() {
  document.getElementById("session-exercises").innerHTML = activeSession.exercises
    .map((entry) => sessionExerciseCardHTML(entry))
    .join("");
}

function renderSessionView() {
  const idle = document.getElementById("session-idle");
  const active = document.getElementById("session-active");
  document.getElementById("plans-manager").classList.add("hidden");

  if (!activeSession) {
    idle.classList.remove("hidden");
    active.classList.add("hidden");
    const plans = Storage.getPlans();
    const container = document.getElementById("quick-start-plans");
    container.innerHTML = plans.length
      ? plans
          .map(
            (p) => `
        <div class="card plan-card">
          <h3>${p.name}</h3>
          <p class="muted">${p.exercises.length} exercice(s)</p>
          <button type="button" class="btn btn-secondary btn-block" data-action="quick-start-plan" data-plan-id="${p.id}">Démarrer cette séance</button>
        </div>`
          )
          .join("")
      : `<p class="empty-hint">Aucun plan enregistré. Crée-en un via « Gérer mes plans » ci-dessous.</p>`;
    return;
  }

  idle.classList.add("hidden");
  active.classList.remove("hidden");

  document.getElementById("session-date").value = activeSession.date;
  const badge = document.getElementById("session-plan-badge");
  if (activeSession.planName) {
    badge.textContent = activeSession.planName;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
  renderSessionExercises();
}

function startBlankSession() {
  activeSession = { date: todayISO(), planId: null, planName: null, exercises: [] };
  saveDraft();
  renderSessionView();
}

function startSessionFromPlan(plan) {
  activeSession = {
    date: todayISO(),
    planId: plan.id,
    planName: plan.name,
    exercises: plan.exercises.map((pe) => {
      const history = Storage.getHistoryForExercise(pe.exerciseId);
      const lastSets = history[0] ? history[0].sets : [];
      const count = pe.targetSets || 1;
      const sets = Array.from({ length: count }, (_, i) => ({ ...(lastSets[i] || {}) }));
      return { exerciseId: pe.exerciseId, sets };
    }),
  };
  saveDraft();
  showToast(`Séance "${plan.name}" démarrée`);
  switchView("session");
}

function addExerciseToSession(exercise) {
  if (activeSession.exercises.some((e) => e.exerciseId === exercise.id)) {
    showToast("Déjà dans la séance");
    return;
  }
  const defaultSet = exercise.metric === "time" ? { duration: "" } : { reps: "", weight: "" };
  activeSession.exercises.push({ exerciseId: exercise.id, sets: [defaultSet] });
  saveDraft();
  renderSessionExercises();
}

async function finishSession() {
  if (activeSession.exercises.length === 0) {
    showToast("Ajoute au moins un exercice");
    return;
  }
  const cleaned = {
    date: activeSession.date,
    planId: activeSession.planId,
    planName: activeSession.planName,
    exercises: activeSession.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets
        .filter((s) => (s.reps !== "" && s.reps != null) || (s.duration !== "" && s.duration != null))
        .map((s) => ({
          reps: s.reps !== undefined && s.reps !== "" ? Number(s.reps) : undefined,
          weight: s.weight !== undefined && s.weight !== "" ? Number(s.weight) : undefined,
          duration: s.duration !== undefined && s.duration !== "" ? Number(s.duration) : undefined,
        })),
    })).filter((e) => e.sets.length > 0),
  };
  if (cleaned.exercises.length === 0) {
    showToast("Renseigne au moins une série");
    return;
  }
  await Storage.addSession(cleaned);
  activeSession = null;
  saveDraft();
  showToast("Séance enregistrée");
  switchView("history");
}

async function cancelSession() {
  if (!(await confirmDialog("Annuler cette séance ? Les données saisies seront perdues."))) return;
  activeSession = null;
  saveDraft();
  renderSessionView();
}

function wireSessionView() {
  document.getElementById("btn-start-blank").addEventListener("click", startBlankSession);
  document.getElementById("btn-add-exercise").addEventListener("click", () => {
    openExercisePicker((exercise) => addExerciseToSession(exercise));
  });
  document.getElementById("btn-cancel-session").addEventListener("click", cancelSession);
  document.getElementById("btn-finish-session").addEventListener("click", finishSession);
  document.getElementById("btn-open-plans-manager").addEventListener("click", openPlansManager);

  document.getElementById("session-date").addEventListener("input", (e) => {
    activeSession.date = e.target.value;
    saveDraft();
  });

  document.getElementById("quick-start-plans").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="quick-start-plan"]');
    if (!btn) return;
    const plan = Storage.getPlans().find((p) => p.id === btn.dataset.planId);
    if (plan) startSessionFromPlan(plan);
  });

  const list = document.getElementById("session-exercises");
  list.addEventListener("click", (e) => {
    const removeSet = e.target.closest('[data-action="remove-set"]');
    if (removeSet) {
      const entry = activeSession.exercises.find((x) => x.exerciseId === removeSet.dataset.exerciseId);
      entry.sets.splice(Number(removeSet.dataset.setIndex), 1);
      saveDraft();
      renderSessionExercises();
      return;
    }
    const addSet = e.target.closest('[data-action="add-set"]');
    if (addSet) {
      const entry = activeSession.exercises.find((x) => x.exerciseId === addSet.dataset.exerciseId);
      const last = entry.sets[entry.sets.length - 1] || {};
      entry.sets.push({ ...last });
      saveDraft();
      renderSessionExercises();
      return;
    }
    const removeExercise = e.target.closest('[data-action="remove-exercise"]');
    if (removeExercise) {
      activeSession.exercises = activeSession.exercises.filter((x) => x.exerciseId !== removeExercise.dataset.exerciseId);
      saveDraft();
      renderSessionExercises();
    }
  });
  list.addEventListener("input", (e) => {
    const input = e.target.closest(".set-input");
    if (!input) return;
    const entry = activeSession.exercises.find((x) => x.exerciseId === input.dataset.exerciseId);
    entry.sets[Number(input.dataset.setIndex)][input.dataset.field] = input.value;
    saveDraft();
  });
}

// ---------------------------------------------------------------------
// Vue Plans (gestion accessible depuis l'onglet Séance)
// ---------------------------------------------------------------------

function openPlansManager() {
  document.getElementById("session-idle").classList.add("hidden");
  document.getElementById("session-active").classList.add("hidden");
  document.getElementById("plans-manager").classList.remove("hidden");
  renderPlansListView();
}

function closePlansManager() {
  document.getElementById("plans-manager").classList.add("hidden");
  renderSessionView();
}

function planCardHTML(plan) {
  const items = plan.exercises
    .map((pe) => {
      const ex = Exercises.byId(pe.exerciseId);
      return `<li>${ex ? ex.name : "?"} — ${pe.targetSets}×${pe.targetReps}</li>`;
    })
    .join("");
  return `
    <div class="card plan-card" data-plan-id="${plan.id}">
      <h3>${plan.name}</h3>
      <ul class="plan-exercise-list">${items}</ul>
      <div class="plan-card-actions">
        <button type="button" class="btn" data-action="start-from-plan" data-plan-id="${plan.id}">Démarrer</button>
        <button type="button" class="btn" data-action="edit-plan" data-plan-id="${plan.id}">Modifier</button>
        <button type="button" class="btn" data-action="delete-plan" data-plan-id="${plan.id}">Supprimer</button>
      </div>
    </div>
  `;
}

function renderPlansListView() {
  const plans = Storage.getPlans();
  document.getElementById("plans-list").innerHTML = plans.length
    ? plans.map(planCardHTML).join("")
    : `<p class="empty-hint">Aucun plan pour l'instant.</p>`;
  document.getElementById("plans-list-panel").classList.remove("hidden");
  document.getElementById("plan-editor").classList.add("hidden");
}

function planExerciseRowHTML(pe, index) {
  const ex = Exercises.byId(pe.exerciseId);
  return `
    <div class="card plan-exercise-row">
      <div class="exercise-card-head">
        <div>
          <span class="group-badge">${ex ? Exercises.groups[ex.group] : ""}</span>
          <h3>${ex ? ex.name : "?"}</h3>
        </div>
        <button type="button" class="icon-btn" data-action="remove-plan-exercise" data-index="${index}" aria-label="Retirer">✕</button>
      </div>
      <div class="field-row">
        <label class="field">
          <span>Séries</span>
          <input type="number" min="1" class="plan-target-sets" data-index="${index}" value="${pe.targetSets}">
        </label>
        <label class="field">
          <span>Reps</span>
          <input type="text" class="plan-target-reps" data-index="${index}" placeholder="ex. 8-12" value="${pe.targetReps || ""}">
        </label>
      </div>
    </div>
  `;
}

function renderPlanEditor() {
  document.getElementById("plans-list-panel").classList.add("hidden");
  document.getElementById("plan-editor").classList.remove("hidden");
  document.getElementById("plan-name").value = planDraft.name || "";
  document.getElementById("plan-exercises").innerHTML = planDraft.exercises.map(planExerciseRowHTML).join("");
}

function startNewPlan() {
  planDraft = { id: null, name: "", exercises: [] };
  renderPlanEditor();
}

function editPlan(plan) {
  planDraft = { id: plan.id, name: plan.name, exercises: plan.exercises.map((e) => ({ ...e })) };
  renderPlanEditor();
}

async function savePlan() {
  const name = document.getElementById("plan-name").value.trim();
  if (!name) {
    showToast("Donne un nom au plan");
    return;
  }
  if (planDraft.exercises.length === 0) {
    showToast("Ajoute au moins un exercice");
    return;
  }
  const payload = {
    name,
    exercises: planDraft.exercises,
  };
  if (planDraft.id) await Storage.updatePlan(planDraft.id, payload);
  else await Storage.addPlan(payload);
  showToast("Plan enregistré");
  planDraft = null;
  renderPlansListView();
}

function wirePlansView() {
  document.getElementById("btn-back-to-session").addEventListener("click", closePlansManager);
  document.getElementById("btn-new-plan").addEventListener("click", startNewPlan);
  document.getElementById("plan-name").addEventListener("input", (e) => {
    planDraft.name = e.target.value;
  });
  document.getElementById("btn-cancel-plan").addEventListener("click", () => {
    planDraft = null;
    renderPlansListView();
  });
  document.getElementById("btn-save-plan").addEventListener("click", savePlan);
  document.getElementById("btn-plan-add-exercise").addEventListener("click", () => {
    openExercisePicker((exercise) => {
      if (planDraft.exercises.some((e) => e.exerciseId === exercise.id)) {
        showToast("Déjà dans le plan");
        return;
      }
      planDraft.exercises.push({ exerciseId: exercise.id, targetSets: 3, targetReps: "8-12" });
      renderPlanEditor();
    });
  });

  document.getElementById("plans-list").addEventListener("click", async (e) => {
    const start = e.target.closest('[data-action="start-from-plan"]');
    if (start) {
      const plan = Storage.getPlans().find((p) => p.id === start.dataset.planId);
      if (plan) startSessionFromPlan(plan);
      return;
    }
    const edit = e.target.closest('[data-action="edit-plan"]');
    if (edit) {
      const plan = Storage.getPlans().find((p) => p.id === edit.dataset.planId);
      if (plan) editPlan(plan);
      return;
    }
    const del = e.target.closest('[data-action="delete-plan"]');
    if (del) {
      if (await confirmDialog("Supprimer ce plan ?")) {
        await Storage.deletePlan(del.dataset.planId);
        renderPlansListView();
      }
    }
  });

  const exList = document.getElementById("plan-exercises");
  exList.addEventListener("click", (e) => {
    const remove = e.target.closest('[data-action="remove-plan-exercise"]');
    if (remove) {
      planDraft.exercises.splice(Number(remove.dataset.index), 1);
      renderPlanEditor();
    }
  });
  exList.addEventListener("input", (e) => {
    if (e.target.classList.contains("plan-target-sets")) {
      planDraft.exercises[Number(e.target.dataset.index)].targetSets = Number(e.target.value) || 1;
    }
    if (e.target.classList.contains("plan-target-reps")) {
      planDraft.exercises[Number(e.target.dataset.index)].targetReps = e.target.value;
    }
  });
}

// ---------------------------------------------------------------------
// Vue Historique
// ---------------------------------------------------------------------

function historyCardHTML(session) {
  const details = session.exercises
    .map((e) => {
      const ex = Exercises.byId(e.exerciseId);
      return `<li><strong>${ex ? ex.name : "?"}</strong> — ${formatSetsSummary(e.sets, ex ? ex.metric : "bodyweight_reps")}</li>`;
    })
    .join("");
  return `
    <div class="card history-card">
      <details>
        <summary>
          <span class="history-date">${formatDateLong(session.date)}</span>
          <span class="muted">${session.planName || "Séance libre"} · ${session.exercises.length} exercice(s)</span>
        </summary>
        <ul class="history-detail-list">${details}</ul>
        <button type="button" class="btn btn-ghost" data-action="delete-session" data-session-id="${session.id}">Supprimer</button>
      </details>
    </div>
  `;
}

function renderHistoryView() {
  const sessions = Storage.getSessions().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  if (sessions.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = sessions.map(historyCardHTML).join("");
}

function wireHistoryView() {
  document.getElementById("history-list").addEventListener("click", async (e) => {
    const del = e.target.closest('[data-action="delete-session"]');
    if (!del) return;
    if (await confirmDialog("Supprimer cette séance de l'historique ?")) {
      await Storage.deleteSession(del.dataset.sessionId);
      renderHistoryView();
    }
  });
}

// ---------------------------------------------------------------------
// Vue Stats
// ---------------------------------------------------------------------

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

let calendarCursor = (() => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
})();

function renderCalendar() {
  const { year, month } = calendarCursor;
  const trainedDates = Stats.sessionDates();
  const todayIso = todayISO();

  document.getElementById("calendar-month-label").textContent = `${MONTH_NAMES[month]} ${year}`;

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(`<span class="calendar-cell empty"></span>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const trained = trainedDates.has(iso);
    const isToday = iso === todayIso;
    cells.push(`
      <span class="calendar-cell${trained ? " trained" : ""}${isToday ? " today" : ""}">
        <span class="calendar-day-num">${day}</span>
        ${trained ? '<span class="calendar-dot"></span>' : ""}
      </span>
    `);
  }
  document.getElementById("calendar-grid").innerHTML = cells.join("");
}

function wireCalendar() {
  document.getElementById("calendar-prev").addEventListener("click", () => {
    calendarCursor.month -= 1;
    if (calendarCursor.month < 0) {
      calendarCursor.month = 11;
      calendarCursor.year -= 1;
    }
    renderCalendar();
  });
  document.getElementById("calendar-next").addEventListener("click", () => {
    calendarCursor.month += 1;
    if (calendarCursor.month > 11) {
      calendarCursor.month = 0;
      calendarCursor.year += 1;
    }
    renderCalendar();
  });
}

function renderStatsView() {
  renderCalendar();

  const usedIds = [...new Set(Storage.getSessions().flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const select = document.getElementById("stats-exercise-select");
  const previous = select.value;
  const options = usedIds
    .map((id) => Exercises.byId(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (options.length === 0) {
    select.innerHTML = `<option value="">Aucune donnée</option>`;
    document.getElementById("stats-exercise-empty").classList.remove("hidden");
    document.getElementById("stats-exercise-charts").classList.add("hidden");
    return;
  }

  select.innerHTML = options.map((e) => `<option value="${e.id}">${e.name}</option>`).join("");
  select.value = options.some((e) => e.id === previous) ? previous : options[0].id;
  renderExerciseStats(select.value);
}

let statsMetricKey = "top";

function renderExerciseStats(exerciseId) {
  const { exercise, points } = Stats.exerciseProgress(exerciseId);
  const empty = document.getElementById("stats-exercise-empty");
  const charts = document.getElementById("stats-exercise-charts");
  if (!exercise || points.length === 0) {
    empty.classList.remove("hidden");
    charts.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  charts.classList.remove("hidden");
  const unit = Stats.metricUnit(exercise.metric);
  document.getElementById("stats-progress-chart").innerHTML = Stats.lineChartSVG(points, statsMetricKey, unit);
}

function wireStatsView() {
  wireCalendar();
  document.querySelectorAll(".metric-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      statsMetricKey = btn.dataset.metric;
      document.querySelectorAll(".metric-toggle-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderExerciseStats(document.getElementById("stats-exercise-select").value);
    });
  });
  document.getElementById("stats-exercise-select").addEventListener("change", (e) => {
    renderExerciseStats(e.target.value);
  });
}

// ---------------------------------------------------------------------
// Navigation & init
// ---------------------------------------------------------------------

function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById(`view-${name}`).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));

  if (name === "session") renderSessionView();
  if (name === "history") renderHistoryView();
  if (name === "stats") renderStatsView();
}

function init() {
  activeSession = loadDraft();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  wireSessionView();
  wirePlansView();
  wireHistoryView();
  wireStatsView();
}

document.addEventListener("DOMContentLoaded", init);
