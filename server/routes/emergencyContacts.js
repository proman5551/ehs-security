const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  res.json(db.prepare("SELECT * FROM emergency_contacts ORDER BY sort_order, id").all());
});

router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { name, role, phone, category } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: "name, phone이 필요합니다." });
  }
  const maxOrder = db.prepare("SELECT MAX(sort_order) AS m FROM emergency_contacts").get().m || 0;
  const result = db
    .prepare("INSERT INTO emergency_contacts (name, role, phone, category, sort_order) VALUES (?, ?, ?, ?, ?)")
    .run(name, role || "", phone, category || "사내", maxOrder + 1);
  res.status(201).json(db.prepare("SELECT * FROM emergency_contacts WHERE id = ?").get(result.lastInsertRowid));
});

router.put("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM emergency_contacts WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "연락처를 찾을 수 없습니다." });

  const { name, role, phone, category } = req.body || {};
  db.prepare("UPDATE emergency_contacts SET name = ?, role = ?, phone = ?, category = ? WHERE id = ?").run(
    name ?? row.name, role ?? row.role, phone ?? row.phone, category ?? row.category, id
  );
  res.json(db.prepare("SELECT * FROM emergency_contacts WHERE id = ?").get(id));
});

router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const result = db.prepare("DELETE FROM emergency_contacts WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "연락처를 찾을 수 없습니다." });
  res.status(204).end();
});

module.exports = router;
