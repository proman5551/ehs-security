const express = require("express");
const { fetchWeather, feelsLike, heatStageKey } = require("../lib/weather");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

const HAZARD_KEYWORDS = ["화기작업", "밀폐공간", "정전", "굴착작업", "고소작업", "중장비", "방사선"];
const isHazardType = (type) => HAZARD_KEYWORDS.some((k) => (type || "").includes(k));

router.get("/", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const today = new Date().toISOString().slice(0, 10);

  const weather = await fetchWeather();
  let heatStage = null;
  if (weather.live) {
    const feels = feelsLike(weather.temp, weather.humidity);
    heatStage = { feels, key: heatStageKey(feels) };
  }

  const activePermits = db
    .prepare("SELECT id, site, type FROM permits WHERE status = '진행중'")
    .all()
    .filter((p) => isHazardType(p.type));

  const zoneHazardCount = {};
  for (const p of activePermits) {
    zoneHazardCount[p.site] = (zoneHazardCount[p.site] || 0) + 1;
  }

  const todayIncidents = db
    .prepare("SELECT id, grade, site FROM incidents WHERE substr(coalesce(occurred_at, created_at), 1, 10) = ?")
    .all(today);
  const gradeAToday = todayIncidents.filter((i) => i.grade === "A");
  const gradeBToday = todayIncidents.filter((i) => i.grade === "B");

  const reasons = [];
  let level = "green";

  if (heatStage && (heatStage.key === "위험" || heatStage.key === "경고")) {
    level = "red";
    reasons.push(`체감온도 ${heatStage.feels}℃ — 폭염 ${heatStage.key} 단계`);
  }
  if (gradeAToday.length > 0) {
    level = "red";
    reasons.push(`금일 A등급(사망) 사고 ${gradeAToday.length}건 발생`);
  }
  if (activePermits.length >= 3) {
    level = "red";
    reasons.push(`위험작업 ${activePermits.length}건 동시 진행 중`);
  }

  if (level !== "red") {
    if (heatStage && (heatStage.key === "주의" || heatStage.key === "관심")) {
      level = "yellow";
      reasons.push(`체감온도 ${heatStage.feels}℃ — 폭염 ${heatStage.key} 단계`);
    }
    if (activePermits.length >= 1) {
      level = "yellow";
      reasons.push(`위험작업 ${activePermits.length}건 진행 중`);
    }
    if (gradeBToday.length > 0) {
      level = "yellow";
      reasons.push(`금일 B등급 사고 ${gradeBToday.length}건 발생`);
    }
  }

  if (reasons.length === 0) reasons.push("특이사항 없음");

  const label = level === "red" ? "위험" : level === "yellow" ? "주의" : "정상";

  res.json({
    date: today,
    level, // 'red' | 'yellow' | 'green'
    label,
    reasons,
    weather: heatStage,
    activeHazardCount: activePermits.length,
    zones: Object.entries(zoneHazardCount).map(([site, count]) => ({ site, hazardCount: count })),
    incidentsToday: { A: gradeAToday.length, B: gradeBToday.length, C: todayIncidents.length - gradeAToday.length - gradeBToday.length },
  });
});

module.exports = router;
