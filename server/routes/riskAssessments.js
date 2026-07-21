const express = require("express");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();
const CAN_EDIT = ["시스템 어드민", "슈퍼 EHS", "EHS"];

router.use(requireAuth);

function rowToTemplate(row) {
  return {
    id: row.id,
    workType: row.work_type,
    title: row.title,
    items: JSON.parse(row.items_json || "[]"),
    updatedAt: row.updated_at,
  };
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const { workType } = req.query;
  const rows = workType
    ? db.prepare("SELECT * FROM risk_assessment_templates WHERE work_type = ?").all(workType)
    : db.prepare("SELECT * FROM risk_assessment_templates ORDER BY rowid").all();
  res.json(rows.map(rowToTemplate));
});

router.post("/", requireRole(...CAN_EDIT), (req, res) => {
  const db = req.app.locals.db;
  const { workType, title, items } = req.body || {};
  if (!workType || !title || !Array.isArray(items)) {
    return res.status(400).json({ error: "workType, title, items가 필요합니다." });
  }
  const id = `RA-${workType}-${Date.now()}`;
  db.prepare(
    "INSERT INTO risk_assessment_templates (id, work_type, title, items_json) VALUES (?, ?, ?, ?)"
  ).run(id, workType, title, JSON.stringify(items));
  res.status(201).json(rowToTemplate(db.prepare("SELECT * FROM risk_assessment_templates WHERE id = ?").get(id)));
});

router.put("/:id", requireRole(...CAN_EDIT), (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM risk_assessment_templates WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "템플릿을 찾을 수 없습니다." });

  const { title, items } = req.body || {};
  db.prepare(
    "UPDATE risk_assessment_templates SET title = ?, items_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title ?? row.title, items ? JSON.stringify(items) : row.items_json, id);

  res.json(rowToTemplate(db.prepare("SELECT * FROM risk_assessment_templates WHERE id = ?").get(id)));
});

router.delete("/:id", requireRole(...CAN_EDIT), (req, res) => {
  const db = req.app.locals.db;
  const result = db.prepare("DELETE FROM risk_assessment_templates WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "템플릿을 찾을 수 없습니다." });
  res.status(204).end();
});

module.exports = router;
