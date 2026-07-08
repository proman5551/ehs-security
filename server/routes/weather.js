const express = require("express");

const router = express.Router();

// 영종도(인천 중구) 격자 좌표
const KMA_NX = 55;
const KMA_NY = 124;

function kmaBaseDateTime() {
  const d = new Date();
  // 실황은 매시 정각 관측, 40분 이후 제공 → 40분 이전이면 한 시간 전 기준
  if (d.getMinutes() < 40) d.setHours(d.getHours() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  return { base_date: `${y}${m}${day}`, base_time: `${h}00` };
}

router.get("/", async (req, res) => {
  const serviceKey = process.env.KMA_SERVICE_KEY;
  if (!serviceKey) {
    return res.json({ live: false });
  }

  try {
    const { base_date, base_time } = kmaBaseDateTime();
    const url =
      "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst" +
      `?serviceKey=${serviceKey}&dataType=JSON&numOfRows=10&pageNo=1` +
      `&base_date=${base_date}&base_time=${base_time}&nx=${KMA_NX}&ny=${KMA_NY}`;

    const response = await fetch(url);
    const json = await response.json();
    const items = json?.response?.body?.items?.item || [];
    const temp = items.find((x) => x.category === "T1H");
    const hum = items.find((x) => x.category === "REH");

    if (!temp) {
      return res.json({ live: false });
    }

    res.json({
      live: true,
      temp: parseFloat(temp.obsrValue),
      humidity: hum ? parseFloat(hum.obsrValue) : 60,
    });
  } catch (err) {
    res.json({ live: false });
  }
});

module.exports = router;
