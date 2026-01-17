import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// Dev-friendly CORS (so your static site on Live Server can call localhost:3001)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VECTORS_PATH = path.resolve("./data/vectors.json");
let VECTORS = [];

function mustEnv(name){
  if (!process.env[name]) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
}

function loadVectors(){
  if (!fs.existsSync(VECTORS_PATH)) {
    console.error("Missing data/vectors.json. Run: npm run ingest");
    process.exit(1);
  }
  VECTORS = JSON.parse(fs.readFileSync(VECTORS_PATH, "utf-8"));
}

function dot(a,b){
  let s = 0;
  for (let i=0;i<a.length;i++) s += a[i]*b[i];
  return s;
}
function norm(a){ return Math.sqrt(dot(a,a)); }
function cosine(a,b){
  const d = norm(a)*norm(b);
  return d === 0 ? 0 : dot(a,b)/d;
}

async function embedQuery(q){
  const e = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: q,
    encoding_format: "float"
  });
  return e.data[0].embedding;
}

function topK(qEmbedding, k=4){
  return VECTORS
    .map(v => ({ ...v, score: cosine(qEmbedding, v.embedding) }))
    .sort((a,b) => b.score - a.score)
    .slice(0,k);
}

function extractFunctionCalls(response){
  const calls = [];
  const out = response.output || [];
  for (const item of out) {
    if (item.type === "function_call") {
      let args = item.arguments;
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch { args = {}; }
      }
      calls.push({ name: item.name, arguments: args });
    }
  }
  return calls;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, page } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message must be a string" });
    }

    const qEmb = await embedQuery(message);
    const hits = topK(qEmb, 4);

    const sourcesText = hits.map((h, i) => {
      return `SOURCE ${i+1}: ${h.title}\n${h.text}`;
    }).join("\n\n---\n\n");

    const response = await client.responses.create({
      model: "gpt-5.2",
      temperature: 0.2,
      instructions:
        "You are an assistant embedded inside the Timeless NP website. " +
        "You can answer questions using the provided SOURCES and you can perform safe website actions using tools.\n\n" +
        "Rules:\n" +
        "- If the user asks for navigation (e.g., 'bring me to contact us'), call navigate.\n" +
        "- If the user asks to go to a section on the current page, call scroll_to.\n" +
        "- If SOURCES do not contain the answer, say you don't have it yet.\n" +
        "- Never claim you can control the user's laptop. You only control this website tab.\n",
      input:
        `PAGE: ${page || "unknown"}\n\nUSER: ${message}\n\nSOURCES:\n${sourcesText}`,
      tools: [
        {
          type: "function",
          name: "navigate",
          description: "Navigate to a different page on this website.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Allowed pages (optional #anchor): /index.html, /HTML/Our_Past.html, /HTML/User_Stories.html, /HTML/map.html, /HTML/1960_Story.html. Example: /index.html#contact"
              }
            },
            required: ["path"],
            additionalProperties: false
          }
        },
        {
          type: "function",
          name: "scroll_to",
          description: "Scroll to a section on the current page using a CSS selector.",
          parameters: {
            type: "object",
            properties: {
              selector: {
                type: "string",
                description: "Example: #about or #contact"
              }
            },
            required: ["selector"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: "auto"
    });

    const toolCalls = extractFunctionCalls(response);
    if (toolCalls.length > 0) {
      return res.json({ type: "tool", toolCalls });
    }

    return res.json({
      type: "answer",
      text: response.output_text || "",
      sources: hits.map(h => ({ title: h.title, score: h.score }))
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

mustEnv("OPENAI_API_KEY");
loadVectors();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Timeless AI server running on http://localhost:${PORT}`);
});
