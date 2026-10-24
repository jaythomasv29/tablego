import { normalizedEmail } from '../mailing/policy.ts';
export function marketingTestInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter your test email details.');
  const input = value as Record<string, unknown>;
  if (input.kind !== 'reservation' && input.kind !== 'catering') throw new Error('Choose a follow-up email.');
  const email = normalizedEmail(input.email);
  if (!email) throw new Error('Enter one valid recipient email address.');
  if (typeof input.name !== 'string' || input.name.length > 120 || /[\r\n\x00-\x1f]/.test(input.name)) throw new Error('Enter a name of up to 120 characters.');
  if (typeof input.key !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.key)) throw new Error('A valid test request key is required.');
  if (typeof input.configurationVersion !== 'string' || !/^[a-f0-9]{64}$/.test(input.configurationVersion)) throw new Error('Load the email preview before sending.');
  return { kind: input.kind as 'reservation' | 'catering', email, name: input.name.trim() || 'Guest', key: input.key, configurationVersion: input.configurationVersion };
}
