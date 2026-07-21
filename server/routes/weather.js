const express = require("express");
const { fetchWeather } = require("../lib/weather");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const weather = await fetchWeather();
  res.json(weather);
});

module.exports = router;
