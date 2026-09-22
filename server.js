const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'kccitm-attendance-dev-secret-change-in-production';
const DB_FILE = path.join(__dirname, 'attendance-data.json');

function emptyDb() {
  return { users: [], subjects: [], attendance: [], nextIds: { users: 1, subjects: 1, attendance: 1 } };
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return emptyDb();
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return Object.assign(emptyDb(), data);
  } catch (e) {
    console.error('Could not read attendance-data.json:', e.message);
    return emptyDb();
  }
}

let db = loadDb();
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}
function nextId(type) { return db.nextIds[type]++; }
function findUserByEmail(email) { return db.users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase()); }
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, course: u.course, year: u.year };
}

function seed() {
  if (db.users.length > 0) return;
  const admin = { id: nextId('users'), name: 'KCCITM Admin', email: 'admin@kccitm.org', password: bcrypt.hashSync('admin123', 10), role: 'admin', course: 'CSE', year: '2nd Year' };
  const student = { id: nextId('users'), name: 'Sharav Singh', email: 'student@kccitm.org', password: bcrypt.hashSync('student123', 10), role: 'student', course: 'CSE', year: '2nd Year' };
  db.users.push(admin, student);

  const subjects = [
    ['Data Structures', 'KCS301'],
    ['Digital Electronics', 'KCS302'],
    ['Computer Organization', 'KCS303'],
    ['Mathematics IV', 'KAS401'],
    ['Technical Communication', 'KHU401'],
    ['Python Programming', 'KCS304']
  ];
  const createdSubjects = subjects.map(([name, code]) => {
    const s = { id: nextId('subjects'), name, code, teacher_id: null };
    db.subjects.push(s);
    return s;
  });

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    for (const subject of createdSubjects) {
      if (i % 6 !== 0) {
        db.attendance.push({
          id: nextId('attendance'),
          student_id: student.id,
          subject_id: subject.id,
          date,
          status: i % 5 === 0 ? 'absent' : 'present'
        });
      }
    }
  }
  saveDb();
}
seed();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required' });
    req.user = jwt.verify(h.slice(7), SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
function role(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Access denied' });
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = findUserByEmail(email);
  if (!u || !bcrypt.compareSync(password || '', u.password)) return res.status(401).json({ error: 'Invalid email or password' });
  const user = publicUser(u);
  const token = jwt.sign(user, SECRET, { expiresIn: '8h' });
  res.json({ token, user });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, course = 'CSE', year = '2nd Year' } = req.body || {};
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Name, email and password (6+ chars) are required' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
  const u = { id: nextId('users'), name: String(name).trim(), email: String(email).trim(), password: bcrypt.hashSync(password, 10), role: 'student', course, year };
  db.users.push(u); saveDb();
  res.status(201).json({ message: 'Registration successful', id: u.id });
});

app.get('/api/me', auth, (req, res) => res.json(req.user));

app.get('/api/subjects', auth, (req, res) => {
  res.json([...db.subjects].sort((a,b) => a.name.localeCompare(b.name)).map(s => ({ id: s.id, name: s.name, code: s.code })));
});

app.get('/api/dashboard', auth, (req, res) => {
  const studentId = req.user.role === 'student' ? req.user.id : Number(req.query.studentId);
  if (!studentId) return res.status(400).json({ error: 'studentId required' });
  const rows = db.subjects.map(s => {
    const records = db.attendance.filter(a => a.subject_id === s.id && a.student_id === studentId);
    const present = records.filter(a => a.status === 'present').length;
    return { id: s.id, name: s.name, code: s.code, total: records.length, present, absent: records.length - present, percent: records.length ? Math.round(present * 100 / records.length) : 0 };
  }).sort((a,b) => a.name.localeCompare(b.name));
  const total = rows.reduce((a,x) => a + x.total, 0);
  const present = rows.reduce((a,x) => a + x.present, 0);
  res.json({ subjects: rows, total, present, absent: total - present, percent: total ? Math.round(present * 100 / total) : 0 });
});

app.get('/api/history', auth, (req, res) => {
  const studentId = req.user.role === 'student' ? req.user.id : Number(req.query.studentId);
  const rows = db.attendance.filter(a => a.student_id === studentId).map(a => {
    const s = db.subjects.find(x => x.id === a.subject_id);
    return { id: a.id, date: a.date, status: a.status, subject: s ? s.name : 'Unknown', code: s ? s.code : '' };
  }).sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 300);
  res.json(rows);
});

app.post('/api/attendance', auth, role('admin', 'teacher'), (req, res) => {
  const { studentId, subjectId, date, status } = req.body || {};
  if (!studentId || !subjectId || !date || !['present','absent'].includes(status)) return res.status(400).json({ error: 'Invalid attendance data' });
  const student = db.users.find(u => u.id === Number(studentId) && u.role === 'student');
  const subject = db.subjects.find(s => s.id === Number(subjectId));
  if (!student || !subject) return res.status(404).json({ error: 'Student or subject not found' });
  let record = db.attendance.find(a => a.student_id === Number(studentId) && a.subject_id === Number(subjectId) && a.date === date);
  if (record) record.status = status;
  else { record = { id: nextId('attendance'), student_id: Number(studentId), subject_id: Number(subjectId), date, status }; db.attendance.push(record); }
  saveDb();
  res.json({ message: 'Attendance saved' });
});

app.get('/api/students', auth, role('admin', 'teacher'), (req, res) => {
  res.json(db.users.filter(u => u.role === 'student').sort((a,b) => a.name.localeCompare(b.name)).map(publicUser));
});

app.post('/api/subjects', auth, role('admin'), (req, res) => {
  const { name, code } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  if (db.subjects.some(s => s.code.toLowerCase() === String(code).toLowerCase())) return res.status(409).json({ error: 'Subject code already exists' });
  const s = { id: nextId('subjects'), name: String(name).trim(), code: String(code).trim().toUpperCase(), teacher_id: null };
  db.subjects.push(s); saveDb();
  res.status(201).json({ id: s.id, name: s.name, code: s.code });
});

app.delete('/api/subjects/:id', auth, role('admin'), (req, res) => {
  const id = Number(req.params.id);
  db.subjects = db.subjects.filter(s => s.id !== id);
  db.attendance = db.attendance.filter(a => a.subject_id !== id);
  saveDb();
  res.json({ message: 'Subject deleted' });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`KCCITM Attendance running at http://localhost:${PORT}`));
