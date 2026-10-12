export function smsReminderCapability(env: Record<string, string | undefined>, captured = false) {
  if (captured) return { available: true, reason: '' };
  if (env.TABLEGO_SMS_REMINDERS_ENABLED === 'false') return { available: false, reason: 'SMS reminders are unavailable until the restaurant’s sending number is approved. Phone verification still works.' };
  if (!env.TWILIO_FROM_NUMBER || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return { available: false, reason: 'SMS reminders require a configured restaurant sending number.' };
  return { available: true, reason: '' };
}
