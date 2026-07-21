const express = require("express");
const {
  verifyPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie, resolveUser, requireAuth, SESSION_COOKIE,
} = require("../lib/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요." });
  }

  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }

  const { token } = createSession(db, row.id);
  setSessionCookie(res, token);
  const { password_hash, ...user } = row;
  res.json({ user });
});

router.post("/logout", (req, res) => {
  const db = req.app.locals.db;
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) destroySession(db, token);
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/me", (req, res) => {
  const user = resolveUser(req);
  res.json({ user });
});

router.patch("/me", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { name, department, contact } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "성명은 비워둘 수 없습니다." });
  }
  db.prepare("UPDATE users SET name = ?, department = ?, contact = ? WHERE id = ?").run(
    name, department || "", contact || "", req.user.id
  );
  const row = db.prepare("SELECT id, username, name, department, contact, role, created_at FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: row });
});

module.exports = router;
