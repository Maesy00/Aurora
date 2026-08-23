/*
 * Storage.js — seul endroit qui lit/écrit les données d'Ironly.
 * Parle à la base Supabase en ligne (synchronisée entre appareils).
 * getPlans()/getSessions()/getCustomExercises() restent synchrones :
 * elles lisent un cache local mis à jour après chaque appel réseau,
 * pour ne pas avoir à réécrire tout l'affichage en asynchrone —
 * exactement comme le fait déjà l'app Aurora du même dépôt.
 */

const Storage = (() => {
  let cachedPlans = [];
  let cachedSessions = [];
  let cachedCustomExercises = [];

  function rowToPlan(row) {
    return { id: row.id, name: row.name, exercises: row.exercises || [] };
  }

  function planToRow(plan, userId) {
    return { user_id: userId, name: plan.name, exercises: plan.exercises };
  }

  function rowToSession(row) {
    return {
      id: row.id,
      date: row.date,
      planId: row.plan_id,
      planName: row.plan_name,
      exercises: row.exercises || [],
    };
  }

  function sessionToRow(session, userId) {
    return {
      user_id: userId,
      date: session.date,
      plan_id: session.planId || null,
      plan_name: session.planName || null,
      exercises: session.exercises,
    };
  }

  function rowToExercise(row) {
    return { id: row.id, name: row.name, group: row.muscle_group, metric: row.metric };
  }

  async function currentUserId() {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    return user ? user.id : null;
  }

  // ---- Exercices personnalisés (viennent s'ajouter au catalogue prédéfini) ----

  function getCustomExercises() {
    return cachedCustomExercises;
  }

  async function addCustomExercise(exercise) {
    const userId = await currentUserId();
    const { data, error } = await supabaseClient
      .from("ironly_custom_exercises")
      .insert({ user_id: userId, name: exercise.name, muscle_group: exercise.group, metric: exercise.metric })
      .select()
      .single();

    if (error) {
      console.error("Erreur d'ajout de l'exercice :", error.message);
      return null;
    }

    await refresh();
    return rowToExercise(data);
  }

  // ---- Plans d'entraînement (séances-types réutilisables) ----

  function getPlans() {
    return cachedPlans;
  }

  async function addPlan(plan) {
    const userId = await currentUserId();
    const { data, error } = await supabaseClient
      .from("ironly_plans")
      .insert(planToRow(plan, userId))
      .select()
      .single();

    if (error) {
      console.error("Erreur d'enregistrement du plan :", error.message);
      return null;
    }

    await refresh();
    return rowToPlan(data);
  }

  async function updatePlan(id, updates) {
    const { error } = await supabaseClient
      .from("ironly_plans")
      .update({ name: updates.name, exercises: updates.exercises })
      .eq("id", id);

    if (error) {
      console.error("Erreur de modification du plan :", error.message);
      return;
    }

    await refresh();
  }

  async function deletePlan(id) {
    const { error } = await supabaseClient.from("ironly_plans").delete().eq("id", id);

    if (error) {
      console.error("Erreur de suppression du plan :", error.message);
      return;
    }

    await refresh();
  }

  // ---- Séances réalisées ----

  function getSessions() {
    return cachedSessions;
  }

  async function addSession(session) {
    const userId = await currentUserId();
    const { error } = await supabaseClient.from("ironly_sessions").insert(sessionToRow(session, userId));

    if (error) {
      console.error("Erreur d'enregistrement de la séance :", error.message);
      return;
    }

    await refresh();
  }

  async function deleteSession(id) {
    const { error } = await supabaseClient.from("ironly_sessions").delete().eq("id", id);

    if (error) {
      console.error("Erreur de suppression de la séance :", error.message);
      return;
    }

    await refresh();
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

  // ---- Rechargement du cache depuis Supabase (après connexion, après écriture) ----

  async function refresh() {
    const [plansRes, sessionsRes, exercisesRes] = await Promise.all([
      supabaseClient.from("ironly_plans").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("ironly_sessions").select("*").order("date", { ascending: false }),
      supabaseClient.from("ironly_custom_exercises").select("*").order("created_at", { ascending: true }),
    ]);

    if (plansRes.error) console.error("Erreur de chargement des plans :", plansRes.error.message);
    if (sessionsRes.error) console.error("Erreur de chargement des séances :", sessionsRes.error.message);
    if (exercisesRes.error) console.error("Erreur de chargement des exercices :", exercisesRes.error.message);

    cachedPlans = (plansRes.data || []).map(rowToPlan);
    cachedSessions = (sessionsRes.data || []).map(rowToSession);
    cachedCustomExercises = (exercisesRes.data || []).map(rowToExercise);
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
    deleteSession,
    getHistoryForExercise,
    refresh,
  };
})();
