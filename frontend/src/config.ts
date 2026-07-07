export const SITE_CONFIG = {
  coupleName: 'Амина и Асылжан',
  weddingDate: '2026-09-05T15:00:00+06:00',
  rsvpDeadline: '20 августа 2026',
  rsvpDeadlineISO: '2026-08-20',
  venue: {
    name: 'Дворец торжеств "Мирас"',
    hall: 'Сиреневый зал',
    address: 'проспект Аль-Фараби, 216, г. Алматы',
    mapUrl: 'https://2gis.kz/almaty/search/%D0%94%D0%B2%D0%BE%D1%80%D0%B5%D1%86%20%D1%82%D0%BE%D1%80%D0%B6%D0%B5%D1%81%D1%82%D0%B2%20%D0%9C%D0%B8%D1%80%D0%B0%D1%81',
  },
  gatheringTime: '15:00',
  dressCode: 'Свободный',
  contact: {
    phone: '+7 (XXX) XXX-XX-XX',
    email: 'example@mail.com',
    telegram: '@example',
    whatsapp: '+7XXXXXXXXXX',
  },
  apiBaseUrl: typeof window !== 'undefined'
    ? (import.meta.env.PUBLIC_API_URL || 'http://localhost:3000')
    : 'http://localhost:3000',
} as const;
