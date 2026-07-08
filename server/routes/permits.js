const express = require("express");

const router = express.Router();

function rowToPermit(row) {
  return {
    id: row.id,
    type: row.type,
    site: row.site,
    location: row.location,
    start: row.start,
    end: row.end,
    status: row.status,
    signed: !!row.signed,
    worker: row.worker,
    contact: row.contact,
    workers: JSON.parse(row.workers_json || "[]"),
    approvals: row.approvals_json ? JSON.parse(row.approvals_json) : undefined,
    detail: row.detail_json ? JSON.parse(row.detail_json) : undefined,
  };
}

function nextPermitId(db) {
  const rows = db.prepare("SELECT id FROM permits WHERE id LIKE 'WP-2607-%'").all();
  let max = 16;
  for (const { id } of rows) {
    const m = /^WP-2607-(\d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `WP-2607-${String(max + 1).padStart(3, "0")}`;
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM permits ORDER BY rowid DESC").all();
  res.json(rows.map(rowToPermit));
});

router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const { type, site, worker, contact, workers, approvals, start, end, detail } = body;

  if (!type || !site || !worker || !contact || !Array.isArray(workers) || workers.length === 0) {
    return res.status(400).json({ error: "필수 항목(작업유형, 현장, 책임자, 작업자 명단)이 누락되었습니다." });
  }

  const id = nextPermitId(db);
  const allSigned = workers.every((w) => w.signed);

  db.prepare(`
    INSERT INTO permits (id, type, site, location, start, end, status, signed, worker, contact, workers_json, approvals_json, detail_json)
    VALUES (@id, @type, @site, @location, @start, @end, @status, @signed, @worker, @contact, @workers_json, @approvals_json, @detail_json)
  `).run({
    id,
    type,
    site,
    location: body.location || "",
    start: start || "",
    end: end || "",
    status: "승인대기",
    signed: allSigned ? 1 : 0,
    worker,
    contact,
    workers_json: JSON.stringify(workers),
    approvals_json: approvals ? JSON.stringify(approvals) : null,
    detail_json: detail ? JSON.stringify(detail) : null,
  });

  const row = db.prepare("SELECT * FROM permits WHERE id = ?").get(id);
  res.status(201).json(rowToPermit(row));
});

router.post("/:id/sign", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM permits WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "허가서를 찾을 수 없습니다." });

  const permit = rowToPermit(row);
  const targetNames = new Set((req.body?.workers || []).map((w) => w.name));
  const updatedWorkers = permit.workers.map((w) =>
    targetNames.has(w.name) ? { ...w, signed: true } : w
  );
  const allSigned = updatedWorkers.every((w) => w.signed);

  db.prepare("UPDATE permits SET workers_json = ?, signed = ? WHERE id = ?").run(
    JSON.stringify(updatedWorkers),
    allSigned ? 1 : 0,
    id
  );

  const updated = db.prepare("SELECT * FROM permits WHERE id = ?").get(id);
  res.json(rowToPermit(updated));
});

module.exports = router;
