// TODO Day 2: listen for messages from content script, POST to /check
// NOTE: MV3 service worker — no reliance on state surviving between wake-ups
// NOTE: if you'll use any "import"/"export" add "type": "module" in "background": in the manifest.json
chrome.runtime.onInstalled.addListener(() => {
  console.log('[background] installed');
});

async function getSummaryForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error('no active tab found');

  const extracted = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' });

  // TODO Day 2: replace this stub with a real POST to backend /check
  // const res = await fetch('https://YOUR-BACKEND/check', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(extracted)
  // });
  // if (!res.ok) throw new Error('backend unavailable');
  // return res.json();

  return {
    status: 'ready',
    public_summary: `[stub] summary of ${extracted.url} (${extracted.extracted_text.length} chars extracted)`
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SUMMARY') {
    getSummaryForActiveTab()
      .then(sendResponse)
      .catch((err) => sendResponse({ status: 'error', error: err.message }));
    return true; // async response — keep the channel open
  }
});