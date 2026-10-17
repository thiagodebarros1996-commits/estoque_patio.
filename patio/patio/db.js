const Database = require('better-sqlite3');
const db = new Database(process.env.DB_FILE || 'data.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, nome TEXT NOT NULL,
  slogan TEXT DEFAULT 'Seminovos revisados. Aceitamos troca e financiamos em até 60x.',
  tel TEXT DEFAULT '', comis REAL DEFAULT 10, criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, email TEXT UNIQUE NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  marca TEXT, modelo TEXT, ano INTEGER, km INTEGER, placa TEXT,
  compra REAL DEFAULT 0, custos REAL DEFAULT 0, preco REAL DEFAULT 0, fipe REAL DEFAULT 0,
  status TEXT DEFAULT 'disponivel', criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS i_cars_store ON cars(store_id);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY, car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  arquivo TEXT NOT NULL, ordem INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  nome TEXT, tel TEXT, interesse TEXT, valor REAL DEFAULT 0, etapa INTEGER DEFAULT 0,
  origem TEXT DEFAULT 'Balcão', retorno TEXT, criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS i_leads_store ON leads(store_id);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  car_id INTEGER NOT NULL REFERENCES cars(id), vendedor TEXT, pgto TEXT, valor REAL,
  docs TEXT DEFAULT '[0,0,0,0,0]', criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS i_sales_store ON sales(store_id);
`);
module.exports = db;
