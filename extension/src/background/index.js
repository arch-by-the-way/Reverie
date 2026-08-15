// TODO Day 2: listen for messages from content script, POST to /check
// NOTE: MV3 service worker — no reliance on state surviving between wake-ups
// NOTE: if you'll use any "import"/"export" add "type": "module" in "background": in the manifest.json
chrome.runtime.onInstalled.addListener(() => {
  console.log('[background] installed');
});