# 💍 Свадебный сайт — Амина и Асылжан

Персонализированный свадебный сайт с системой RSVP-приглашений. Каждый гость получает уникальную ссылку для подтверждения участия, а пара видит все ответы в удобной админ-панели.

## Технологии

| Компонент | Технология |
|-----------|------------|
| Фронтенд | [Astro](https://astro.build/) — статический сайт, минимум клиентского JS |
| Бэкенд | Node.js + Express — лёгкий API-сервер |
| База данных | SQLite — через `better-sqlite3` |
| Контейнеризация | Docker + Docker Compose |
| Хостинг фронтенда | Cloudflare Pages (или Netlify) |
| Хостинг бэкенда | Docker на домашнем сервере + Cloudflare Tunnel |

## Структура проекта

```
wedding-site/
├── frontend/               # Astro — фронтенд
│   ├── src/
│   │   ├── pages/          # Страницы (/, /rsvp/[token], /admin)
│   │   ├── components/     # Компоненты
│   │   └── layouts/        # Макеты
│   └── astro.config.mjs
├── backend/                # Express — API
│   ├── src/
│   │   ├── index.ts        # Точка входа
│   │   ├── routes/         # Маршруты API
│   │   └── db.ts           # Инициализация SQLite
│   ├── data/               # Директория для wedding.db
│   └── Dockerfile
├── scripts/                # CLI-утилиты
│   ├── generate-invites.ts # Генерация приглашений из CSV
│   ├── sample-guests.csv   # Пример CSV файла
│   └── package.json
├── docker-compose.yml      # Запуск бэкенда в контейнере
├── .env.example            # Шаблон переменных окружения
└── README.md
```

## Быстрый старт (локальная разработка)

### Требования

- [Node.js](https://nodejs.org/) 20+ и npm
- (Для Docker-деплоя) Docker и Docker Compose

### 1. Клонирование и установка

```bash
git clone <url-репозитория>
cd wedding-site
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Отредактируйте `.env` — как минимум задайте `ADMIN_PASSWORD`.

### 3. Запуск бэкенда

```bash
cd backend
npm install
npm run dev
```

Бэкенд запустится на `http://localhost:3000`. База данных SQLite создастся автоматически в `backend/data/wedding.db`.

### 4. Запуск фронтенда

```bash
cd frontend
npm install
npm run dev
```

Фронтенд запустится на `http://localhost:4321`.

### 5. Открыть в браузере

Перейдите по адресу [http://localhost:4321](http://localhost:4321).

## Генерация приглашений

Скрипт `generate-invites.ts` создаёт записи в базе данных из CSV-файла и генерирует уникальные RSVP-ссылки.

### Формат CSV

```csv
household_label,guest_names,plus_one_slots
"Семья Ивановых","Анна Иванова;Пётр Иванов",0
"Алия Нурланова","Алия Нурланова",1
"Семья Сериковых","Дана Серикова;Марат Сериков;Айгуль Серикова",0
```

| Колонка | Описание |
|---------|----------|
| `household_label` | Название приглашения (семья или имя гостя) |
| `guest_names` | Имена гостей, разделённые точкой с запятой (`;`) |
| `plus_one_slots` | Количество дополнительных мест (плюс-один) |

### Запуск

```bash
cd scripts
npm install
npm run generate -- path/to/guests.csv
```

Пример с тестовым файлом:

```bash
npm run generate -- sample-guests.csv
```

### Результат

Скрипт выведет в консоль и сохранит в файл `scripts/output-invites.csv`:

```csv
household_label,rsvp_url
Семья Ивановых,http://localhost:4321/rsvp/ab3kx7mn
Алия Нурланова,http://localhost:4321/rsvp/p9wq4efs
Семья Сериковых,http://localhost:4321/rsvp/h2vc8jrt
```

Эти ссылки можно использовать для рассылки через мессенджеры, email или для генерации QR-кодов.

### Дедупликация

Скрипт проверяет поле `household_label` в базе данных. Если запись с таким названием уже существует, она будет пропущена с предупреждением. Это позволяет безопасно запускать скрипт повторно — дубликаты не создаются.

### Переменные окружения для скрипта

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `DATABASE_PATH` | `../backend/data/wedding.db` | Путь к файлу SQLite |
| `SITE_URL` | `http://localhost:4321` | Базовый URL сайта для формирования ссылок |

## Деплой

### Фронтенд → Cloudflare Pages

#### Вариант 1: Подключение репозитория

1. Зайдите в [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages → «Create a project»
2. Подключите Git-репозиторий
3. Настройте сборку:
   - **Build command:** `cd frontend && npm install && npm run build`
   - **Build output directory:** `frontend/dist`
4. Добавьте переменную окружения:
   - `PUBLIC_API_URL` = `https://api.your-domain.com`

#### Вариант 2: Ручной деплой через CLI

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=wedding-site
```

> **Примечание:** Netlify также поддерживается — настройка аналогична.

### Бэкенд → Docker + Cloudflare Tunnel

#### 1. Запуск бэкенда в Docker

```bash
# В корне проекта
cp .env.example .env
# Отредактируйте .env — задайте ADMIN_PASSWORD и другие значения

docker compose up -d --build
```

Проверка статуса:

```bash
docker compose ps
docker compose logs -f backend
```

#### 2. Настройка Cloudflare Tunnel

Установите `cloudflared`:

```bash
# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# macOS
brew install cloudflare/cloudflare/cloudflared

# Windows
winget install --id Cloudflare.cloudflared
```

Аутентификация и создание туннеля:

```bash
cloudflared tunnel login
cloudflared tunnel create wedding-api
cloudflared tunnel route dns wedding-api api.your-domain.com
```

Создайте файл конфигурации `~/.cloudflared/config.yml`:

```yaml
tunnel: wedding-api
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

Запуск туннеля:

```bash
cloudflared tunnel run wedding-api
```

> **Важно:** Замените `your-domain.com` на ваш реальный домен и `<TUNNEL_ID>` на ID созданного туннеля.

## Переменные окружения

| Переменная | Обязательная | По умолчанию | Описание |
|------------|:------------:|-------------|----------|
| `DATABASE_PATH` | Нет | `/app/data/wedding.db` | Путь к файлу базы данных SQLite |
| `ADMIN_PASSWORD` | **Да** | — | Пароль для доступа к админ-панели |
| `PORT` | Нет | `3000` | Порт API-сервера |
| `PUBLIC_API_URL` | **Да** | — | URL API для фронтенда (например, `https://api.your-domain.com`) |
| `SITE_URL` | Нет | `http://localhost:4321` | Базовый URL сайта (для генерации ссылок) |
| `EMAIL_API_KEY` | Нет | — | API-ключ почтового сервиса (Resend / Postmark). Если не задан — уведомления отключены |
| `COUPLE_NOTIFICATION_EMAIL` | Нет | — | Email пары для уведомлений о новых RSVP |
| `FRONTEND_URL` | Нет | — | URL фронтенда (для ссылок в письмах) |
| `RSVP_DEADLINE_DATE` | Нет | — | Крайний срок подтверждения (формат: `YYYY-MM-DD`) |

## API эндпоинты

### Публичные

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/health` | Проверка состояния сервера |
| `GET` | `/api/invite/:token` | Получить данные приглашения по токену |
| `POST` | `/api/invite/:token/rsvp` | Отправить/обновить RSVP-ответ |

### Админ (требуется пароль)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/admin/invites` | Список всех приглашений с гостями |
| `GET` | `/api/admin/export.csv` | Экспорт полного списка гостей в CSV |

Аутентификация админ-запросов осуществляется через заголовок `Authorization` или параметр запроса с паролем, заданным в переменной `ADMIN_PASSWORD`.

## Админ-панель

Админ-панель доступна по адресу `/admin` на фронтенде.

### Возможности

- **Просмотр** всех приглашений и гостей в табличном виде
- **Фильтрация** по статусу: ответили / не ответили / отказались
- **Сортировка** по дате ответа, имени и другим полям
- **Экспорт** полного списка гостей в CSV (для передачи в ресторан/на площадку)

### Доступ

При входе на страницу `/admin` потребуется ввести пароль, заданный в переменной окружения `ADMIN_PASSWORD`.

## Лицензия

MIT © 2026
