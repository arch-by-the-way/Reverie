async function loadSummary() {
  const loadingEl = document.getElementById('loading');
  const summaryEl = document.getElementById('summary');
  const errorEl = document.getElementById('error');

  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SUMMARY' });

    if (res.status === 'error') {
      throw new Error(res.error);
    }

    summaryEl.textContent = res.public_summary;
    summaryEl.classList.remove('hidden');
  } catch (err) {
    console.error('[popup] failed to get summary:', err);
    errorEl.classList.remove('hidden');
  } finally {
    loadingEl.classList.add('hidden');
  }
}

loadSummary();