/*
 * Storage.js — seul endroit qui lit/écrit les données de séances.
 * Aujourd'hui : stockage local du navigateur (localStorage).
 * Demain : si on veut une synchro multi-appareils, on ne changera
 * que le contenu de ces fonctions (ex: appels à une base en ligne),
 * sans toucher au reste de l'application.
 */

const Storage = (() => {
  const KEY = "tritrack.sessions";

  function getSessions() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }

  function saveSessions(sessions) {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  }

  function addSession(session) {
    const sessions = getSessions();
    session.id = crypto.randomUUID();
    sessions.push(session);
    saveSessions(sessions);
    return session;
  }

  function updateSession(id, updates) {
    const sessions = getSessions();
    const index = sessions.findIndex((s) => s.id === id);
    if (index === -1) return null;
    sessions[index] = { ...sessions[index], ...updates };
    saveSessions(sessions);
    return sessions[index];
  }

  function deleteSession(id) {
    const sessions = getSessions().filter((s) => s.id !== id);
    saveSessions(sessions);
  }

  return { getSessions, addSession, updateSession, deleteSession };
})();
