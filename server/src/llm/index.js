// TODO Day 2: wire up chosen provider (Groq/Together/Fireworks)
async function summarize(extractedText) {
  if (!process.env.LLM_API_KEY || process.env.LLM_API_KEY === 'REPLACE_ME') {
    return `[stub summary] ${extractedText?.slice(0, 60) ?? ''}...`;
  }
  throw new Error('LLM provider not wired up yet');
}

module.exports = { summarize };