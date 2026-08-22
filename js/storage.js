/*
 * Storage.js — seul endroit qui lit/écrit les données de séances.
 * Parle à la base Supabase en ligne (synchronisée entre appareils).
 * getSessions() reste synchrone : elle lit un cache local mis à jour
 * après chaque appel réseau, pour ne pas avoir à réécrire tout
 * l'affichage de l'app en asynchrone.
 */

const Storage = (() => {
  let cachedSessions = [];

  function rowToSession(row) {
    return {
      id: row.id,
      discipline: row.discipline,
      date: row.date,
      durationMinutes: row.duration_minutes,
      distanceKm: row.distance_km,
      notes: row.notes || "",
    };
  }

  function sessionToRow(session, userId) {
    return {
      user_id: userId,
      discipline: session.discipline,
      date: session.date,
      duration_minutes: session.durationMinutes,
      distance_km: session.distanceKm,
      notes: session.notes || "",
    };
  }

  function getSessions() {
    return cachedSessions;
  }

  async function refresh() {
    const { data, error } = await supabaseClient
      .from("sessions")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Erreur de chargement des séances :", error.message);
      return;
    }

    cachedSessions = data.map(rowToSession);
  }

  async function addSession(session) {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient
      .from("sessions")
      .insert(sessionToRow(session, user.id));

    if (error) {
      console.error("Erreur d'enregistrement :", error.message);
      return;
    }

    await refresh();
  }

  async function addSessions(sessions) {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    const rows = sessions.map((s) => sessionToRow(s, user.id));
    const { error } = await supabaseClient.from("sessions").insert(rows);

    if (error) {
      console.error("Erreur d'import :", error.message);
      return;
    }

    await refresh();
  }

  async function updateSession(id, updates) {
    const { error } = await supabaseClient
      .from("sessions")
      .update({
        discipline: updates.discipline,
        date: updates.date,
        duration_minutes: updates.durationMinutes,
        distance_km: updates.distanceKm,
        notes: updates.notes || "",
      })
      .eq("id", id);

    if (error) {
      console.error("Erreur de modification :", error.message);
      return;
    }

    await refresh();
  }

  async function deleteSession(id) {
    const { error } = await supabaseClient.from("sessions").delete().eq("id", id);

    if (error) {
      console.error("Erreur de suppression :", error.message);
      return;
    }

    await refresh();
  }

  return {
    getSessions,
    addSession,
    addSessions,
    updateSession,
    deleteSession,
    refresh,
  };
})();
