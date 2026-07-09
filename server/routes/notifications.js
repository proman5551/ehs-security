const express = require("express");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();
const CAN_EDIT = ["시스템 어드민", "슈퍼 EHS", "EHS"];

router.use(requireAuth);

router.get("/settings", (req, res) => {
  const db = req.app.locals.db;
  res.json(db.prepare("SELECT * FROM notification_settings ORDER BY grade, id").all());
});

router.post("/settings", requireRole(...CAN_EDIT), (req, res) => {
  const db = req.app.locals.db;
  const { grade, department, recipientName, recipientContact, channel } = req.body || {};
  if (!grade || !department || !recipientName || !recipientContact) {
    return res.status(400).json({ error: "grade, department, recipientName, recipientContact가 필요합니다." });
  }
  if (!["A", "B", "C"].includes(grade)) {
    return res.status(400).json({ error: "grade는 A/B/C 중 하나여야 합니다." });
  }
  const result = db
    .prepare(
      "INSERT INTO notification_settings (grade, department, recipient_name, recipient_contact, channel) VALUES (?, ?, ?, ?, ?)"
    )
    .run(grade, department, recipientName, recipientContact, channel || "kakao");
  res.status(201).json(
    db.prepare("SELECT * FROM notification_settings WHERE id = ?").get(result.lastInsertRowid)
  );
});

router.delete("/settings/:id", requireRole(...CAN_EDIT), (req, res) => {
  const db = req.app.locals.db;
  const result = db.prepare("DELETE FROM notification_settings WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "설정을 찾을 수 없습니다." });
  res.status(204).end();
});

// 모의 발송 이력 (실제 카카오톡/CCC 문자 연동 전까지 발송 기록 확인용)
router.get("/log", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM notification_logs ORDER BY rowid DESC LIMIT 100").all();
  res.json(
    rows.map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      grade: r.grade,
      recipients: JSON.parse(r.recipients_json || "[]"),
      channel: r.channel,
      status: r.status,
      sentAt: r.sent_at,
    }))
  );
});

module.exports = router;
