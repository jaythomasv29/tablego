"use client";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  inventoryCountedAt,
  validateInventoryUnit,
  type InventoryItem,
} from "@/lib/inventory/model";
import type { CatalogGood, OperationsBoard } from "@/lib/inventory/operations";
import styles from "./InlineStockCheck.module.css";
type Draft = {
  quantity: string;
  unit: string;
  orderQuantity: string;
  orderUnit: string;
  ordering: boolean;
  includeCount: boolean;
};
type Decision = "count" | "sufficient" | "order" | "cancelOrder";
type Payload = {
  action: "checkItem";
  requestId: string;
  itemId: string;
  version: number;
  date: string;
  decision: Decision;
  quantity?: number;
  unit?: string;
  flagOnly?: boolean;
  orderQuantity?: number;
  orderUnit?: string;
};
type Props = {
  good: CatalogGood;
  item?: InventoryItem;
  units: string[];
  date: string;
  timezone: string;
  onSaved: (board: OperationsBoard) => void;
  onDraftChange?: (id: string, dirty: boolean) => void;
  card?: boolean;
  controls?: Ref<{ recheck: () => void; order: () => void }>;
  onCommitted?: (decision: Decision) => void;
  onInteractionChange?: (locked: boolean) => void;
};
const validAmount = (value: string, positive = false) =>
  value.trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= (positive ? 0.01 : 0) &&
  Number(value) <= 999999 &&
  Math.round(Number(value) * 100) / 100 === Number(value);
function validUnit(value: unknown) {
  try {
    return validateInventoryUnit(value);
  } catch {
    return "";
  }
}
export default function InlineStockCheck({
  good,
  item,
  units,
  date,
  timezone,
  onSaved,
  onDraftChange,
  card = false,
  controls,
  onCommitted,
  onInteractionChange,
}: Props) {
  const initial = (): Draft => ({
    quantity: "",
    unit: item?.unit || good.baseUnit,
    orderQuantity: "",
    orderUnit: item?.orderUnit || item?.unit || good.baseUnit,
    ordering: false,
    includeCount: false,
  });
  const [draft, setDraft] = useState<Draft>(initial),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [conflict, setConflict] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [cancel, setCancel] = useState(false),
    [storageWarning, setStorageWarning] = useState("");
  const lock = useRef(false),
    pending = useRef<Payload | null>(null),
    draftRef = useRef(draft),
    callback = useRef(onDraftChange),
    key = `tablego-inline-stock:${date}:${good.id}`,
    listId = useId();
  callback.current = onDraftChange;
  useEffect(() => {
    setReady(false);
    pending.current = null;
    setUncertain(false);
    setConflict(false);
    setError("");
    setSaved("");
    setCancel(false);
    let next: Draft = {
      quantity: "",
      unit: item?.unit || good.baseUnit,
      orderQuantity: "",
      orderUnit: item?.orderUnit || item?.unit || good.baseUnit,
      ordering: false,
      includeCount: false,
    };
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (
        stored &&
        typeof stored.quantity === "string" &&
        stored.quantity.length <= 20 &&
        typeof stored.orderQuantity === "string" &&
        stored.orderQuantity.length <= 20 &&
        validUnit(stored.unit) &&
        validUnit(stored.orderUnit)
      )
        next = {
          quantity: stored.quantity,
          unit: validUnit(stored.unit),
          orderQuantity: stored.orderQuantity,
          orderUnit: validUnit(stored.orderUnit),
          ordering: stored.ordering === true,
          includeCount: stored.includeCount === true,
        };
      const attempted = JSON.parse(
        localStorage.getItem(`${key}:pending`) || "null",
      ) as Payload | null;
      if (
        attempted &&
        attempted.action === "checkItem" &&
        attempted.itemId === good.id &&
        attempted.date === date &&
        typeof attempted.requestId === "string" &&
        ["count", "order", "sufficient", "cancelOrder"].includes(
          attempted.decision,
        )
      ) {
        pending.current = attempted;
        setUncertain(true);
        setError(
          "A previous save was interrupted. Retry it to confirm the result safely.",
        );
      }
    } catch {
      setStorageWarning(
        "Draft storage is unavailable. Keep this tile open until your count is saved.",
      );
    }
    draftRef.current = next;
    setDraft(next);
    setReady(true);
    // Drafts are scoped to an item and day, and should not reset after server refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const dirty = Boolean(draft.quantity.trim() || draft.ordering || uncertain);
  const interactionLocked = !ready || busy || uncertain || conflict || draft.ordering || cancel;
  useEffect(() => { onInteractionChange?.(interactionLocked); }, [interactionLocked, onInteractionChange]);
  useImperativeHandle(controls, () => ({
    recheck: () => { if (!interactionLocked) void save("sufficient"); },
    order: () => { if (!interactionLocked) order(); },
  }));
  useEffect(() => {
    if (ready) callback.current?.(good.id, dirty);
  }, [ready, dirty, good.id]);
  function change(patch: Partial<Draft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setSaved("");
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setStorageWarning(
        "Your draft could not be retained on this device. Save before leaving this tile.",
      );
    }
  }
  function order() { void save("order", true); }
  function editOrder() {
    change({
      ordering: true,
      orderQuantity: draft.orderQuantity || String(item?.orderQuantity ?? ""),
      orderUnit: draft.orderQuantity
        ? draft.orderUnit
        : item?.orderUnit || draft.unit,
      includeCount: false,
    });
  }
  function format(value: string) {
    return new Date(value).toLocaleString(undefined, {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  async function save(decision: Decision, flagOnly = false) {
    if (lock.current) return;
    setError("");
    setConflict(false);
    let payload = pending.current;
    if (!payload) {
      const withCount =
        decision === "count" ||
        (decision === "order" && !flagOnly && draft.includeCount && Boolean(draft.quantity.trim()));
      if (decision === "count" && !draft.quantity.trim()) {
        setError("Enter the amount on hand before saving a count.");
        return;
      }
      if (
        withCount &&
        (!validAmount(draft.quantity) || !validUnit(draft.unit))
      ) {
        setError(
          "Enter a count from 0 to 999999, with up to two decimals and a valid unit.",
        );
        return;
      }
      if (
        decision === "order" && !flagOnly &&
        (!validAmount(draft.orderQuantity, true) || !validUnit(draft.orderUnit))
      ) {
        setError(
          "Enter the quantity to buy, greater than zero, and its ordering unit.",
        );
        return;
      }
      payload = {
        action: "checkItem",
        requestId: crypto.randomUUID(),
        itemId: good.id,
        version: item?.version || 0,
        date,
        decision,
        ...(withCount
          ? { quantity: Number(draft.quantity), unit: validUnit(draft.unit) }
          : {}),
        ...(decision === "order" && flagOnly ? { flagOnly: true } : {}),
        ...(decision === "order" && !flagOnly
          ? {
              orderQuantity: Number(draft.orderQuantity),
              orderUnit: validUnit(draft.orderUnit),
            }
          : {}),
      };
    }
    lock.current = true;
    setBusy(true);
    pending.current = payload;
    try {
      localStorage.setItem(`${key}:pending`, JSON.stringify(payload));
    } catch {
      setStorageWarning(
        "Keep this tile open until the save result is confirmed.",
      );
    }
    try {
      const response = await fetch("/api/staff/inventory/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const board = await response.json();
      if (!response.ok)
        throw Object.assign(
          new Error(board.error || "Unable to save this item."),
          { status: response.status },
        );
      const next = {
        ...draftRef.current,
        ...(payload.quantity !== undefined ? { quantity: "" } : {}),
        ...(payload.decision === "order" || payload.decision === "cancelOrder"
          ? { ordering: false, orderQuantity: "", includeCount: false }
          : {}),
      };
      draftRef.current = next;
      setDraft(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        localStorage.removeItem(`${key}:pending`);
      } catch {}
      pending.current = null;
      setUncertain(false);
      setCancel(false);
      const at =
        board.stock?.[good.id]?.updatedAt || board.stock?.[good.id]?.checkedAt;
      setSaved(
        `${payload.decision === "order" ? "Order request saved" : payload.decision === "cancelOrder" ? "Order request cancelled" : payload.decision === "count" ? "Count saved" : "Enough for now"}${at ? ` · ${format(at)}` : ""}`,
      );
      onSaved(board);
      onCommitted?.(payload.decision);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status && status < 500) {
        pending.current = null;
        setUncertain(false);
        try {
          localStorage.removeItem(`${key}:pending`);
        } catch {}
        setConflict(status === 409);
        setError((e as Error).message);
      } else {
        setUncertain(true);
        setError(
          "The response was interrupted. Retry the original save below; your count draft is kept.",
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/staff/inventory/operations", {
        cache: "no-store",
      });
      const board = await response.json();
      if (!response.ok)
        throw new Error(board.error || "Unable to refresh stock.");
      onSaved(board);
      setConflict(false);
      setError(
        "Latest stock loaded. Your draft is kept; review it before saving again.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const counted = inventoryCountedAt(item),
    lastQuantity =
      item?.stockSource === "receipt" ? item.lastCountQuantity : item?.quantity,
    lastUnit =
      item?.stockSource === "receipt"
        ? item.lastCountUnit || item.unit
        : item?.unit;
  return (
    <section data-stock-entry className={`${styles.check} ${card ? styles.cardCheck : ''}`} aria-label={`Check ${good.name}`}>
      <datalist id={listId}>
        {Array.from(
          new Set(
            [
              ...units,
              good.baseUnit,
              item?.unit || "",
              item?.orderUnit || "",
            ].filter(Boolean),
          ),
        ).map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!ready || busy || uncertain}
          onClick={() => void save("sufficient")}
        >
          {busy ? 'Saving…' : card ? '← Enough' : 'Enough'}
        </button>
        <button
          type="button"
          disabled={!ready || busy || uncertain}
          onClick={order}
        >
          {card ? "Order →" : "Order"}
        </button>
      </div>
      {item?.orderOpen && (
        <div className={styles.status}>
          <strong>
            On order list
          </strong>
          <button
            type="button"
            disabled={busy || uncertain}
            onClick={() => setCancel(true)}
          >
            Cancel request
          </button>
        </div>
      )}
      {cancel && (
        <div className={styles.confirm}>
          <p>Cancel this internal order request? Your count stays unchanged.</p>
          <div className={styles.secondary}>
            <button
              disabled={busy}
              type="button"
              onClick={() => setCancel(false)}
            >
              Keep request
            </button>
            <button
              disabled={busy || uncertain}
              type="button"
              onClick={() => void save("cancelOrder")}
            >
              Confirm cancellation
            </button>
          </div>
        </div>
      )}
      {draft.ordering && (
        <div className={styles.order}>
          <div data-stock-entry-fields className={styles.orderFields}>
            <label>
              Quantity to buy
              <input
                aria-label={`Quantity to buy for ${good.name}`}
                disabled={busy || uncertain}
                type="number"
                min=".01"
                max={999999}
                step=".01"
                inputMode="decimal"
                placeholder="Amount to order"
                value={draft.orderQuantity}
                onChange={(e) => change({ orderQuantity: e.target.value })}
              />
            </label>
            <label>
              Ordering unit
              <input
                aria-label={`Ordering unit for ${good.name}`}
                disabled={busy || uncertain}
                list={listId}
                maxLength={24}
                value={draft.orderUnit}
                onChange={(e) => change({ orderUnit: e.target.value })}
              />
            </label>
          </div>
          {draft.quantity.trim() && (
            <label className={styles.include}>
              <input
                disabled={busy || uncertain}
                type="checkbox"
                checked={draft.includeCount}
                onChange={(e) => change({ includeCount: e.target.checked })}
              />
              Also save on hand: {draft.quantity} {draft.unit}
            </label>
          )}
          <p>Add to your order list. Nothing is sent to a supplier.</p>
          <div className={styles.secondary}>
            <button
              type="button"
              disabled={busy || uncertain}
              onClick={() =>
                change({
                  ordering: false,
                  orderQuantity: "",
                  includeCount: false,
                })
              }
            >
              Close order editor
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || uncertain}
              onClick={() => void save("order")}
            >
              Save order request
            </button>
          </div>
        </div>
      )}
      <details className={styles.countDetails}>
        <summary>Count details{draft.quantity.trim() ? ' · unsaved draft' : ''}</summary>
        <button type="button" disabled={!ready || busy || uncertain} onClick={editOrder}>Set order amount (optional)</button>
      <p>
        {lastQuantity === null || lastQuantity === undefined
          ? "No physical count yet"
          : `Last counted ${lastQuantity} ${lastUnit}`}
        {counted ? ` · ${format(counted)}` : ""}
      </p>
      <div data-stock-entry-fields className={styles.fields}>
        <label>
          On hand (optional)
          <input
            aria-label={`On hand for ${good.name}`}
            disabled={!ready || busy || uncertain}
            type="number"
            min={0}
            max={999999}
            step=".01"
            inputMode="decimal"
            placeholder="New count"
            value={draft.quantity}
            onChange={(e) => change({ quantity: e.target.value })}
          />
        </label>
        <label>
          Unit
          <input
            aria-label={`Counting unit for ${good.name}`}
            disabled={!ready || busy || uncertain}
            list={listId}
            maxLength={24}
            value={draft.unit}
            onChange={(e) => change({ unit: e.target.value })}
          />
        </label>
        <button
          type="button"
          className={styles.primary}
          disabled={!ready || busy || uncertain || !draft.quantity.trim()}
          onClick={() => void save("count")}
        >
          Save count
        </button>
      </div>
      {draft.quantity.trim() && <button type="button" disabled={busy || uncertain} onClick={() => change({ quantity: "", includeCount: false })}>Discard count draft</button>}
      </details>
      {item?.checkedOn === date && !draft.quantity.trim() && !saved && (
        <p className={styles.saved}>{item.orderOpen ? "Order requested" : "Enough for now"} · {format(item.checkedAt)}</p>
      )}
      {saved && (
        <p className={styles.saved} role="status">
          {saved}
        </p>
      )}
      {storageWarning && <p role="alert">{storageWarning}</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {uncertain && (
        <button
          type="button"
          disabled={busy}
          className={styles.primary}
          onClick={() => void save(pending.current?.decision || "count")}
        >
          {busy ? "Retrying…" : "Retry original save"}
        </button>
      )}
      {conflict && (
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Load latest stock · Keep draft
        </button>
      )}
    </section>
  );
}
