const express = require("express");

const router = express.Router();

function rowToTraining(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    checklist: JSON.parse(row.checklist_json || "[]"),
    quiz: row.quiz_json ? JSON.parse(row.quiz_json) : null,
    createdAt: row.created_at,
  };
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM trainings ORDER BY rowid").all();
  res.json(rows.map(rowToTraining));
});

router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { title, category, content, checklist, quiz } = req.body || {};
  if (!title || !Array.isArray(checklist) || checklist.length === 0) {
    return res.status(400).json({ error: "title, checklist(1개 이상)가 필요합니다." });
  }
  const id = `TR-${Date.now()}`;
  db.prepare(
    "INSERT INTO trainings (id, title, category, content, checklist_json, quiz_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, title, category || "공통", content || "", JSON.stringify(checklist), quiz ? JSON.stringify(quiz) : null);
  res.status(201).json(rowToTraining(db.prepare("SELECT * FROM trainings WHERE id = ?").get(id)));
});

// 특정 작업자의 교육 이수 현황 — 작업허가서 서명 게이트에 사용
router.get("/completions", (req, res) => {
  const db = req.app.locals.db;
  const { name, contact } = req.query;
  if (!name || !contact) {
    return res.status(400).json({ error: "name, contact 쿼리 파라미터가 필요합니다." });
  }
  const rows = db
    .prepare("SELECT training_id, completed_at FROM training_completions WHERE worker_name = ? AND worker_contact = ?")
    .all(name, contact);
  res.json(rows.map((r) => ({ trainingId: r.training_id, completedAt: r.completed_at })));
});

router.post("/:id/complete", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const training = db.prepare("SELECT * FROM trainings WHERE id = ?").get(id);
  if (!training) return res.status(404).json({ error: "교육자료를 찾을 수 없습니다." });

  const { workerName, workerContact, quizScore } = req.body || {};
  if (!workerName || !workerContact) {
    return res.status(400).json({ error: "workerName, workerContact가 필요합니다." });
  }
  db.prepare(
    "INSERT INTO training_completions (training_id, worker_name, worker_contact, quiz_score) VALUES (?, ?, ?, ?)"
  ).run(id, workerName, workerContact, quizScore ?? null);

  res.status(201).json({ trainingId: id, workerName, workerContact });
});

module.exports = router;
