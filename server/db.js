const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "safeops.db");

// 5종 계정 권한 — server/lib/auth.js의 requireRole()에서 참조하는 것과 동일한 값이어야 한다.
const ROLES = ["시스템 어드민", "슈퍼 EHS", "EHS", "Security", "기타 임직원"];

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

const DOCUMENTS = [
  { id: "DOC-001", category: "안전보건관리체계", title: "안전보건관리체계 운영 규정",
    content: "1. 목적: 사업장 내 모든 구성원의 안전과 보건을 확보한다.\n2. 적용범위: 임직원, 협력사, 방문 고객을 포함한 전 출입자.\n3. 안전보건 조직: 대표이사(총괄) → 안전보건관리책임자 → 부서별 관리감독자.\n4. 위험성평가: 정기(연 1회) 및 수시(작업 변경 시) 실시.\n5. 문서 개정 이력은 하단 개정번호로 관리한다." },
  { id: "DOC-002", category: "비상대응매뉴얼", title: "화재 비상대응 매뉴얼",
    content: "1. 발견 즉시 비상벨 작동 및 화재 신고(119).\n2. 초기소화가 가능한 경우 소화기로 진압, 불가 시 즉시 대피.\n3. 대피 경로: 각 구역 비상구 표지 참조, 엘리베이터 사용 금지.\n4. 집결지: 주차장 A구역.\n5. 통제관은 인원 점검 후 소방서에 현황 보고." },
  { id: "DOC-003", category: "비상대응매뉴얼", title: "정전·설비 이상 대응 매뉴얼",
    content: "1. 정전 발생 시 비상발전기 자동 전환 확인(수 초 내).\n2. 밀폐공간·고소작업 중인 인원은 즉시 작업 중지 및 대피.\n3. 시설팀은 원인 파악 및 한전 연락.\n4. 복구 전까지 화기작업 허가 신규 발급 중지." },
  { id: "DOC-004", category: "기타", title: "출입 및 방문객 안전수칙",
    content: "1. 전 출입자는 안전모·안전화 등 개인보호구를 착용한다.\n2. 지정된 통로 외 출입을 금지한다.\n3. 위험구역(화기·밀폐·고소작업 구역)은 작업허가서 소지자만 출입 가능하다." },
];

const RISK_ASSESSMENT_TEMPLATES = [
  { id: "RA-화기작업", work_type: "화기작업", title: "화기작업 표준 위험성평가",
    items: [
      { hazard: "가연물 인화·폭발", measure: "반경 10m 내 가연물 제거, 소화기 비치, 화기감시자 배치" },
      { hazard: "화상", measure: "방화복·보안경 착용, 작업 전 TBM 실시" },
      { hazard: "유해가스·흄 흡입", measure: "국소배기장치 가동, 필요 시 방독마스크 착용" },
    ] },
  { id: "RA-밀폐공간 출입", work_type: "밀폐공간 출입", title: "밀폐공간 작업 표준 위험성평가",
    items: [
      { hazard: "산소결핍·유해가스 중독", measure: "작업 전/중 산소·가스농도 측정, 지속 환기" },
      { hazard: "질식·고립", measure: "감시인 상시 배치, 출입인원 명부 관리, 구조장비 비치" },
    ] },
  { id: "RA-정전(전기)작업", work_type: "정전(전기)작업", title: "정전작업 표준 위험성평가",
    items: [
      { hazard: "감전", measure: "차단·검전·접지(LOTO) 후 작업, 절연장비 사용" },
      { hazard: "오작동에 의한 기동", measure: "잠금장치 및 꼬리표 부착, 작업 전 재검전" },
    ] },
  { id: "RA-굴착작업", work_type: "굴착작업", title: "굴착작업 표준 위험성평가",
    items: [
      { hazard: "붕괴·매몰", measure: "굴착면 경사 확보 또는 흙막이 설치, 지반 상태 확인" },
      { hazard: "지하매설물 손상", measure: "사전 매설물 조사, 인력굴착 병행" },
    ] },
  { id: "RA-고소작업", work_type: "고소작업", title: "고소작업 표준 위험성평가",
    items: [
      { hazard: "추락", measure: "안전대 부착설비 및 안전난간 설치, 개인추락방지대 착용" },
      { hazard: "낙하물에 의한 타격", measure: "하부 통제구역 설정, 공구 낙하방지끈 사용" },
    ] },
  { id: "RA-중장비 사용", work_type: "중장비 사용", title: "중장비 작업 표준 위험성평가",
    items: [
      { hazard: "협착·충돌", measure: "신호수 배치, 작업반경 내 출입통제" },
      { hazard: "전도", measure: "지반 지지력 확인, 아웃트리거 완전 전개" },
    ] },
  { id: "RA-방사선 사용", work_type: "방사선 사용", title: "방사선 작업 표준 위험성평가",
    items: [
      { hazard: "방사선 피폭", measure: "차폐·거리·시간 원칙 준수, 개인선량계 착용" },
    ] },
  { id: "RA-일반작업", work_type: "일반작업", title: "일반작업 표준 위험성평가",
    items: [
      { hazard: "미끄러짐·넘어짐", measure: "통로 정리정돈, 미끄럼방지 조치" },
      { hazard: "협착·베임", measure: "개인보호구 착용, 작업 전 TBM 실시" },
    ] },
];

const TRAININGS = [
  { id: "TR-001", title: "신규 협력사 안전보건 교육", category: "공통", content: "인스파이어 리조트 안전수칙, 비상연락체계, 개인보호구 착용기준을 숙지합니다.",
    checklist: ["출입 및 안전수칙 확인", "비상대피로 및 집결지 확인", "개인보호구 착용기준 확인"] },
  { id: "TR-002", title: "밀폐공간 작업자 교육", category: "위험작업", content: "밀폐공간 작업 시 가스농도 측정, 감시인 배치, 비상시 대응절차를 숙지합니다.",
    checklist: ["가스농도 측정 절차 확인", "감시인 역할 및 신호체계 확인", "비상 시 구조 절차 확인"] },
  { id: "TR-003", title: "화기작업자 안전교육", category: "위험작업", content: "화기작업 시 화재감시자 배치, 소화기 비치, 가연물 관리 기준을 숙지합니다.",
    checklist: ["화기작업 허가 절차 확인", "소화기 사용법 확인", "화재감시자 역할 확인"] },
];

const EMERGENCY_CONTACTS = [
  { name: "119 (화재·구조·구급)", role: "소방", phone: "119", category: "외부기관" },
  { name: "112 (경찰)", role: "치안", phone: "112", category: "외부기관" },
  { name: "인스파이어 안전관리팀 (당직)", role: "사내 안전관리책임자", phone: "032-000-0000", category: "사내" },
  { name: "시설관리팀 (당직)", role: "설비·전기·소방설비", phone: "032-000-0001", category: "사내" },
  { name: "인근 협력병원(응급실)", role: "응급의료", phone: "032-000-0002", category: "의료기관" },
];

const NOTIFICATION_SETTINGS = [
  { grade: "A", department: "CEO", recipient_name: "대표이사", recipient_contact: "010-0000-1000", channel: "kakao" },
  { grade: "B", department: "ExCo", recipient_name: "안전보건담당 임원", recipient_contact: "010-0000-2000", channel: "kakao" },
  { grade: "B", department: "홍보팀", recipient_name: "홍보팀장", recipient_contact: "010-0000-2001", channel: "ccc_sms" },
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
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      contact TEXT,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_assessment_templates (
      id TEXT PRIMARY KEY,
      work_type TEXT NOT NULL,
      title TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trainings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT,
      content TEXT NOT NULL DEFAULT '',
      checklist_json TEXT NOT NULL DEFAULT '[]',
      quiz_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS training_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      worker_contact TEXT NOT NULL,
      quiz_score INTEGER,
      completed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      grade TEXT NOT NULL,
      site TEXT,
      type TEXT,
      description TEXT,
      occurred_at TEXT,
      reporter TEXT,
      status TEXT NOT NULL DEFAULT '접수',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '사내',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade TEXT NOT NULL,
      department TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_contact TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'kakao'
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      recipients_json TEXT NOT NULL DEFAULT '[]',
      channel TEXT,
      status TEXT NOT NULL DEFAULT 'mock_sent',
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  const documentCount = db.prepare("SELECT COUNT(*) AS n FROM documents").get().n;
  if (documentCount === 0) {
    const insert = db.prepare(
      "INSERT INTO documents (id, category, title, content) VALUES (@id, @category, @title, @content)"
    );
    const insertMany = db.transaction((docs) => docs.forEach((d) => insert.run(d)));
    insertMany([...DOCUMENTS].reverse());
  }

  const raCount = db.prepare("SELECT COUNT(*) AS n FROM risk_assessment_templates").get().n;
  if (raCount === 0) {
    const insert = db.prepare(
      "INSERT INTO risk_assessment_templates (id, work_type, title, items_json) VALUES (@id, @work_type, @title, @items_json)"
    );
    const insertMany = db.transaction((rows) =>
      rows.forEach((r) => insert.run({ id: r.id, work_type: r.work_type, title: r.title, items_json: JSON.stringify(r.items) }))
    );
    insertMany([...RISK_ASSESSMENT_TEMPLATES].reverse());
  }

  const trainingCount = db.prepare("SELECT COUNT(*) AS n FROM trainings").get().n;
  if (trainingCount === 0) {
    const insert = db.prepare(
      "INSERT INTO trainings (id, title, category, content, checklist_json) VALUES (@id, @title, @category, @content, @checklist_json)"
    );
    const insertMany = db.transaction((rows) =>
      rows.forEach((r) => insert.run({ id: r.id, title: r.title, category: r.category, content: r.content, checklist_json: JSON.stringify(r.checklist) }))
    );
    insertMany([...TRAININGS].reverse());
  }

  const contactCount = db.prepare("SELECT COUNT(*) AS n FROM emergency_contacts").get().n;
  if (contactCount === 0) {
    const insert = db.prepare(
      "INSERT INTO emergency_contacts (name, role, phone, category, sort_order) VALUES (@name, @role, @phone, @category, @sort_order)"
    );
    const insertMany = db.transaction((rows) => rows.forEach((r, i) => insert.run({ ...r, sort_order: i })));
    insertMany(EMERGENCY_CONTACTS);
  }

  const notifSettingCount = db.prepare("SELECT COUNT(*) AS n FROM notification_settings").get().n;
  if (notifSettingCount === 0) {
    const insert = db.prepare(
      "INSERT INTO notification_settings (grade, department, recipient_name, recipient_contact, channel) VALUES (@grade, @department, @recipient_name, @recipient_contact, @channel)"
    );
    const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
    insertMany(NOTIFICATION_SETTINGS);
  }

  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0) {
    const username = process.env.ADMIN_INITIAL_USERNAME || "admin";
    const password = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(9).toString("base64url");
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, name, department, contact, role)
      VALUES (?, ?, '시스템 관리자', 'IT', '', '시스템 어드민')
    `).run(username, hash);

    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.log("");
      console.log("========================================================");
      console.log(" 최초 시스템 어드민 계정이 생성되었습니다.");
      console.log(`   아이디: ${username}`);
      console.log(`   비밀번호: ${password}`);
      console.log(" 이 비밀번호는 다시 표시되지 않습니다 — 로그인 후 반드시 변경하세요.");
      console.log(" (.env의 ADMIN_INITIAL_USERNAME·ADMIN_INITIAL_PASSWORD로 직접 지정할 수도 있습니다)");
      console.log("========================================================");
      console.log("");
    }
  }

  return db;
}

module.exports = { initDb, ROLES };
