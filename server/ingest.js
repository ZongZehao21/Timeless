import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DOCS_PATH = path.resolve("./data/docs.json");
const VECTORS_PATH = path.resolve("./data/vectors.json");

function mustEnv(name){
  if (!process.env[name]) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
}

async function main(){
  mustEnv("OPENAI_API_KEY");

  const docs = JSON.parse(fs.readFileSync(DOCS_PATH, "utf-8"));
  if (!Array.isArray(docs) || docs.length === 0) {
    throw new Error("docs.json must be a non-empty array");
  }

  const inputs = docs.map(d => `${d.title}\n\n${d.text}`);

  const emb = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: inputs,
    encoding_format: "float"
  });

  const vectors = docs.map((d,i) => ({
    id: d.id,
    title: d.title,
    text: d.text,
    embedding: emb.data[i].embedding
  }));

  fs.writeFileSync(VECTORS_PATH, JSON.stringify(vectors, null, 2), "utf-8");
  console.log(`✅ Wrote ${vectors.length} vectors to ${VECTORS_PATH}`);
}

main().catch((e) => {
  console.error("Ingest failed:", e);
  process.exit(1);
});
