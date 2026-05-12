import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) throw new Error(`Invalid US phone number: ${phone}`);
  return `+1${digits}`;
}

export default client;
