export function hostingErrors(env, { release = false } = {}) {
  const errors = [], hosted = ['preview', 'production'].includes(env.VERCEL_ENV);
  if (!hosted && !release) return errors;
  if (hosted && (!String(env.NODE_OPTIONS || '').split(/\s+/).includes('--experimental-require-module') || String(env.NODE_OPTIONS).includes('--no-experimental-require-module'))) {
    errors.push('Vercel requires NODE_OPTIONS=--experimental-require-module for the Firebase Admin SDK dependency chain.');
  }
  const staging = env.TABLEGO_ENVIRONMENT === 'staging';
  if (env.VERCEL_ENV === 'production' && staging) errors.push('The TableGo production deployment cannot use staging settings.');
  if (env.VERCEL_ENV === 'preview' && !staging) errors.push('Vercel Preview must explicitly use the separate staging environment.');
  if (staging) {
    if (env.NEXT_PUBLIC_TABLEGO_ENVIRONMENT !== 'staging' || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'tablego-staging-1d712') errors.push('Staging browser and server must use tablego-staging-1d712.');
    if (env.TABLEGO_NOTIFICATION_MODE !== 'capture' || env.NEXT_PUBLIC_TABLEGO_PROVIDER_TEST) errors.push('Hosted staging requires captured notifications; provider tests are local only.');
  } else {
    if (env.VERCEL_ENV === 'production' && (env.NEXT_PUBLIC_TABLEGO_ENVIRONMENT === 'staging' || env.TABLEGO_NOTIFICATION_MODE || env.NEXT_PUBLIC_TABLEGO_PROVIDER_TEST)) errors.push('Production cannot use staging, capture, or provider-test settings.');
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'tablego-1d712') errors.push('Production must use the TableGo live Firebase project.');
  }
  for (const key of ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'CRON_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_APP_ID']) {
    if (!env[key]) errors.push(key + ' is required.');
  }
  if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) errors.push('ADMIN_PASSWORD must be at least 12 characters for hosted staff access.');
  for (const key of ['ADMIN_SESSION_SECRET', 'CRON_SECRET']) if (env[key] && env[key].length < 32) errors.push(key + ' must be at least 32 characters.');
  try { const url = new URL(env.NEXT_PUBLIC_BASE_URL); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error(); }
  catch { errors.push('NEXT_PUBLIC_BASE_URL must be the canonical HTTPS site origin.'); }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { const credentials = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); if (credentials.project_id !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !credentials.private_key || !credentials.client_email) throw new Error(); }
    catch { errors.push('Server Firebase credentials must match the configured project.'); }
  }
  if (!staging) {
    for (const key of ['EMAIL_USER', 'EMAIL_PASS']) if (!env[key]) errors.push(key + ' is required for live email.');
    if (env.NEXT_PUBLIC_OTP_ENABLED === 'true') for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']) if (!env[key]) errors.push(key + ' is required for live OTP.');
  }
  return errors;
}
export function assertHostingEnvironment(env) {
  const errors = hostingErrors(env);
  if (errors.length) throw new Error('Unsafe hosting configuration: ' + errors.join(' '));
}
