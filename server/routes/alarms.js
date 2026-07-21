const express = require("express");
const { EventEmitter } = require("events");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
const bus = new EventEmitter();
bus.setMaxListeners(0);

router.use(requireAuth);

function rowToAlarm(row) {
  return {
    id: row.id,
    time: row.time,
    site: row.site,
    type: row.type,
    level: row.level,
    msg: row.msg,
    ack: !!row.ack,
  };
}

router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare("SELECT * FROM alarms ORDER BY rowid DESC").all();
  res.json(rows.map(rowToAlarm));
});

router.post("/:id/ack", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM alarms WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "알람을 찾을 수 없습니다." });

  db.prepare("UPDATE alarms SET ack = 1 WHERE id = ?").run(id);
  const updated = rowToAlarm(db.prepare("SELECT * FROM alarms WHERE id = ?").get(id));
  bus.emit("update", updated);
  res.json(updated);
});

// 실시간 알람 확인(ack) 반영 — 신규 클라이언트 연결 시 즉시 구독
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const onUpdate = (alarm) => {
    res.write(`data: ${JSON.stringify(alarm)}\n\n`);
  };
  bus.on("update", onUpdate);

  // 프록시/로드밸런서의 유휴 커넥션 타임아웃 방지
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    bus.off("update", onUpdate);
  });
});

module.exports = router;
