'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { marketingCopy, marketingTestMessage } from '@/lib/marketing/render';
import type { MarketingKind } from '@/lib/marketing/policy';
import type { RestaurantIdentity } from '@/lib/restaurant/config';
interface Configuration { restaurant: RestaurantIdentity; baseUrl: string; configurationVersion: string }
interface Delivery { state: string; deliveryMode?: string }
export default function MarketingTestModal({ initialKind, onClose }: { initialKind: MarketingKind; onClose: () => void }) {
  const [kind, setKind] = useState(initialKind), [name, setName] = useState(''), [email, setEmail] = useState('');
  const [config, setConfig] = useState<Configuration | null>(null), [error, setError] = useState('');
  const [sending, setSending] = useState(false), [job, setJob] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null), [refresh, setRefresh] = useState(0);
  const submitting = useRef(false), requestKey = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/staff/marketing/test', { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load the email preview.');
        if (!controller.signal.aborted) setConfig(result);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load the preview.'); }
    })();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!job) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined, checks = 0;
    async function poll() {
      try {
        const response = await fetch(`/api/staff/marketing/test?id=${encodeURIComponent(job!)}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to check delivery.');
        if (controller.signal.aborted) return;
        setDelivery(result);
        if (++checks < 20 && ['queued', 'sending', 'failed'].includes(result.state)) timer = setTimeout(() => void poll(), 2000);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to check delivery.'); }
    }
    void poll();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [job, refresh]);
  const preview = useMemo(() => config ? marketingTestMessage(marketingCopy({ kind, name: name.trim() || 'Guest' }, config.restaurant, config.baseUrl)) : null, [config, kind, name]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !config || job) return;
    submitting.current = true; setSending(true); setError('');
    const fingerprint = JSON.stringify({ kind, name: name.trim(), email: email.trim().toLowerCase(), configurationVersion: config.configurationVersion });
    if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const response = await fetch('/api/staff/marketing/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, email, configurationVersion: config.configurationVersion, key: requestKey.current.key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to queue the test email.');
      setDelivery({ state: 'queued' }); setJob(result.id);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to send the test email. Please try again.'); }
    finally { submitting.current = false; setSending(false); }
  }
  const sent = delivery?.state === 'delivered', captured = sent && delivery?.deliveryMode === 'capture';
  const terminal = sent || ['exhausted', 'superseded'].includes(delivery?.state || '');
  return <Dialog open onOpenChange={open => { if (!open && !sending) onClose(); }}><DialogContent showCloseButton={!sending} className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-4xl">
    <div className="border-b px-6 py-5 sm:px-8"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground"><Mail className="h-4 w-4" aria-hidden="true" />Marketing studio</div><DialogTitle className="text-2xl font-semibold">Try a follow-up email</DialogTitle><DialogDescription className="mt-2 max-w-xl">See it as your guest would. Choose an email, add a test recipient, and send a copy to their inbox.</DialogDescription></div>
    <div className="grid gap-0 md:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={send} className="space-y-5 p-6 sm:p-8">
        <fieldset disabled={sending || Boolean(job)} className="space-y-5"><legend className="sr-only">Test email details</legend>
          <div className="space-y-2"><Label htmlFor="test-kind">Follow-up email</Label><select id="test-kind" value={kind} onChange={event => setKind(event.target.value as MarketingKind)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="reservation">Reservation · welcome back</option><option value="catering">Catering · next gathering</option></select></div>
          <div className="space-y-2"><Label htmlFor="test-name">Recipient name <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="test-name" value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder="e.g. Alex" autoComplete="off" className="h-11" /><p className="text-xs text-muted-foreground">Leave blank to use “Guest” in the greeting.</p></div>
          <div className="space-y-2"><Label htmlFor="test-email">Send test to</Label><Input id="test-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="email" placeholder="name@example.com" aria-describedby="test-recipient-help" className="h-11" /><p id="test-recipient-help" className="text-xs text-muted-foreground">Only this address will receive the test.</p></div>
        </fieldset>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {job ? <div role="status" className="space-y-2 rounded-xl border bg-muted/40 p-4"><p className="flex items-center gap-2 font-semibold">{sent && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{captured ? 'Test captured' : sent ? 'Test sent' : delivery?.state === 'exhausted' ? 'Delivery needs attention' : 'Test email queued'}</p><p className="break-words text-sm text-muted-foreground">{captured ? 'Saved in the test environment. No real email was sent.' : sent ? `Accepted by the email provider for ${email}. Check the inbox and spam folder.` : terminal ? 'The provider could not complete this test. You can try a new test.' : `Your test to ${email} is being processed. You can close this window while it sends.`}</p>{!terminal && <Button type="button" variant="outline" className="min-h-11" onClick={() => { setError(''); setRefresh(value => value + 1); }}>Check delivery status</Button>}</div> : <Button type="submit" className="h-12 w-full gap-2" disabled={sending || !config || !email.trim()}><Send className="h-4 w-4" aria-hidden="true" />{sending ? 'Queuing test…' : 'Send test email'}</Button>}
        {terminal && <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => { requestKey.current = null; setJob(null); setDelivery(null); setError(''); }}>Send another test</Button>}
        <p className="text-xs leading-relaxed text-muted-foreground">Test copies are marked [TEST]. Sending one won’t approve a customer follow-up or subscribe the recipient.</p>
      </form>
      <section aria-label="Email preview" className="min-w-0 border-t bg-muted/30 p-5 md:border-l md:border-t-0 sm:p-6"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Email preview</h3><span className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">Test copy</span></div><div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b bg-zinc-50 px-5 py-4 text-zinc-900"><p className="text-xs text-zinc-500">Subject</p><p className="mt-1 break-words text-sm font-semibold">{preview?.subject || 'Loading preview…'}</p></div>{preview ? <iframe title="Test email preview" srcDoc={preview.html} sandbox="" className="h-[560px] w-full border-0 bg-white" /> : <p role="status" className="p-6 text-sm text-zinc-600">Loading your email…</p>}</div></section>
    </div>
    <div className="flex justify-end border-t px-6 py-4"><Button type="button" variant="outline" className="min-h-11" disabled={sending} onClick={onClose}>Close</Button></div>
  </DialogContent></Dialog>;
}
