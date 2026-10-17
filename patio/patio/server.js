const express = require('express'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), multer = require('multer');
const db = require('./db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) { console.error('Defina JWT_SECRET (16+ caracteres) no arquivo .env'); process.exit(1); }
const PORT = process.env.PORT || 3000;
const UP = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UP, { recursive: true });

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(UP, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/v/:slug', (q, r) => r.sendFile(path.join(__dirname, 'public', 'vitrine.html')));

const IMG = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMG[f.mimetype]) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (q, f, cb) => cb(null, !!IMG[f.mimetype]),
});

// ---------- auth ----------
const tries = new Map();
const limit = (key) => { const n = (tries.get(key) || 0) + 1; tries.set(key, n); setTimeout(() => tries.delete(key), 15 * 60e3).unref(); return n > 10; };
const sign = (u) => jwt.sign({ uid: u.id, sid: u.store_id }, SECRET, { expiresIn: '7d' });
const auth = (q, r, next) => {
  try { q.u = jwt.verify((q.headers.authorization || '').slice(7), SECRET); next(); }
  catch { r.status(401).json({ erro: 'Sessão expirada. Entre de novo.' }); }
};
const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'loja';

app.post('/api/register', (q, r) => {
  const { loja, nome, email, senha } = q.body || {};
  if (!loja || !nome || !/^\S+@\S+\.\S+$/.test(email || '') || (senha || '').length < 8)
    return r.status(400).json({ erro: 'Preencha loja, nome, e-mail válido e senha com 8+ caracteres.' });
  const mail = email.toLowerCase().trim();
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(mail)) return r.status(409).json({ erro: 'Este e-mail já tem cadastro.' });
  let slug = slugify(loja);
  while (db.prepare('SELECT 1 FROM stores WHERE slug=?').get(slug)) slug += '-' + crypto.randomInt(100, 999);
  const u = db.transaction(() => {
    const sid = db.prepare('INSERT INTO stores (slug,nome) VALUES (?,?)').run(slug, loja.trim()).lastInsertRowid;
    const uid = db.prepare('INSERT INTO users (store_id,nome,email,hash) VALUES (?,?,?,?)').run(sid, nome.trim(), mail, bcrypt.hashSync(senha, 10)).lastInsertRowid;
    return { id: uid, store_id: sid };
  })();
  r.json({ token: sign(u) });
});

app.post('/api/login', (q, r) => {
  const mail = String(q.body?.email || '').toLowerCase().trim();
  if (limit(q.ip + mail)) return r.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos.' });
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(mail);
  if (!u || !bcrypt.compareSync(String(q.body?.senha || ''), u.hash)) return r.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  r.json({ token: sign(u) });
});

// ---------- helpers ----------
const pick = (b, text, nums) => {
  const o = {};
  for (const k of text) if (b[k] !== undefined) o[k] = String(b[k]).trim().slice(0, 200);
  for (const k of nums) if (b[k] !== undefined) o[k] = Number(b[k]) || 0;
  return o;
};
const insert = (table, sid, o) => {
  const k = Object.keys(o);
  return db.prepare(`INSERT INTO ${table} (store_id${k.map((x) => ',' + x).join('')}) VALUES (?${k.map(() => ',?').join('')})`).run(sid, ...Object.values(o)).lastInsertRowid;
};
const update = (table, id, sid, o) => {
  const k = Object.keys(o);
  if (!k.length) return 0;
  return db.prepare(`UPDATE ${table} SET ${k.map((x) => x + '=?').join(',')} WHERE id=? AND store_id=?`).run(...Object.values(o), id, sid).changes;
};
const owns = (table, id, sid) => db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND store_id=?`).get(id, sid);
const carsOf = (sid, onlyOpen) => {
  const cars = db.prepare(`SELECT * FROM cars WHERE store_id=? ${onlyOpen ? "AND status!='vendido'" : ''} ORDER BY id DESC`).all(sid);
  const ph = db.prepare('SELECT p.id,p.car_id,p.arquivo FROM photos p JOIN cars c ON c.id=p.car_id WHERE c.store_id=? ORDER BY p.ordem,p.id').all(sid);
  return cars.map((c) => ({ ...c, fotos: ph.filter((p) => p.car_id === c.id).map((p) => ({ id: p.id, url: '/uploads/' + p.arquivo })) }));
};
const CAR_T = ['marca', 'modelo', 'placa', 'status'], CAR_N = ['ano', 'km', 'compra', 'custos', 'preco', 'fipe'];
const carData = (b) => {
  const o = pick(b, CAR_T, CAR_N);
  if (o.placa) o.placa = o.placa.toUpperCase();
  if (o.status && !['disponivel', 'reservado', 'vendido'].includes(o.status)) o.status = 'disponivel';
  return o;
};

// ---------- público ----------
app.get('/api/public/:slug', (q, r) => {
  const s = db.prepare('SELECT id,slug,nome,slogan,tel FROM stores WHERE slug=?').get(q.params.slug);
  if (!s) return r.status(404).json({ erro: 'Loja não encontrada.' });
  const cars = carsOf(s.id, true).map(({ id, marca, modelo, ano, km, placa, preco, status, fotos }) => ({ id, marca, modelo, ano, km, placa, preco, status, fotos }));
  r.json({ loja: { nome: s.nome, slogan: s.slogan, tel: s.tel }, cars });
});

// ---------- painel (tudo abaixo exige login) ----------
app.use('/api', auth);

app.get('/api/me', (q, r) => r.json(db.prepare('SELECT slug,nome,slogan,tel,comis FROM stores WHERE id=?').get(q.u.sid)));
app.put('/api/loja', (q, r) => {
  const o = pick(q.body, ['nome', 'slogan', 'tel'], ['comis']), k = Object.keys(o);
  if (k.length) db.prepare(`UPDATE stores SET ${k.map((x) => x + '=?').join(',')} WHERE id=?`).run(...Object.values(o), q.u.sid);
  r.json({ ok: true });
});

app.get('/api/cars', (q, r) => r.json(carsOf(q.u.sid, false)));
app.post('/api/cars', (q, r) => r.json({ id: insert('cars', q.u.sid, carData(q.body)) }));
app.put('/api/cars/:id', (q, r) => (update('cars', +q.params.id, q.u.sid, carData(q.body)) ? r.json({ ok: true }) : r.sendStatus(404)));
app.delete('/api/cars/:id', (q, r) => {
  if (!owns('cars', +q.params.id, q.u.sid)) return r.sendStatus(404);
  if (db.prepare('SELECT 1 FROM sales WHERE car_id=?').get(+q.params.id)) return r.status(409).json({ erro: 'Este carro tem venda registrada e não pode ser excluído.' });
  const files = db.prepare('SELECT arquivo FROM photos WHERE car_id=?').all(+q.params.id);
  db.prepare('DELETE FROM cars WHERE id=?').run(+q.params.id);
  files.forEach((f) => fs.rm(path.join(UP, f.arquivo), () => {}));
  r.json({ ok: true });
});
app.post('/api/cars/:id/photos', upload.array('fotos', 10), (q, r) => {
  if (!owns('cars', +q.params.id, q.u.sid)) { (q.files || []).forEach((f) => fs.rm(f.path, () => {})); return r.sendStatus(404); }
  const add = db.prepare('INSERT INTO photos (car_id,arquivo) VALUES (?,?)');
  (q.files || []).forEach((f) => add.run(+q.params.id, f.filename));
  r.json({ ok: true });
});
app.delete('/api/photos/:id', (q, r) => {
  const p = db.prepare('SELECT p.id,p.arquivo FROM photos p JOIN cars c ON c.id=p.car_id WHERE p.id=? AND c.store_id=?').get(+q.params.id, q.u.sid);
  if (!p) return r.sendStatus(404);
  db.prepare('DELETE FROM photos WHERE id=?').run(p.id);
  fs.rm(path.join(UP, p.arquivo), () => {});
  r.json({ ok: true });
});

const LEAD_T = ['nome', 'tel', 'interesse', 'origem', 'retorno'], LEAD_N = ['valor', 'etapa'];
app.get('/api/leads', (q, r) => r.json(db.prepare('SELECT * FROM leads WHERE store_id=? ORDER BY id DESC').all(q.u.sid)));
app.post('/api/leads', (q, r) => r.json({ id: insert('leads', q.u.sid, pick(q.body, LEAD_T, LEAD_N)) }));
app.put('/api/leads/:id', (q, r) => (update('leads', +q.params.id, q.u.sid, pick(q.body, LEAD_T, LEAD_N)) ? r.json({ ok: true }) : r.sendStatus(404)));
app.delete('/api/leads/:id', (q, r) => { db.prepare('DELETE FROM leads WHERE id=? AND store_id=?').run(+q.params.id, q.u.sid); r.json({ ok: true }); });

app.get('/api/sales', (q, r) => r.json(db.prepare('SELECT * FROM sales WHERE store_id=? ORDER BY id DESC').all(q.u.sid).map((s) => ({ ...s, docs: JSON.parse(s.docs) }))));
app.post('/api/sales', (q, r) => {
  const car = db.prepare('SELECT * FROM cars WHERE id=? AND store_id=?').get(+q.body?.car_id, q.u.sid);
  if (!car || car.status === 'vendido') return r.status(400).json({ erro: 'Veículo inválido ou já vendido.' });
  db.transaction(() => {
    insert('sales', q.u.sid, { car_id: car.id, vendedor: String(q.body.vendedor || '').slice(0, 80), pgto: String(q.body.pgto || '').slice(0, 40), valor: Number(q.body.valor) || car.preco });
    db.prepare("UPDATE cars SET status='vendido' WHERE id=?").run(car.id);
  })();
  r.json({ ok: true });
});
app.put('/api/sales/:id/docs', (q, r) => {
  const docs = Array.isArray(q.body?.docs) ? q.body.docs.slice(0, 5).map((x) => (x ? 1 : 0)) : null;
  if (!docs) return r.sendStatus(400);
  db.prepare('UPDATE sales SET docs=? WHERE id=? AND store_id=?').run(JSON.stringify(docs), +q.params.id, q.u.sid);
  r.json({ ok: true });
});

app.use((e, q, r, n) => { console.error(e); r.status(500).json({ erro: 'Erro interno.' }); });
app.listen(PORT, () => console.log(`Pátio rodando em http://localhost:${PORT}`));
