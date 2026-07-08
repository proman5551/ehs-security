const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "safeops.db");

const INITIAL_PERMITS = [
  { id: "WP-2607-014", type: "화기작업", site: "Arena", location: "Arena 무대 상부 트러스", start: "07-07 08:00", end: "07-07 17:00", status: "진행중", signed: true,
    worker: "강태호", contact: "010-3421-8876",
    workers: [{ name: "강태호", contact: "010-3421-8876", signed: true }, { name: "김민재", contact: "010-6631-2087", signed: true }],
    approvals: { inspireManager: { name: "김현수", sig: null }, inspireStaff: { name: "이안전", sig: null }, contractor: { name: "박시공", sig: null } } },
  { id: "WP-2607-015", type: "밀폐작업", site: "BOH (주방·후방구역)", location: "BOH 주방 배기덕트 내부", start: "07-07 09:00", end: "07-07 15:00", status: "승인대기", signed: false,
    worker: "오세라", contact: "010-9982-1123",
    workers: [{ name: "오세라", contact: "010-9982-1123", signed: false }, { name: "배수진", contact: "010-4470-9915", signed: true }] },
  { id: "WP-2607-016", type: "고소작업", site: "Rotunda", location: "Rotunda 천장 키네틱 구동부", start: "07-07 10:00", end: "07-07 18:00", status: "승인대기", signed: false,
    worker: "문준호", contact: "010-5510-4471",
    workers: [{ name: "문준호", contact: "010-5510-4471", signed: false }, { name: "조현우", contact: "010-8123-5540", signed: false }, { name: "신예린", contact: "010-2290-7761", signed: false }] },
  { id: "WP-2607-012", type: "일반작업", site: "Casino", location: "Casino 슬롯머신 구역 배선정비", start: "07-06 13:00", end: "07-06 17:00", status: "완료", signed: true,
    worker: "한지수", contact: "010-7768-2209",
    workers: [{ name: "한지수", contact: "010-7768-2209", signed: true }] },
  { id: "WP-2607-013", type: "고소작업", site: "Rotunda", location: "Rotunda 미디어파사드 점검", start: "07-06 08:00", end: "07-07 18:00", status: "진행중", signed: true,
    worker: "임세빈", contact: "010-2214-9930",
    workers: [{ name: "임세빈", contact: "010-2214-9930", signed: true }, { name: "황도현", contact: "010-9034-1189", signed: true }] },
  { id: "WP-2607-011", type: "화기작업", site: "Arena", location: "Arena 백스테이지 용접", start: "07-05 09:00", end: "07-05 12:00", status: "반려", signed: false,
    worker: "서동혁", contact: "010-8845-6612",
    workers: [{ name: "서동혁", contact: "010-8845-6612", signed: false }] },
];

const ALARMS = [
  { id: "AL-3391", time: "07-07 13:42", site: "BOH (주방·후방구역)", type: "가스농도 초과", level: "긴급", msg: "주방덕트 밀폐작업 중 CO 41ppm — 기준치 초과", ack: false },
  { id: "AL-3390", time: "07-07 12:18", site: "Arena", type: "화기작업 경보", level: "경고", msg: "무대 상부 화기작업 구역 온도 상승 감지", ack: false },
  { id: "AL-3389", time: "07-07 11:05", site: "Casino", type: "안전모 미착용", level: "주의", msg: "슬롯 구역 정비 중 안전모 미착용 1건 감지", ack: true },
  { id: "AL-3388", time: "07-07 09:51", site: "Rotunda", type: "고소작업 위험", level: "경고", msg: "키네틱 구동부 교체 중 안전대 미체결 감지", ack: true },
  { id: "AL-3387", time: "07-06 16:33", site: "Mall·F&B", type: "지게차 접근", level: "주의", msg: "하역구역 지게차-보행자 근접 경고", ack: true },
  { id: "AL-3386", time: "07-06 14:07", site: "BOH (주방·후방구역)", type: "가스농도 초과", level: "긴급", msg: "덕트 내부 VOC 순간 피크 감지", ack: true },
  { id: "AL-3385", time: "07-06 10:22", site: "Arena", type: "온도 이상", level: "주의", msg: "조명설비 과열 온도 상승 추세", ack: true },
];

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      site TEXT NOT NULL,
      location TEXT,
      start TEXT,
      end TEXT,
      status TEXT NOT NULL,
      signed INTEGER NOT NULL DEFAULT 0,
      worker TEXT,
      contact TEXT,
      workers_json TEXT NOT NULL DEFAULT '[]',
      approvals_json TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alarms (
      id TEXT PRIMARY KEY,
      time TEXT NOT NULL,
      site TEXT NOT NULL,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      msg TEXT NOT NULL,
      ack INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sign_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      permit_id TEXT NOT NULL,
      worker TEXT NOT NULL,
      contact TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const permitCount = db.prepare("SELECT COUNT(*) AS n FROM permits").get().n;
  if (permitCount === 0) {
    const insert = db.prepare(`
      INSERT INTO permits (id, type, site, location, start, end, status, signed, worker, contact, workers_json, approvals_json)
      VALUES (@id, @type, @site, @location, @start, @end, @status, @signed, @worker, @contact, @workers_json, @approvals_json)
    `);
    const insertMany = db.transaction((permits) => {
      for (const p of permits) {
        insert.run({
          id: p.id,
          type: p.type,
          site: p.site,
          location: p.location,
          start: p.start,
          end: p.end,
          status: p.status,
          signed: p.signed ? 1 : 0,
          worker: p.worker,
          contact: p.contact,
          workers_json: JSON.stringify(p.workers || []),
          approvals_json: p.approvals ? JSON.stringify(p.approvals) : null,
        });
      }
    });
    // rowid DESC 조회 시 원본 배열 순서가 재현되도록 역순으로 삽입
    insertMany([...INITIAL_PERMITS].reverse());
  }

  const alarmCount = db.prepare("SELECT COUNT(*) AS n FROM alarms").get().n;
  if (alarmCount === 0) {
    const insert = db.prepare(`
      INSERT INTO alarms (id, time, site, type, level, msg, ack)
      VALUES (@id, @time, @site, @type, @level, @msg, @ack)
    `);
    const insertMany = db.transaction((alarms) => {
      for (const a of alarms) {
        insert.run({ ...a, ack: a.ack ? 1 : 0 });
      }
    });
    // rowid DESC 조회 시 원본 배열 순서가 재현되도록 역순으로 삽입
    insertMany([...ALARMS].reverse());
  }

  return db;
}

module.exports = { initDb };
