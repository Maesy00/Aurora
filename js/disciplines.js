/*
 * Config partagée des 5 disciplines : couleur, icône, et si la distance
 * a du sens pour elles. Réutilisée par le formulaire, l'historique et
 * le bilan pour rester cohérent partout dans l'appli.
 */

const DISCIPLINES = [
  {
    id: "running",
    label: "Course à pied",
    color: "var(--color-running)",
    hasDistance: true,
    icon: `<circle cx="12" cy="5" r="2"/><path d="M9 21l2.5-4 1.5-2.5-1.5-3-3.5 1M14 12l2.5 2 2 5.5M10.5 8.5l3-2 3 1"/>`,
  },
  {
    id: "swimming",
    label: "Natation",
    color: "var(--color-swimming)",
    hasDistance: true,
    icon: `<path d="M3 16c1.8-2 3.6 2 5.4 0s3.6-2 5.4 0s3.6 2 5.4 0M3 20c1.8-2 3.6 2 5.4 0s3.6-2 5.4 0s3.6 2 5.4 0"/><circle cx="16" cy="6" r="2"/><path d="M6 12l4-2 3 3-2 3"/>`,
  },
  {
    id: "cycling",
    label: "Vélo",
    color: "var(--color-cycling)",
    hasDistance: true,
    icon: `<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-8h4l4 8M10 9h4M9.5 17h5"/>`,
  },
  {
    id: "strength",
    label: "Musculation",
    color: "var(--color-strength)",
    hasDistance: false,
    icon: `<rect x="2.5" y="9" width="3" height="6" rx="1"/><rect x="18.5" y="9" width="3" height="6" rx="1"/><path d="M5.5 12h13"/><rect x="7" y="7.5" width="2.5" height="9" rx="1"/><rect x="14.5" y="7.5" width="2.5" height="9" rx="1"/>`,
  },
  {
    id: "yoga",
    label: "Yoga / Pilates",
    color: "var(--color-yoga)",
    hasDistance: false,
    icon: `<circle cx="12" cy="5" r="2"/><path d="M12 7v5M12 12l-5 3 1.5 3M12 12l5 3-1.5 3M8 10l4 2 4-2"/>`,
  },
];
