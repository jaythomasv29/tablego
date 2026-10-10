export const trackPageView = async (page: string) => {
  if (page.startsWith('/admin') || /^\/(reservation|reschedule|cancel-reservation)\//.test(page)) return;
  try { await fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page }) }); }
  catch { /* Analytics should never interrupt navigation. */ }
};
