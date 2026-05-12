-- Harmony Ledger D1 Schema
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  active_family_id TEXT,
  preferences TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  members TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  remarks TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ledgers (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date INTEGER NOT NULL,
  description TEXT,
  total_given REAL DEFAULT 0,
  total_received REAL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  ledger_id TEXT,
  contact_id TEXT,
  type TEXT CHECK(type IN ('give', 'receive')) NOT NULL,
  amount REAL NOT NULL,
  person_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  timestamp INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_active_family ON users(active_family_id);
CREATE INDEX IF NOT EXISTS idx_contacts_family ON contacts(family_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_family ON ledgers(family_id);
CREATE INDEX IF NOT EXISTS idx_records_family ON records(family_id);
CREATE INDEX IF NOT EXISTS idx_records_ledger ON records(ledger_id);
CREATE INDEX IF NOT EXISTS idx_records_contact ON records(contact_id);
CREATE INDEX IF NOT EXISTS idx_records_timestamp ON records(timestamp);