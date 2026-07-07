CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  household_label TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invited_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_placeholder INTEGER DEFAULT 0,
  attending INTEGER,
  dietary_restrictions TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_guests_invite ON invited_guests(invite_id);
