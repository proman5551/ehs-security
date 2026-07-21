const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

router.use(requireAuth);

const SYSTEM_PROMPT =
  "당신은 산업현장 안전관제 대시보드의 전담 AI 에이전트입니다. 아래 대시보드 실시간 데이터를 근거로 " +
  "한국어로 간결하고 정확하게 답하세요. 데이터에 없는 내용은 추측하지 말고 없다고 말하세요.";

router.post("/", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "ANTHROPIC_API_KEY가 서버에 설정되지 않았습니다. .env 파일을 확인하세요.",
    });
  }

  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 배열이 필요합니다." });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const system = context
    ? `${SYSTEM_PROMPT}\n\n[대시보드 데이터]\n${JSON.stringify(context)}`
    : SYSTEM_PROMPT;

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1000,
      system,
      messages,
    });

    stream.on("text", (delta) => {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    });

    stream.on("error", (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message || "스트리밍 오류" })}\n\n`);
      res.end();
    });

    await stream.finalMessage();
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message || "요청 처리 중 오류가 발생했습니다." })}\n\n`);
    res.end();
  }
});

module.exports = router;
