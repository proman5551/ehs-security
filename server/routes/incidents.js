const express = require("express");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();
const CAN_REGISTER = ["시스템 어드민", "슈퍼 EHS", "EHS", "Security"];

router.use(requireAuth);

function nextIncidentId(db) {
  const rows = db.prepare("SELECT id FROM incidents WHERE id LIKE 'INC-%'").all();
  let max = 0;
  for (const { id } of rows) {
    const m = /^INC-(\d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INC-${String(max + 1).padStart(4, "0")}`;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const { category, grade } = req.query;
  let sql = "SELECT * FROM incidents WHERE 1=1";
  const params = [];
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (grade) { sql += " AND grade = ?"; params.push(grade); }
  sql += " ORDER BY rowid DESC";
  res.json(db.prepare(sql).all(...params));
});

router.get("/stats", (req, res) => {
  const db = req.app.locals.db;
  const byCategory = db.prepare("SELECT category, COUNT(*) AS n FROM incidents GROUP BY category").all();
  const byGrade = db.prepare("SELECT grade, COUNT(*) AS n FROM incidents GROUP BY grade").all();
  const byMonth = db
    .prepare("SELECT substr(occurred_at, 1, 7) AS month, COUNT(*) AS n FROM incidents WHERE occurred_at IS NOT NULL GROUP BY month ORDER BY month")
    .all();
  res.json({ byCategory, byGrade, byMonth });
});

router.get("/export.csv", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM incidents ORDER BY rowid DESC").all();
  const header = ["id", "category", "grade", "site", "type", "description", "occurred_at", "reporter", "status"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((h) => csvEscape(r[h])).join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=incidents.csv");
  res.send("﻿" + lines.join("\n")); // BOM — 엑셀 한글 깨짐 방지
});

router.post("/", requireRole(...CAN_REGISTER), (req, res) => {
  const db = req.app.locals.db;
  const { category, grade, site, type, description, occurredAt, reporter } = req.body || {};
  if (!category || !grade) {
    return res.status(400).json({ error: "category, grade가 필요합니다." });
  }
  if (!["임직원", "협력사", "고객"].includes(category)) {
    return res.status(400).json({ error: "category는 임직원/협력사/고객 중 하나여야 합니다." });
  }
  if (!["A", "B", "C"].includes(grade)) {
    return res.status(400).json({ error: "grade는 A/B/C 중 하나여야 합니다." });
  }

  const id = nextIncidentId(db);
  db.prepare(`
    INSERT INTO incidents (id, category, grade, site, type, description, occurred_at, reporter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, category, grade, site || "", type || "", description || "", occurredAt || null, reporter || "");

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);

  // A/B등급 — 사고등급 자동알림 모의 발송 (실제 카카오톡/CCC 문자 연동은 협의 후 적용)
  let notified = [];
  if (grade === "A" || grade === "B") {
    const recipients = db.prepare("SELECT * FROM notification_settings WHERE grade = ?").all(grade);
    if (recipients.length > 0) {
      db.prepare(`
        INSERT INTO notification_logs (incident_id, grade, recipients_json, channel, status)
        VALUES (?, ?, ?, ?, 'mock_sent')
      `).run(id, grade, JSON.stringify(recipients), recipients.map((r) => r.channel).join(","));
      notified = recipients;
    }
  }

  res.status(201).json({ ...incident, notified });
});

module.exports = router;
