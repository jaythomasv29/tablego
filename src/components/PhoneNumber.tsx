import { CheckCircle2 } from 'lucide-react';

export function PhoneVerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300" title="Phone number verified by a code" aria-label="Phone number verified">
    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />Verified
  </span>;
}

export default function PhoneNumber({ phone, verified = false }: { phone: string; verified?: boolean }) {
  if (!phone) return <span>No phone</span>;
  return <span className="inline-flex flex-wrap items-center gap-1.5"><a className="hover:underline" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a><PhoneVerifiedBadge verified={verified} /></span>;
}
