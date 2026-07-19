import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { customAlphabet } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';

// URL-safe alphabet without confusing characters (no 0/O, 1/l/I)
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const generateToken = customAlphabet(ALPHABET, 8);

interface CsvRow {
  household_label: string;
  guest_names: string;
  plus_one_slots: string;
}

interface OutputRow {
  household_label: string;
  rsvp_url: string;
}

function main(): void {
  // --- Parse CLI arguments ---
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Ошибка: укажите путь к CSV файлу.');
    console.error('Использование: npm run generate -- <путь-к-csv>');
    console.error('Пример:       npm run generate -- sample-guests.csv');
    process.exit(1);
  }

  const resolvedCsvPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsvPath)) {
    console.error(`Ошибка: файл не найден: ${resolvedCsvPath}`);
    process.exit(1);
  }

  // --- Read config from env ---
  const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'backend', 'data', 'wedding.db');
  const siteUrl = (process.env.SITE_URL || 'http://localhost:4321').replace(/\/+$/, '');

  // Ensure DB directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Создана директория для БД: ${dbDir}`);
  }

  // --- Open database ---
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure tables exist (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      household_label TEXT NOT NULL,
      contact_email TEXT,
      contact_phone TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invited_guests (
      id INTEGER PRIMARY KEY,
      invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      is_placeholder BOOLEAN DEFAULT FALSE,
      attending BOOLEAN,
      dietary_restrictions TEXT
    );
  `);

  // --- Read and parse CSV ---
  const csvContent = fs.readFileSync(resolvedCsvPath, 'utf-8');
  let rows: CsvRow[];

  try {
    rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as CsvRow[];
  } catch (err) {
    console.error('Ошибка при разборе CSV:', (err as Error).message);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.error('Ошибка: CSV файл пуст или не содержит строк с данными.');
    process.exit(1);
  }

  // Validate columns
  const requiredColumns = ['household_label', 'guest_names', 'plus_one_slots'];
  const firstRow = rows[0];
  for (const col of requiredColumns) {
    if (!(col in firstRow)) {
      console.error(`Ошибка: отсутствует обязательная колонка "${col}" в CSV.`);
      console.error(`Ожидаемый формат: ${requiredColumns.join(',')}`);
      process.exit(1);
    }
  }

  // --- Prepare statements ---
  const findExisting = db.prepare('SELECT id FROM invites WHERE household_label = ?');
  const insertInvite = db.prepare(
    'INSERT INTO invites (token, household_label) VALUES (?, ?)'
  );
  const insertGuest = db.prepare(
    'INSERT INTO invited_guests (invite_id, display_name, is_placeholder) VALUES (?, ?, ?)'
  );

  // --- Process rows ---
  const output: OutputRow[] = [];
  let createdCount = 0;
  let skippedCount = 0;

  const processAll = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // +2 because of 0-index + header row

      const householdLabel = row.household_label?.trim();
      if (!householdLabel) {
        console.warn(`⚠ Строка ${lineNum}: пустой household_label, пропущена.`);
        skippedCount++;
        continue;
      }

      // Check for duplicates
      const existing = findExisting.get(householdLabel);
      if (existing) {
        console.warn(`⚠ Строка ${lineNum}: "${householdLabel}" уже существует в БД, пропущена.`);
        skippedCount++;
        continue;
      }

      // Parse guest names
      const guestNamesRaw = row.guest_names?.trim() || '';
      const guestNames = guestNamesRaw
        .split(';')
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);

      if (guestNames.length === 0) {
        console.warn(`⚠ Строка ${lineNum}: "${householdLabel}" — нет имён гостей, пропущена.`);
        skippedCount++;
        continue;
      }

      // Parse plus_one_slots
      const plusOneSlots = parseInt(row.plus_one_slots, 10);
      if (isNaN(plusOneSlots) || plusOneSlots < 0) {
        console.warn(`⚠ Строка ${lineNum}: "${householdLabel}" — некорректное значение plus_one_slots ("${row.plus_one_slots}"), используется 0.`);
      }
      const safePlusOneSlots = isNaN(plusOneSlots) || plusOneSlots < 0 ? 0 : plusOneSlots;

      // Generate unique token
      let token: string;
      let attempts = 0;
      do {
        token = generateToken();
        attempts++;
        if (attempts > 100) {
          throw new Error(`Не удалось сгенерировать уникальный токен для "${householdLabel}" после 100 попыток.`);
        }
      } while (db.prepare('SELECT 1 FROM invites WHERE token = ?').get(token));

      // Insert invite
      const result = insertInvite.run(token, householdLabel);
      const inviteId = result.lastInsertRowid as number;

      // Insert named guests
      for (const guestName of guestNames) {
        insertGuest.run(inviteId, guestName, 0);
      }

      // Insert placeholder guests for plus-one slots
      for (let j = 0; j < safePlusOneSlots; j++) {
        insertGuest.run(inviteId, 'Гость', 1);
      }

      const rsvpUrl = `${siteUrl}/rsvp?token=${token}`;
      output.push({ household_label: householdLabel, rsvp_url: rsvpUrl });
      createdCount++;

      console.log(`✓ "${householdLabel}" → ${rsvpUrl} (${guestNames.length} гостей + ${safePlusOneSlots} доп. мест)`);
    }
  });

  processAll();
  db.close();

  // --- Write output CSV ---
  if (output.length > 0) {
    const outputCsv = stringify(output, {
      header: true,
      columns: ['household_label', 'rsvp_url'],
    });

    // Print to stdout
    console.log('\n--- Результат (CSV) ---');
    console.log(outputCsv);

    // Write to file
    const outputPath = path.resolve(__dirname, 'output-invites.csv');
    fs.writeFileSync(outputPath, outputCsv, 'utf-8');
    console.log(`Файл сохранён: ${outputPath}`);
  }

  // --- Summary ---
  console.log(`\nСоздано ${createdCount} новых приглашений, пропущено ${skippedCount} существующих`);
}

main();
