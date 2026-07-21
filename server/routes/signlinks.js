const express = require("express");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();
const CAN_ISSUE = ["시스템 어드민", "슈퍼 EHS", "EHS", "Security"];

router.use(requireAuth);

function rowToSignLink(row) {
  return {
    permitId: row.permit_id,
    worker: row.worker,
    contact: row.contact,
    time: row.time,
  };
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM sign_links ORDER BY created_at DESC, id DESC").all();
  res.json(rows.map(rowToSignLink));
});

router.post("/", requireRole(...CAN_ISSUE), (req, res) => {
  const db = req.app.locals.db;
  const { permitId, worker, contact, time } = req.body || {};
  if (!permitId || !worker || !contact) {
    return res.status(400).json({ error: "permitId, worker, contact가 필요합니다." });
  }
  const sentTime = time || new Date().toLocaleTimeString("ko-KR", { hour12: false });

  db.prepare(
    "INSERT INTO sign_links (permit_id, worker, contact, time) VALUES (?, ?, ?, ?)"
  ).run(permitId, worker, contact, sentTime);

  res.status(201).json({ permitId, worker, contact, time: sentTime });
});

module.exports = router;
