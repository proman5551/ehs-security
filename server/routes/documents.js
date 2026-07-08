const express = require("express");

const router = express.Router();

function nextDocId(db) {
  const rows = db.prepare("SELECT id FROM documents WHERE id LIKE 'DOC-%'").all();
  let max = 0;
  for (const { id } of rows) {
    const m = /^DOC-(\d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DOC-${String(max + 1).padStart(3, "0")}`;
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM documents ORDER BY rowid DESC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { category, title, content } = req.body || {};
  if (!category || !title) {
    return res.status(400).json({ error: "category, title이 필요합니다." });
  }
  const id = nextDocId(db);
  db.prepare("INSERT INTO documents (id, category, title, content) VALUES (?, ?, ?, ?)").run(
    id, category, title, content || ""
  );
  res.status(201).json(db.prepare("SELECT * FROM documents WHERE id = ?").get(id));
});

router.put("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "문서를 찾을 수 없습니다." });

  const { category, title, content } = req.body || {};
  db.prepare(
    "UPDATE documents SET category = ?, title = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(category ?? row.category, title ?? row.title, content ?? row.content, id);

  res.json(db.prepare("SELECT * FROM documents WHERE id = ?").get(id));
});

router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const result = db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "문서를 찾을 수 없습니다." });
  res.status(204).end();
});

module.exports = router;
