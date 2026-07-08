require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const express = require("express");

const { initDb } = require("./db");
const agentRouter = require("./routes/agent");
const permitsRouter = require("./routes/permits");
const alarmsRouter = require("./routes/alarms");
const signLinksRouter = require("./routes/signlinks");
const weatherRouter = require("./routes/weather");
const documentsRouter = require("./routes/documents");
const riskAssessmentsRouter = require("./routes/riskAssessments");
const trainingsRouter = require("./routes/trainings");
const incidentsRouter = require("./routes/incidents");
const emergencyContactsRouter = require("./routes/emergencyContacts");
const notificationsRouter = require("./routes/notifications");
const riskSignalRouter = require("./routes/riskSignal");

const db = initDb();

const app = express();
app.use(express.json());

app.locals.db = db;

app.use("/api/agent", agentRouter);
app.use("/api/permits", permitsRouter);
app.use("/api/alarms", alarmsRouter);
app.use("/api/sign-links", signLinksRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/risk-assessments", riskAssessmentsRouter);
app.use("/api/trainings", trainingsRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/emergency-contacts", emergencyContactsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/risk-signal", riskSignalRouter);

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
