const express = require("express");
const { ROLES, requireAuth, requireRole, hashPassword } = require("../lib/auth");

const router = express.Router();

const PUBLIC_FIELDS = "id, username, name, department, contact, role, created_at";

router.use(requireAuth, requireRole("시스템 어드민"));

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  res.json(db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY id`).all());
});

router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { username, password, name, department, contact, role } = req.body || {};
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: "username, password, name, role이 필요합니다." });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `role은 ${ROLES.join(", ")} 중 하나여야 합니다.` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "비밀번호는 8자 이상이어야 합니다." });
  }

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "이미 존재하는 아이디입니다." });

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, name, department, contact, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, hashPassword(password), name, department || "", contact || "", role);

  res.status(201).json(db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(result.lastInsertRowid));
});

router.put("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "계정을 찾을 수 없습니다." });

  const { name, department, contact, role, password } = req.body || {};
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ error: `role은 ${ROLES.join(", ")} 중 하나여야 합니다.` });
  }
  if (password && password.length < 8) {
    return res.status(400).json({ error: "비밀번호는 8자 이상이어야 합니다." });
  }

  db.prepare(`
    UPDATE users SET name = ?, department = ?, contact = ?, role = ?,
      password_hash = ?
    WHERE id = ?
  `).run(
    name ?? row.name,
    department ?? row.department,
    contact ?? row.contact,
    role ?? row.role,
    password ? hashPassword(password) : row.password_hash,
    id
  );

  res.json(db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id));
});

router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: "본인 계정은 삭제할 수 없습니다." });
  }
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "계정을 찾을 수 없습니다." });
  res.status(204).end();
});

module.exports = router;
