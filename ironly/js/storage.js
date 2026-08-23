/*
 * Storage.js — seul endroit qui lit/écrit les données d'Ironly.
 * V1 : tout est stocké en local (localStorage), un appareil = ses données.
 *
 * Évolution Supabase : chaque fonction ci-dessous a une signature stable
 * (mêmes noms, mêmes formes d'objets en entrée/sortie) pensée pour qu'on
 * puisse un jour remplacer le corps de ces fonctions par des appels
 * réseau vers Supabase (comme dans l'app Aurora du même dossier), sans
 * avoir à toucher au reste de l'application. Le jour venu : garder
 * getPlans()/getSessions() synchrones via un cache local rafraîchi après
 * chaque écriture, exactement comme Aurora le fait déjà.
 */

const Storage = (() => {
  const PLANS_KEY = "ironly:plans";
  const SESSIONS_KEY = "ironly:sessions";
  const EXERCISES_KEY = "ironly:custom-exercises";

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error(`Erreur de lecture (${key}) :`, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---- Exercices personnalisés (viennent s'ajouter au catalogue prédéfini) ----

  function getCustomExercises() {
    return readJSON(EXERCISES_KEY, []);
  }

  function addCustomExercise(exercise) {
    const exercises = getCustomExercises();
    const record = { id: uid(), ...exercise };
    exercises.push(record);
    writeJSON(EXERCISES_KEY, exercises);
    return record;
  }

  // ---- Plans d'entraînement (séances-types réutilisables) ----

  function getPlans() {
    return readJSON(PLANS_KEY, []);
  }

  function addPlan(plan) {
    const plans = getPlans();
    const record = { id: uid(), createdAt: new Date().toISOString(), ...plan };
    plans.push(record);
    writeJSON(PLANS_KEY, plans);
    return record;
  }

  function updatePlan(id, updates) {
    const plans = getPlans();
    const idx = plans.findIndex((p) => p.id === id);
    if (idx === -1) return;
    plans[idx] = { ...plans[idx], ...updates };
    writeJSON(PLANS_KEY, plans);
    return plans[idx];
  }

  function deletePlan(id) {
    writeJSON(PLANS_KEY, getPlans().filter((p) => p.id !== id));
  }

  // ---- Séances réalisées ----

  function getSessions() {
    return readJSON(SESSIONS_KEY, []);
  }

  function addSession(session) {
    const sessions = getSessions();
    const record = { id: uid(), ...session };
    sessions.push(record);
    writeJSON(SESSIONS_KEY, sessions);
    return record;
  }

  function updateSession(id, updates) {
    const sessions = getSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) return;
    sessions[idx] = { ...sessions[idx], ...updates };
    writeJSON(SESSIONS_KEY, sessions);
    return sessions[idx];
  }

  function deleteSession(id) {
    writeJSON(SESSIONS_KEY, getSessions().filter((s) => s.id !== id));
  }

  // ---- Historique par exercice : pour adapter ses charges séance après séance ----

  function getHistoryForExercise(exerciseId) {
    return getSessions()
      .filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId))
      .map((s) => ({
        date: s.date,
        sets: s.exercises.find((e) => e.exerciseId === exerciseId).sets,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  return {
    getCustomExercises,
    addCustomExercise,
    getPlans,
    addPlan,
    updatePlan,
    deletePlan,
    getSessions,
    addSession,
    updateSession,
    deleteSession,
    getHistoryForExercise,
  };
})();
