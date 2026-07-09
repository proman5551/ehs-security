const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { ROLES } = require("../db");

const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return { token, expiresAt };
}

function destroySession(db, token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// 세션 토큰으로 사용자 조회 — 만료되었으면 null 반환(자동 삭제)
function getUserBySessionToken(db, token) {
  if (!token) return null;
  const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  const user = db.prepare("SELECT id, username, name, department, contact, role, created_at FROM users WHERE id = ?").get(session.user_id);
  return user || null;
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    // NOTE: HTTPS 배포(Codespaces 등) 시 secure:true 로 전환 권장. 로컬 http 개발 호환을 위해 기본값은 false.
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE);
}

// 요청에서 현재 로그인 사용자를 조회(있으면 req.user 설정, 없으면 null) — 라우트 핸들러 내부에서 직접 호출용
function resolveUser(req) {
  const db = req.app.locals.db;
  const token = req.cookies?.[SESSION_COOKIE];
  return getUserBySessionToken(db, token);
}

// 로그인 필수 미들웨어
function requireAuth(req, res, next) {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
  req.user = user;
  next();
}

// requireAuth 이후에 사용 — 지정된 역할만 통과
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "로그인이 필요합니다." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "이 작업을 수행할 권한이 없습니다." });
    }
    next();
  };
}

module.exports = {
  ROLES,
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getUserBySessionToken,
  setSessionCookie,
  clearSessionCookie,
  resolveUser,
  requireAuth,
  requireRole,
};
