"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import InventoryTextLog from "@/components/inventory/InventoryTextLog";
import { invoiceCatalogSuggestions } from "@/lib/inventory/invoiceCatalog";
import InvoiceCapture from "@/components/inventory/InvoiceCapture";
import {
  reconcileInvoice,
  type CatalogGood,
  type Invoice,
  type InvoiceLine,
  type OperationsBoard,
  type PurchaseOrder,
  type SupplierOffer,
  type Supplier,
} from "@/lib/inventory/operations";
import { restaurantClock } from "@/lib/reservations/availability";
import { inventoryCountedAt } from "@/lib/inventory/model";
import styles from "./manage.module.css";
const activityLabel = (action: string) => ({ count: 'Physical count', confirmTextLog: 'Stock log confirmed', receive: 'Arrival recorded', createOrder: 'Order recorded', saveInvoice: 'Invoice saved', saveGood: 'Catalog item saved', saveSupplier: 'Supplier saved', saveOffer: 'Supplier product linked' } as Record<string, string>)[action] || 'Inventory updated';
const endpoint = "/api/staff/inventory/operations";
async function request(body?: unknown): Promise<OperationsBoard> {
  const response = await fetch(endpoint, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "Unable to save. Please try again."),
      { status: response.status },
    );
  return data;
}
const num = (value: FormDataEntryValue | null) => Number(value);
type Modal = {
  kind:
    | "count"
    | "good"
    | "supplier"
    | "offer"
    | "order"
    | "receive"
    | "invoice"
    | "detail";
  good?: CatalogGood;
  order?: PurchaseOrder;
  invoice?: Invoice;
  offer?: SupplierOffer;
  supplier?: Supplier;
};
type InvoiceDraft = {
  id?: string;
  version: number;
  supplierId: string;
  number: string;
  date: string;
  total: string;
  orderId: string;
  attachmentId: string;
  rawText: string;
  status: "draft" | "reviewed";
  lines: InvoiceLine[];
};
export default function InventoryManagePage() {
  const historyCursors = useRef<Record<string, string | null>>({});
  const requestId = useRef(""),
    submitLock = useRef(false),
    pendingSave = useRef<Record<string, unknown> | null>(null);
  const [discard, setDiscard] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [captureBusy, setCaptureBusy] = useState(false),
    [capturePending, setCapturePending] = useState(false),
    [olderEnd, setOlderEnd] = useState<Record<string, boolean>>({});
  const [board, setBoard] = useState<OperationsBoard | null>(null),
    [view, setView] = useState("Overview"),
    [category, setCategory] = useState("All categories"),
    [query, setQuery] = useState(""),
    [month, setMonth] = useState("");
  const [error, setError] = useState(""),
    [modalError, setModalError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [supplier, setSupplier] = useState(""),
    [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBoard(await request());
      setOlderEnd({});
      historyCursors.current = {};
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!modal || modal.kind === "detail") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [modal]);
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          timeZone: board?.timezone,
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Never counted";
  function open(next: Modal) {
    requestId.current = crypto.randomUUID();
    pendingSave.current = null;
    setUncertain(false);
    setCapturePending(false);
    setModalError("");
    setModal(next);
    setSupplier(
      next.order?.supplierId ||
        (next.good
          ? board?.offers.find((o) => o.itemId === next.good!.id && o.preferred)
              ?.supplierId ||
            board?.offers.find((o) => o.itemId === next.good!.id)?.supplierId
          : "") ||
        "",
    );
    if (next.kind === "invoice") {
      const i = next.invoice;
      setDraft({
        id: i?.id,
        version: i?.version || 0,
        supplierId: i?.supplierId || "",
        number: i?.number || "",
        date: i?.date || "",
        total: String(i?.total ?? ""),
        orderId: i?.orderId || "",
        attachmentId: i?.attachmentId || "",
        rawText: i?.rawText || "",
        status: i?.status || "draft",
        lines: i?.lines || [],
      });
    }
  }
  function close() {
    if (busy || captureBusy) {
      setModalError(
        "Wait for the current save or photo reading to finish before closing.",
      );
      return;
    }
    if (modal?.kind === "detail") {
      setModal(null);
      return;
    }
    setDiscard(true);
  }
  async function save(body: Record<string, unknown>) {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setModalError("");
    const payload = pendingSave.current || {
      ...body,
      requestId: requestId.current,
    };
    pendingSave.current = payload;
    try {
      setBoard(await request(payload));
      setOlderEnd({});
      historyCursors.current = {};
      setModal(null);
      pendingSave.current = null;
      setUncertain(false);
      setToast("Saved · Activity recorded");
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status && status < 500) {
        pendingSave.current = null;
        setUncertain(false);
        setModalError((e as Error).message);
      } else {
        setUncertain(true);
        setModalError(
          "The save response was interrupted. Your entries are kept. Retry the same save below; it will not create a second order or delivery.",
        );
      }
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || !board) return;
    const f = new FormData(event.currentTarget),
      fields = Object.fromEntries(f);
    if (modal.kind === "count" && modal.good)
      void save({
        action: "count",
        itemId: modal.good.id,
        quantity: num(f.get("quantity")),
        unit: fields.unit,
        performedBy: fields.performedBy,
        version: board.stock[modal.good.id]?.version || 0,
      });
    if (modal.kind === "good")
      void save({
        action: "saveGood",
        good: { ...fields, ...(modal.good ? { id: modal.good.id } : {}) },
      });
    if (modal.kind === "supplier")
      void save({
        action: "saveSupplier",
        supplier: {
          ...fields,
          ...(modal.supplier ? { id: modal.supplier.id } : {}),
        },
      });
    if (modal.kind === "offer")
      void save({
        action: "saveOffer",
        offer: {
          ...fields,
          ...(modal.offer ? { id: modal.offer.id } : {}),
          packSize: num(f.get("packSize")),
          preferred: f.get("preferred") === "on",
        },
      });
    if (modal.kind === "order") {
      const lines = board.offers
        .filter((o) => o.supplierId === supplier)
        .filter((o) => String(f.get(o.id) || "").trim() && num(f.get(o.id)) > 0)
        .map((o) => ({ offerId: o.id, quantity: num(f.get(o.id)) }));
      void save({ action: "createOrder", supplierId: supplier, lines });
    }
    if (modal.kind === "receive" && modal.order) {
      const lines = modal.order.lines
        .filter((l) => String(f.get(`received-${l.itemId}`) || "").trim())
        .map((l) => ({
          itemId: l.itemId,
          receivedQuantity: num(f.get(`received-${l.itemId}`)),
          damagedQuantity: num(f.get(`damaged-${l.itemId}`)),
          note: String(f.get(`note-${l.itemId}`) || ""),
        }));
      void save({
        action: "receive",
        orderId: modal.order.id,
        lines,
        note: fields.note,
        performedBy: fields.performedBy,
      });
    }
    if (modal.kind === "invoice" && draft)
      void save({
        action: "saveInvoice",
        invoice: {
          ...draft,
          total: Number(draft.total),
          orderId: draft.orderId || undefined,
          attachmentId: draft.attachmentId || undefined,
        },
      });
  }
  async function copyOrder(order: PurchaseOrder) {
    try {
      await navigator.clipboard.writeText(
        `${order.supplierName}\n${order.lines.map((l) => `• ${l.supplierItemName}${l.sku ? ` [${l.sku}]` : ""} — ${l.quantity} ${l.unit}`).join("\n")}`,
      );
      setToast("Supplier order copied");
    } catch {
      setError(
        "Copy was unavailable. Open the order and select its item text.",
      );
    }
  }
  async function copySupplierDraft(form: HTMLFormElement | null) {
    if (!form || !board) return;
    const values = new FormData(form);
    const lines = board.offers.filter(o => o.supplierId === supplier).flatMap(o => {
      const raw = String(values.get(o.id) || '').trim();
      if (!raw) return [];
      const quantity = Number(raw);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999999) throw new Error('Enter positive quantities before copying');
      return [`• ${o.supplierItemName}${o.sku ? ` [${o.sku}]` : ''} — ${quantity} ${o.orderUnit}`];
    });
    if (!lines.length) throw new Error('Enter at least one quantity to copy');
    await navigator.clipboard.writeText([board.suppliers.find(s => s.id === supplier)?.name || 'Supplier order', ...lines].join('\n'));
    setToast('Supplier list copied · No order recorded or sent');
  }
  async function loadOlder(kind: "invoices" | "orders") {
    if (!board || loading) return;
    setLoading(true);
    try {
      const cursor = Object.prototype.hasOwnProperty.call(
        historyCursors.current,
        kind,
      )
        ? historyCursors.current[kind]
        : board.historyRestart
          ? undefined
          : board[kind].at(-1)?.id;
      const response = await fetch(
        `${endpoint}?history=${kind}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to load older records");
      historyCursors.current[kind] = data.nextCursor || null;
      setBoard((previous) => {
        if (!previous) return previous;
        const existing = new Set(previous[kind].map((x) => x.id));
        return {
          ...previous,
          [kind]: [
            ...previous[kind],
            ...data.records.filter((x: { id: string }) => !existing.has(x.id)),
          ].sort((a: Invoice | PurchaseOrder, b: Invoice | PurchaseOrder) =>
            ("orderedAt" in b ? b.orderedAt : b.date).localeCompare(
              "orderedAt" in a ? a.orderedAt : a.date,
            ),
          ),
        };
      });
      if (!data.nextCursor)
        setOlderEnd((previous) => ({ ...previous, [kind]: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const goods =
    board?.goods.filter(
      (g) =>
        (category === "All categories" || g.category === category) &&
        `${g.name} ${g.detail || ""} ${g.location || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  const categories = Array.from(
    new Set(board?.goods.map((g) => g.category) || []),
  );
  const field = (
    name: string,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label>
      {label}
      <input name={name} required {...props} />
    </label>
  );
  const supplierSelect = (value: string, onChange: (value: string) => void) => (
    <label>
      Supplier
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose supplier</option>
        {board?.suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
  const unitInput = (name: string, label: string, value = "each") =>
    field(name, label, {
      defaultValue: value,
      list: "inventory-units",
      maxLength: 24,
    });
  function offerSummary(o: SupplierOffer) {
    return (
      <p key={o.id}>
        {o.supplierName} · {o.supplierItemName}
        {o.sku ? ` · SKU ${o.sku}` : ""}
        <br />
        {o.packSize} {o.packUnit} per {o.orderUnit}
        {o.preferred ? " · Preferred" : ""}
        <button type="button" onClick={() => open({ kind: "offer", offer: o })}>
          Edit mapping
        </button>
      </p>
    );
  }
  return (
    <AdminLayout>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link href="/admin/inventory/check">← Daily stock check</Link>
            <h1>Inventory</h1>
            <p>Stock, orders & invoices.</p>
          </div>
          <button
            disabled={loading || busy || !!modal}
            onClick={() => void load()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>
        <nav className={styles.tabs} aria-label="Inventory sections">
          {["Overview", "Directory", "Orders & receiving", "Invoices"].map(
            (t) => (
              <button
                key={t}
                aria-pressed={view === t}
                onClick={() => setView(t)}
              >
                {t === "Orders & receiving" ? "Orders" : t}
              </button>
            ),
          )}
        </nav>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {!board && (
          <p role="status">
            {loading
              ? "Loading inventory…"
              : "Inventory is unavailable. Use Refresh to try again."}
          </p>
        )}
        {board && (
          <>
            {board.activeOrdersTruncated && !olderEnd.orders && (
              <div className={styles.warning}>
                Some active orders are outside this overview. Load the order
                history before assuming this is the complete list.
                <button
                  disabled={loading}
                  onClick={() => {
                    setView("Orders & receiving");
                    void loadOlder("orders");
                  }}
                >
                  Load more orders
                </button>
              </div>
            )}
            {view === "Overview" && (
              <>
                <div className={styles.overviewTools}>
                  <h2>
                    {board.goods.length} goods{" "}
                    <span>
                      {
                        board.goods.filter((g) => {
                          const at = inventoryCountedAt(board.stock[g.id]);
                          return (
                            at &&
                            restaurantClock(board.timezone, new Date(at))
                              .date === board.today
                          );
                        }).length
                      }{" "}
                      counted today
                    </span>
                  </h2>
                  <button
                    className={styles.primary}
                    onClick={() => open({ kind: "good" })}
                  >
                    Add item
                  </button>
                  <details className={styles.stockHelp}>
                    <summary>How stock works</summary>
                    <p>
                      Counts show the last known amount. Reviewed today can mean
                      stock was sufficient without a new count. Receiving and invoices record purchase history and arrivals only. Only a confirmed physical count updates on-hand stock.
                    </p>
                    <Link href="/admin/inventory">
                      Previous supplier tools & history ↗
                    </Link>
                  </details>
                </div>
              </>
            )}
            {view === 'Overview' && <InventoryTextLog board={board} onSaved={next => { setBoard(next); historyCursors.current = {}; setOlderEnd({}); setError(''); }} />}
            {(view === "Overview" || view === "Directory") && (
              <>
                {view === "Directory" && (
                  <div className={styles.row}>
                    <p>
                      Use your kitchen names and each supplier’s exact product
                      names.
                    </p>
                    <button onClick={() => open({ kind: "supplier" })}>
                      Add supplier
                    </button>
                    <button onClick={() => open({ kind: "offer" })}>
                      Link supplier product
                    </button>
                  </div>
                )}
                <div className={styles.filters}>
                  <label>
                    Category
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option>All categories</option>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Find goods
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Name, detail or location"
                    />
                  </label>
                </div>
                <div className={styles.cards}>
                  {goods.map((g) => {
                    const s = board.stock[g.id],
                      offers = board.offers.filter((o) => o.itemId === g.id);
                    const lastOrder = board.orders.find(o => o.lines.some(l => l.itemId === g.id));
                    const lastArrival = board.receipts.find(r => r.lines.some(l => l.itemId === g.id));
                    const lastInvoice = board.invoices.find(i => i.lines.some(l => l.itemId === g.id));
                    return (
                      <article key={g.id} className={styles.card}>
                        <div className={styles.row}>
                          <h3>{g.name}</h3>
                          <span className={styles.badge}>{g.category}</span>
                        </div>
                        <p>
                          {g.detail}
                          {g.location ? ` · ${g.location}` : ""}
                        </p>
                        {(lastOrder || lastArrival || lastInvoice) && <details><summary>Purchase & arrival history</summary>{lastOrder && <p>Last ordered: {date(lastOrder.orderedAt)} · {lastOrder.supplierName} · {Math.max(0, Math.floor((new Date(board.today + 'T12:00:00Z').getTime() - new Date(lastOrder.orderedAt).getTime()) / 86400000))} days ago</p>}{lastArrival && <p>Latest arrival: {date(lastArrival.at)} · {lastArrival.lines.find(l => l.itemId === g.id)?.receivedQuantity} {lastArrival.lines.find(l => l.itemId === g.id)?.unit || board.orders.find(o => o.id === lastArrival.orderId)?.lines.find(l => l.itemId === g.id)?.unit || 'ordering units'} received{lastArrival.supplierName ? ` · ${lastArrival.supplierName}` : ''}</p>}{lastInvoice && <p>Last invoiced: {lastInvoice.date} · {lastInvoice.supplierName} · {lastInvoice.status}</p>}</details>}
                        {view === "Overview" ? (
                          <>
                            <div className={styles.row}>
                              <strong className={styles.amount}>
                                {s?.quantity === null ||
                                s?.quantity === undefined
                                  ? "Not counted"
                                  : `${s.stockSource === 'receipt' ? s.lastCountQuantity ?? 'Unknown' : s.quantity} ${s.stockSource === 'receipt' ? s.lastCountUnit || s.unit : s.unit}`}
                              </strong>
                              <span className={styles.badge}>
                                {s?.stockSource === "receipt"
                                  ? "Recount needed"
                                  : inventoryCountedAt(s) &&
                                      restaurantClock(
                                        board.timezone,
                                        new Date(inventoryCountedAt(s)!),
                                      ).date === board.today
                                    ? "Counted today"
                                    : s?.checkedOn === board.today
                                      ? "Reviewed · count unchanged"
                                      : "Needs review"}
                              </span>
                            </div>
                            <p>
                              Physical count:{" "}
                              {s?.stockSource === "receipt"
                                ? `${s.lastCountQuantity ?? "Unknown"} ${s.lastCountUnit || s.unit} · `
                                : ""}
                              {date(inventoryCountedAt(s))}
                              {s?.stockSource === "receipt" && (
                                <>
                                  <br />
                                  Previous delivery estimate excluded. Recount to confirm stock.
                                </>
                              )}
                              {s?.updatedAt &&
                              s.updatedAt !== inventoryCountedAt(s) ? (
                                <>
                                  <br />
                                  Stock updated: {date(s.updatedAt)}
                                </>
                              ) : null}
                            </p>
                            {s?.orderOpen && (
                              <div className={styles.warning}>
                                Daily check request: {s.orderQuantity}{" "}
                                {s.orderUnit} to order
                                {offers.length ? (
                                  <button
                                    onClick={() =>
                                      open({ kind: "order", good: g })
                                    }
                                  >
                                    Build supplier order
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      open({ kind: "offer", good: g })
                                    }
                                  >
                                    Link supplier to order
                                  </button>
                                )}
                              </div>
                            )}
                            <div className={styles.row}>
                              <button
                                onClick={() => open({ kind: "good", good: g })}
                              >
                                Edit item
                              </button>
                              <button
                                className={styles.primary}
                                onClick={() => open({ kind: "count", good: g })}
                              >
                                Quick count
                              </button>
                              <button
                                onClick={() =>
                                  open({ kind: "detail", good: g })
                                }
                              >
                                History & sources
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            {offers.length ? (
                              offers.map(offerSummary)
                            ) : (
                              <p>No supplier product linked yet.</p>
                            )}
                            <button
                              onClick={() => open({ kind: "offer", good: g })}
                            >
                              Link supplier product
                            </button>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
                {!goods.length && (
                  <p className={styles.empty}>No goods match this search.</p>
                )}
                {view === "Directory" && (
                  <section className={styles.cards}>
                    {board.suppliers.map((s) => (
                      <article className={styles.card} key={s.id}>
                        <h3>{s.name}</h3>
                        <p>{s.phone || "No phone recorded"}</p>
                        <p>{s.notes}</p>
                        <button
                          onClick={() =>
                            open({ kind: "supplier", supplier: s })
                          }
                        >
                          Edit supplier
                        </button>
                      </article>
                    ))}
                  </section>
                )}
              </>
            )}
            {view === "Orders & receiving" && (
              <>
                <div className={styles.row}>
                  <p>
                    Record what you order, then check what actually arrives.
                  </p>
                  <button
                    className={styles.primary}
                    onClick={() => open({ kind: "order" })}
                  >
                    Build supplier order
                  </button>
                </div>
                <div className={styles.notice}>
                  Recording an order does not send it to the supplier. Copy it,
                  place it through your usual channel, then record the delivery
                  here.
                </div>
                <div className={styles.cards}>
                  {board.orders.map((order) => (
                    <article className={styles.card} key={order.id}>
                      <div className={styles.row}>
                        <h3>{order.supplierName}</h3>
                        <span className={styles.badge}>{order.status}</span>
                      </div>
                      <p>
                        {date(order.orderedAt)} · {order.orderedBy}
                      </p>
                      {order.lines.map((l) => (
                        <div key={l.itemId}>
                          <b>{l.supplierItemName}</b>
                          <p>
                            {l.sku ? `${l.sku} · ` : ""}
                            {l.quantity} {l.unit} ordered · {l.receivedQuantity}{" "}
                            delivered
                          </p>
                        </div>
                      ))}
                      <div className={styles.row}>
                        <button onClick={() => void copyOrder(order)}>
                          Copy supplier list
                        </button>
                        {order.status !== "received" && (
                          <button
                            className={styles.primary}
                            onClick={() => open({ kind: "receive", order })}
                          >
                            Receive delivery
                          </button>
                        )}
                      </div>
                      {board.receipts
                        .filter((r) => r.orderId === order.id)
                        .map((r) => (
                          <details key={r.id}>
                            <summary>Delivery · {date(r.at)}</summary>
                            <p>Recorded by {r.by}</p>
                            {r.lines.map((l) => (
                              <p key={l.itemId}>
                                {
                                  board.goods.find((g) => g.id === l.itemId)
                                    ?.name
                                }
                                : {l.receivedQuantity} delivered,{" "}
                                {l.damagedQuantity} damaged. {l.note}
                                <br />
                                {l.stockNote}
                              </p>
                            ))}
                          </details>
                        ))}
                    </article>
                  ))}
                </div>
                {!board.orders.length && (
                  <p className={styles.empty}>
                    No supplier orders recorded yet. Link supplier products in
                    Directory to get started.
                  </p>
                )}
                {board.historyHasMore && !olderEnd.orders && (
                  <button
                    disabled={loading}
                    onClick={() => void loadOlder("orders")}
                  >
                    {loading ? "Loading…" : "Load older orders"}
                  </button>
                )}
              </>
            )}
            {view === "Invoices" && (
              <>
                <div className={styles.row}>
                  <label>
                    Invoice month
                    <input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </label>
                  <button
                    className={styles.primary}
                    onClick={() => open({ kind: "invoice" })}
                  >
                    Upload or add invoice
                  </button>
                </div>
                <p>
                  Keep saved invoice copies, confirm extracted details, and
                  compare purchases with deliveries. Invoice entry does not
                  change stock.
                </p>
                <div className={styles.cards}>
                  {board.invoices
                    .filter((i) => !month || i.date.startsWith(month))
                    .map((i) => (
                      <article className={styles.card} key={i.id}>
                        <div className={styles.row}>
                          <h3>{i.supplierName}</h3>
                          <span className={styles.badge}>{i.status}</span>
                        </div>
                        <p>
                          {i.number || "No invoice number"} · {i.date}
                        </p>
                        <strong>${i.total.toFixed(2)}</strong>
                        {board.invoices.some(
                          (other) =>
                            other.id !== i.id &&
                            other.supplierId === i.supplierId &&
                            i.number &&
                            other.number === i.number,
                        ) && (
                          <p className={styles.warning}>
                            Possible duplicate invoice number. Compare saved
                            invoices.
                          </p>
                        )}
                        <button
                          onClick={() => open({ kind: "invoice", invoice: i })}
                        >
                          Review & compare
                        </button>
                        {i.attachmentId && (
                          <Link
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`/api/staff/inventory/attachments?id=${encodeURIComponent(i.attachmentId)}`}
                          >
                            View saved invoice ↗
                          </Link>
                        )}
                      </article>
                    ))}
                </div>
                {!board.invoices.filter(
                  (i) => !month || i.date.startsWith(month),
                ).length && (
                  <p className={styles.empty}>No invoices for this period.</p>
                )}
                {board.historyHasMore && !olderEnd.invoices && (
                  <button
                    disabled={loading}
                    onClick={() => void loadOlder("invoices")}
                  >
                    {loading ? "Loading…" : "Load older invoices"}
                  </button>
                )}
              </>
            )}
          </>
        )}
        <datalist id="inventory-units">
          {Array.from(
            new Set([
              "each",
              "lb",
              "oz",
              "bag",
              "box",
              "case",
              "bunch",
              "bottle",
              "gallon",
              "pack",
              "can",
              ...(board?.customUnits || []),
            ]),
          ).map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <Dialog
          open={!!modal}
          onOpenChange={(value) => {
            if (!value) close();
          }}
        >
          <DialogContent
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            className="max-w-xl max-h-[92dvh] overflow-y-auto"
          >
            <DialogTitle>
              {modal
                ? {
                    count: "Quick stock count",
                    good: "Add inventory item",
                    supplier: "Add supplier",
                    offer: "Link supplier product",
                    order: "Build supplier order",
                    receive: "Receive delivery",
                    invoice: "Invoice review",
                    detail: modal.good?.name || "Item history",
                  }[modal.kind]
                : ""}
            </DialogTitle>
            <DialogDescription>
              {modal?.kind === "count"
                ? "Record what is physically on hand now. Previous counts stay in history."
                : modal?.kind === "invoice"
                  ? "Review details against the original before marking reviewed."
                  : "Save a clear record for the next person on shift."}
            </DialogDescription>
            {modal && board && (
              <form onSubmit={submit} className={styles.form}>
                <fieldset disabled={busy || uncertain}>
                  {modal.kind === "count" && modal.good && (
                    <>
                      <p>
                        {modal.good.name} · Previous:{" "}
                        {(board.stock[modal.good.id]?.stockSource === 'receipt' ? board.stock[modal.good.id]?.lastCountQuantity : board.stock[modal.good.id]?.quantity) ?? "Unknown"}{" "}
                        {board.stock[modal.good.id]?.unit || ""}
                      </p>
                      {field("quantity", "On hand now", {
                        type: "number",
                        min: 0,
                        max: 999999,
                        step: ".01",
                        inputMode: "decimal",
                        autoFocus: true,
                      })}
                      {unitInput(
                        "unit",
                        "Counting unit",
                        board.stock[modal.good.id]?.unit || modal.good.baseUnit,
                      )}
                      {field("performedBy", "Counted by (optional)", {
                        required: false,
                        maxLength: 100,
                        placeholder: "Team",
                      })}
                    </>
                  )}
                  {modal.kind === "good" && (
                    <>
                      {field("name", "Item name", {
                        maxLength: 160,
                        defaultValue: modal.good?.name,
                      })}
                      {field("category", "Category", {
                        list: "inventory-categories",
                        maxLength: 80,
                        defaultValue: modal.good?.category,
                      })}
                      <datalist id="inventory-categories">
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </datalist>
                      {unitInput(
                        "baseUnit",
                        "Default counting unit",
                        modal.good?.baseUnit || "each",
                      )}
                      {field("location", "Storage location", {
                        required: false,
                        maxLength: 120,
                        defaultValue: modal.good?.location,
                      })}
                      {field("detail", "Brand or item details", {
                        required: false,
                        maxLength: 300,
                        defaultValue: modal.good?.detail,
                      })}
                    </>
                  )}
                  {modal.kind === "supplier" && (
                    <>
                      {field("name", "Supplier name", {
                        maxLength: 160,
                        defaultValue: modal.supplier?.name,
                      })}
                      {field("phone", "Phone", {
                        required: false,
                        type: "tel",
                        maxLength: 80,
                        defaultValue: modal.supplier?.phone,
                      })}
                      {field("notes", "Ordering instructions or notes", {
                        required: false,
                        maxLength: 1000,
                        defaultValue: modal.supplier?.notes,
                      })}
                    </>
                  )}
                  {modal.kind === "offer" && (
                    <>
                      <label>
                        Inventory item
                        <select
                          name="itemId"
                          required
                          defaultValue={
                            modal.offer?.itemId || modal.good?.id || ""
                          }
                        >
                          <option value="">Choose item</option>
                          {board.goods.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Supplier
                        <select
                          name="supplierId"
                          required
                          defaultValue={modal.offer?.supplierId || ""}
                        >
                          <option value="">Choose supplier</option>
                          {board.suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {field(
                        "supplierItemName",
                        "Exact supplier product name",
                        {
                          maxLength: 160,
                          defaultValue: modal.offer?.supplierItemName,
                        },
                      )}
                      {field("sku", "Supplier product code / SKU", {
                        required: false,
                        maxLength: 100,
                        defaultValue: modal.offer?.sku,
                      })}
                      <div className={styles.pair}>
                        {field("packSize", "Amount in one ordering unit", {
                          type: "number",
                          min: ".01",
                          max: 999999,
                          step: ".01",
                          inputMode: "decimal",
                          defaultValue: modal.offer?.packSize || 1,
                        })}
                        {unitInput(
                          "packUnit",
                          "Package contents unit",
                          modal.offer?.packUnit || "lb",
                        )}
                      </div>
                      {unitInput(
                        "orderUnit",
                        "Ordering unit",
                        modal.offer?.orderUnit || "case",
                      )}
                      <p>
                        Example: one case contains 40 lb. Record 40, lb, case.
                        Verify this on the supplier invoice.
                      </p>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          name="preferred"
                          defaultChecked={modal.offer?.preferred}
                        />
                        Preferred source
                      </label>
                    </>
                  )}
                  {modal.kind === "order" && (
                    <>
                      {supplierSelect(supplier, setSupplier)}
                      <button type="button" disabled={!supplier || busy} onClick={event => { void copySupplierDraft(event.currentTarget.form).catch(e => setModalError((e as Error).message)); }}>Copy supplier list</button>
                      <p>Copy the list to place your order outside TableGo. Use Record placed order after confirming it with the supplier.</p>
                      <p>
                        Enter only quantities you want to order. Daily check
                        requests are prefilled when ordering units match. No
                        on-hand count is required.
                      </p>
                      {board.offers
                        .filter((o) => o.supplierId === supplier)
                        .map((o) => (
                          <div className={styles.line} key={o.id}>
                            <h3>{o.supplierItemName}</h3>
                            <p>
                              {o.sku ? `${o.sku} · ` : ""}
                              {o.packSize} {o.packUnit} per {o.orderUnit}
                            </p>
                            {field(o.id, `Quantity (${o.orderUnit})`, {
                              required: false,
                              type: "number",
                              min: ".01",
                              max: 999999,
                              step: ".01",
                              inputMode: "decimal",
                              defaultValue:
                                board.stock[o.itemId]?.orderOpen &&
                                board.stock[o.itemId]?.orderUnit === o.orderUnit
                                  ? board.stock[o.itemId]?.orderQuantity
                                  : undefined,
                            })}
                            {board.stock[o.itemId]?.orderOpen &&
                              board.stock[o.itemId]?.orderUnit !==
                                o.orderUnit && (
                                <p className={styles.warning}>
                                  Daily request is{" "}
                                  {board.stock[o.itemId]?.orderQuantity}{" "}
                                  {board.stock[o.itemId]?.orderUnit}; enter the
                                  equivalent {o.orderUnit} quantity yourself.
                                </p>
                              )}
                          </div>
                        ))}
                      {supplier &&
                        !board.offers.some(
                          (o) => o.supplierId === supplier,
                        ) && (
                          <p>
                            No products linked to this supplier. Add a mapping
                            in Directory first.
                          </p>
                        )}
                    </>
                  )}
                  {modal.kind === "receive" && modal.order && (
                    <>
                      <p>
                        {modal.order.supplierName} · Enter this delivery only.
                        Leave undelivered lines blank. Damaged quantity is part
                        of the delivered quantity.
                      </p>
                      {modal.order.lines
                        .filter((l) => l.receivedQuantity < l.quantity)
                        .map((l) => (
                          <div className={styles.line} key={l.itemId}>
                            <h3>{l.supplierItemName}</h3>
                            <p>
                              Expected remaining:{" "}
                              {Math.round(
                                (l.quantity - l.receivedQuantity) * 100,
                              ) / 100}{" "}
                              {l.unit} · {l.receivedQuantity} previously
                              delivered
                            </p>
                            <div className={styles.pair}>
                              {field(
                                `received-${l.itemId}`,
                                `Delivered (${l.unit})`,
                                {
                                  required: false,
                                  type: "number",
                                  min: 0,
                                  max: l.quantity - l.receivedQuantity,
                                  step: ".01",
                                  inputMode: "decimal",
                                },
                              )}
                              {field(
                                `damaged-${l.itemId}`,
                                "Damaged quantity",
                                {
                                  required: false,
                                  type: "number",
                                  min: 0,
                                  step: ".01",
                                  defaultValue: 0,
                                  inputMode: "decimal",
                                },
                              )}
                            </div>
                            {field(
                              `note-${l.itemId}`,
                              "Missing, substituted or damaged notes",
                              { required: false, maxLength: 500 },
                            )}
                          </div>
                        ))}
                      {field("note", "Delivery notes", {
                        required: false,
                        maxLength: 1000,
                      })}
                      {field("performedBy", "Received by (optional)", {
                        required: false,
                        maxLength: 100,
                        placeholder: "Team",
                      })}
                      <p>
                        This records an arrival only. On-hand stock is updated through a confirmed physical count or stock log.
                      </p>
                    </>
                  )}
                  {modal.kind === "invoice" && draft && (
                    <>
                      <InvoiceCapture
                        onBusyChange={setCaptureBusy}
                        onPendingChange={setCapturePending}
                        onCapture={(capture) =>
                          setDraft((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  attachmentId: capture.attachmentId,
                                  rawText: capture.rawText.slice(0, 50000),
                                  number:
                                    previous.number ||
                                    capture.header?.number ||
                                    "",
                                  date:
                                    previous.date || capture.header?.date || "",
                                  total:
                                    previous.total ||
                                    (capture.header?.total !== undefined
                                      ? String(capture.header.total)
                                      : ""),
                                  status: "draft",
                                  lines: previous.lines.length
                                    ? previous.lines
                                    : capture.lines.map((l) => ({
                                        description: l.description,
                                        quantity: l.quantity ?? 1,
                                        unit: l.unit || "each",
                                        unitPrice: l.unitPrice ?? 0,
                                        lineTotal: l.lineTotal ?? 0,
                                      })),
                                }
                              : previous,
                          )
                        }
                      />
                      {draft.attachmentId && (
                        <Link
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`/api/staff/inventory/attachments?id=${encodeURIComponent(draft.attachmentId)}`}
                        >
                          View saved invoice ↗
                        </Link>
                      )}
                      {supplierSelect(draft.supplierId, (value) =>
                        setDraft({ ...draft, supplierId: value, orderId: "", lines: draft.lines.map((line, index) => { const match = invoiceCatalogSuggestions(draft.lines, board.goods, board.offers, value)[index]; return !line.itemId && match.itemId ? { ...line, itemId: match.itemId } : line; }) }),
                      )}
                      <div className={styles.pair}>
                        <label>
                          Invoice number
                          <input
                            value={draft.number}
                            maxLength={120}
                            onChange={(e) =>
                              setDraft({ ...draft, number: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Invoice date
                          <input
                            type="date"
                            required
                            value={draft.date}
                            onChange={(e) =>
                              setDraft({ ...draft, date: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className={styles.pair}>
                        <label>
                          Total invoiced
                          <input
                            type="number"
                            min={0}
                            max={99999999}
                            step=".01"
                            inputMode="decimal"
                            required
                            value={draft.total}
                            onChange={(e) =>
                              setDraft({ ...draft, total: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Review status
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                status: e.target
                                  .value as InvoiceDraft["status"],
                              })
                            }
                          >
                            <option value="draft">Draft · needs review</option>
                            <option value="reviewed">
                              Reviewed against original
                            </option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Match to order
                        <select
                          value={draft.orderId}
                          onChange={(e) =>
                            setDraft({ ...draft, orderId: e.target.value })
                          }
                        >
                          <option value="">No matched order</option>
                          {board.orders
                            .filter((o) => o.supplierId === draft.supplierId)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {date(o.orderedAt)} · {o.lines.length} items ·{" "}
                                {o.status}
                              </option>
                            ))}
                        </select>
                      </label>
                      {board.invoices.some(
                        (i) =>
                          i.id !== draft.id &&
                          i.supplierId === draft.supplierId &&
                          draft.number &&
                          i.number === draft.number,
                      ) && (
                        <p className={styles.warning}>
                          Possible duplicate invoice number for this supplier.
                        </p>
                      )}
                      {reconcileInvoice(
                        {
                          ...draft,
                          total: Number(draft.total || 0),
                        } as Invoice,
                        board.orders.find((o) => o.id === draft.orderId),
                        board.receipts,
                      ).map((warning, index) => (
                        <p className={styles.warning} key={index}>
                          {warning}
                        </p>
                      ))}
                      <label>
                        Extracted text / reference notes
                        <textarea
                          rows={3}
                          value={draft.rawText}
                          maxLength={50000}
                          onChange={(e) =>
                            setDraft({ ...draft, rawText: e.target.value })
                          }
                        />
                      </label>
                      {draft.lines.some(line => !line.itemId) && <button type="button" onClick={() => setDraft({ ...draft, lines: draft.lines.map(line => line.itemId ? line : { ...line, createCatalog: true }) })}>Add unmatched products to catalog on review</button>}
                      {draft.lines.map((line, index) => {
                        const update = (patch: Partial<InvoiceLine>) =>
                          setDraft({
                            ...draft,
                            lines: draft.lines.map((l, n) =>
                              n === index ? { ...l, ...patch } : l,
                            ),
                          });
                        return (
                          <div className={styles.line} key={index}>
                            <div className={styles.row}>
                              <h3>Invoice line {index + 1}</h3>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    lines: draft.lines.filter(
                                      (_, n) => n !== index,
                                    ),
                                  })
                                }
                              >
                                Remove line
                              </button>
                            </div>
                            <label>
                              Supplier description
                              <input
                                required
                                value={line.description}
                                maxLength={300}
                                onChange={(e) =>
                                  update({ description: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Match inventory item
                              <select
                                value={line.itemId || ""}
                                onChange={(e) =>
                                  update({
                                    itemId: e.target.value || undefined,
                                  })
                                }
                              >
                                <option value="">
                                  Unmatched · review later
                                </option>
                                {board.goods.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {!line.itemId && <><label className={styles.check}><input type="checkbox" checked={Boolean(line.createCatalog)} onChange={e => update({ createCatalog: e.target.checked })} />Add this product to the catalog when this invoice is reviewed</label>{line.createCatalog && <><label>Kitchen item name<input value={line.catalogName || line.description} maxLength={160} onChange={e => update({ catalogName: e.target.value })} /></label><label>Category<input value={line.catalogCategory || 'Unsorted goods'} maxLength={80} onChange={e => update({ catalogCategory: e.target.value })} /></label><p>The invoice unit becomes the default counting unit. Package contents can be refined in Directory. No stock quantity will be added.</p></>}</>}
                            <label>Supplier product code (optional)<input value={line.sku || ''} maxLength={100} onChange={e => update({ sku: e.target.value })} /></label>
                            <div className={styles.pair}>
                              <label>
                                Quantity
                                <input
                                  required
                                  type="number"
                                  min={0}
                                  step=".01"
                                  value={line.quantity}
                                  onChange={(e) =>
                                    update({ quantity: Number(e.target.value) })
                                  }
                                />
                              </label>
                              <label>
                                Unit
                                <input
                                  required
                                  list="inventory-units"
                                  value={line.unit}
                                  maxLength={24}
                                  onChange={(e) =>
                                    update({ unit: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Unit price
                                <input
                                  required
                                  type="number"
                                  min={0}
                                  step=".01"
                                  value={line.unitPrice}
                                  onChange={(e) =>
                                    update({
                                      unitPrice: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Line total
                                <input
                                  required
                                  type="number"
                                  min={0}
                                  step=".01"
                                  value={line.lineTotal}
                                  onChange={(e) =>
                                    update({
                                      lineTotal: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            lines: [
                              ...draft.lines,
                              {
                                description: "",
                                quantity: 1,
                                unit: "each",
                                unitPrice: 0,
                                lineTotal: 0,
                              },
                            ],
                          })
                        }
                      >
                        Add invoice line
                      </button>
                      <p>
                        Line totals: $
                        {draft.lines
                          .reduce((sum, l) => sum + l.lineTotal, 0)
                          .toFixed(2)}{" "}
                        · Invoice total: ${Number(draft.total || 0).toFixed(2)}.
                        Taxes, delivery fees and discounts may explain a
                        difference.
                      </p>
                    </>
                  )}
                  {modal.kind === "detail" && modal.good && (
                    <>
                      <h3>Current sources</h3>
                      {board.offers
                        .filter((o) => o.itemId === modal.good!.id)
                        .map(offerSummary)}
                      {!board.offers.some(
                        (o) => o.itemId === modal.good!.id,
                      ) && <p>No supplier linked yet.</p>}
                      <h3>Previously ordered from</h3>
                      {board.orders
                        .filter((o) =>
                          o.lines.some((l) => l.itemId === modal.good!.id),
                        )
                        .map((o) => (
                          <p key={o.id}>
                            {o.supplierName} · {date(o.orderedAt)} · {o.status}
                          </p>
                        ))}
                      <h3>Invoice price history</h3>
                      {board.invoices.flatMap((i) =>
                        i.lines
                          .filter((l) => l.itemId === modal.good!.id)
                          .map((l, index) => (
                            <p key={`${i.id}-${index}`}>
                              {i.supplierName} · {i.date} · $
                              {l.unitPrice.toFixed(2)} per {l.unit}
                              <br />
                              {l.description} · Invoice{" "}
                              {i.number || "unnumbered"} ({i.status})
                            </p>
                          )),
                      )}
                      <h3>Recent activity</h3>
                      {board.events
                        .filter(
                          (e) =>
                            e.targetId === modal.good!.id ||
                            (JSON.stringify(e.after) || "").includes(
                              `"${modal.good!.id}"`,
                            ),
                        )
                        .slice(0, 20)
                        .map((e) => (
                          <div className={styles.activity} key={e.id}>
                            {activityLabel(e.action)} · {date(e.at)}
                            <p>{e.by || e.actor}</p>
                            {e.action === "count" && (
                              <p>
                                Recorded count:{" "}
                                {String(
                                  (e.after as { quantity?: number })
                                    ?.quantity ?? "",
                                )}{" "}
                                {String(
                                  (e.after as { unit?: string })?.unit ?? "",
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      <p>
                        Earlier daily counts remain available from History in
                        Daily stock check.
                      </p>
                    </>
                  )}
                </fieldset>
                {capturePending && (
                  <p className={styles.warning}>
                    Finish reading the upload, then tap Use invoice details
                    before saving.
                  </p>
                )}
                {uncertain && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(pendingSave.current || {})}
                  >
                    {busy ? "Retrying…" : "Retry original save"}
                  </button>
                )}
                {modalError && (
                  <p role="alert" className={styles.error}>
                    {modalError}
                  </p>
                )}
                <div className={styles.row}>
                  <button type="button" disabled={busy} onClick={close}>
                    {modal.kind === "detail" ? "Close" : "Cancel"}
                  </button>
                  {modal.kind !== "detail" && (
                    <button
                      className={styles.primary}
                      disabled={
                        busy ||
                        captureBusy ||
                        capturePending ||
                        uncertain ||
                        ((modal.kind === "offer" ||
                          modal.kind === "invoice" ||
                          modal.kind === "order") &&
                          !board.suppliers.length)
                      }
                      type="submit"
                    >
                      {busy
                        ? "Saving…"
                        : modal.kind === "order"
                          ? "Record placed order"
                          : modal.kind === "receive"
                            ? "Save delivery"
                            : "Save"}
                    </button>
                  )}
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={discard} onOpenChange={setDiscard}>
          <DialogContent>
            <DialogTitle>Discard unfinished changes?</DialogTitle>
            <DialogDescription>
              Your saved inventory stays unchanged. Entries in this form will be
              discarded. If a save was interrupted, refresh and check saved
              records before creating a new order or delivery. Uploaded files
              are retained privately.
            </DialogDescription>
            <div className={styles.row}>
              <button type="button" onClick={() => setDiscard(false)}>
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscard(false);
                  setModal(null);
                  pendingSave.current = null;
                }}
              >
                Discard changes
              </button>
            </div>
          </DialogContent>
        </Dialog>
        {toast && (
          <div className={styles.toast} role="status">
            {toast}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
