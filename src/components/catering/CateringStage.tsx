import { cateringStatusLabels, type CateringStatus } from '@/lib/catering/admin';
const colors: Record<CateringStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  contacted: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
  confirmed: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200',
  completed: 'border-border bg-muted text-muted-foreground', declined: 'border-border bg-muted text-muted-foreground',
  'needs-review': 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200',
};
export default function CateringStage({ status }: { status: CateringStatus }) {
  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[status]}`}>{cateringStatusLabels[status]}</span>;
}
