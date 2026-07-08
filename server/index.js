require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const express = require("express");

const { initDb } = require("./db");
const agentRouter = require("./routes/agent");
const permitsRouter = require("./routes/permits");
const alarmsRouter = require("./routes/alarms");
const signLinksRouter = require("./routes/signlinks");
const weatherRouter = require("./routes/weather");

const db = initDb();

const app = express();
app.use(express.json());

app.locals.db = db;

app.use("/api/agent", agentRouter);
app.use("/api/permits", permitsRouter);
app.use("/api/alarms", alarmsRouter);
app.use("/api/sign-links", signLinksRouter);
app.use("/api/weather", weatherRouter);

app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SAFEOPS server listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set — /api/agent will return 503");
  }
  if (!process.env.KMA_SERVICE_KEY) {
    console.warn("KMA_SERVICE_KEY not set — /api/weather will report live:false");
  }
});
