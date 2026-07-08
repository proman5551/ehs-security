const express = require("express");
const { fetchWeather } = require("../lib/weather");

const router = express.Router();

router.get("/", async (req, res) => {
  const weather = await fetchWeather();
  res.json(weather);
});

module.exports = router;
