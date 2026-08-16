console.log('[content-script] loaded on', location.href);

function extractMainContent() {
  // naive first pass — grabs the biggest "article-like" block
  const candidates = ['article', 'main', '[role="main"]'];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 200) return el.innerText.trim();
  }
  // fallback: whole page text if nothing article-shaped was found
  return document.body.innerText.trim();
}

async function hashText(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildPayload() {
  const extracted_text = extractMainContent();
  const content_hash = await hashText(extracted_text);
  return {
    url: location.href, // background/server will normalize this
    content_hash,
    extracted_text
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT') {
    buildPayload().then(sendResponse);
    return true; // keeps the message channel open for the async response
  }
});