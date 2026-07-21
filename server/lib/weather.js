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

// 기상청 여름철 체감온도(2022 개정식) — public/index.html의 feelsLike와 동일 산식
function feelsLike(temp, humidity) {
  const Ta = temp;
  const RH = Math.min(100, Math.max(0, humidity));
  if (Ta < 25) return +Ta.toFixed(1);
  const Tw =
    Ta * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
    Math.atan(Ta + RH) -
    Math.atan(RH - 1.67633) +
    0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) -
    4.686035;
  const at =
    -0.2442 + 0.55399 * Tw + 0.45535 * Ta -
    0.0022 * Tw * Tw + 0.00278 * Tw * Ta + 3.0;
  return +Math.max(Ta, at).toFixed(1);
}

function heatStageKey(feels) {
  if (feels >= 38) return "위험";
  if (feels >= 35) return "경고";
  if (feels >= 33) return "주의";
  if (feels >= 31) return "관심";
  return "정상";
}

async function fetchWeather() {
  const serviceKey = process.env.KMA_SERVICE_KEY;
  if (!serviceKey) return { live: false };

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

    if (!temp) return { live: false };

    return {
      live: true,
      temp: parseFloat(temp.obsrValue),
      humidity: hum ? parseFloat(hum.obsrValue) : 60,
    };
  } catch (err) {
    return { live: false };
  }
}

module.exports = { fetchWeather, feelsLike, heatStageKey };
