export const SITE_CONFIG = {
  coupleName: "Амина и Асылжан",
  weddingDate: "2026-09-05T15:00:00+05:00",
  rsvpDeadline: "15 августа 2026",
  rsvpDeadlineISO: "2026-08-15",
  venue: {
    name: 'Дворец торжеств "Мирас"',
    hall: "Сиреневый зал",
    address: "проспект Аль-Фараби, 216, г. Алматы",
    mapUrl: "https://go.2gis.com/zICkn",
  },
  gatheringTime: "16:00",
  dressCode: "Свободный",
  contact: {
    phone: "+7 (705) 111-61-74",
    email: "a_sarinov@mail.ru",
    telegram: "@Longnaben",
    whatsapp: "+77051116174",
  },
  apiBaseUrl:
    typeof window !== "undefined"
      ? import.meta.env.PUBLIC_API_URL || ""
      : "",
} as const;
