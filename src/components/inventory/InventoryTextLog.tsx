"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { dictationRowReady, parseInventoryLog, type DictationIntent, type DictationRow } from "@/lib/inventory/dictation";
import type { QuickPayload } from "@/lib/inventory/quickReviewQueue";
import { useInventoryQuickReview } from "./InventoryQuickReviewProvider";
import { useSpeechCapture } from "./useSpeechCapture";
import {
  inventoryCountedAt,
  validateInventoryUnit,
} from "@/lib/inventory/model";
import type { OperationsBoard } from "@/lib/inventory/operations";
import styles from "./InventoryTextLog.module.css";
type Row = {
  id: string;
  source: string;
  itemId: string;
  quantity: string;
  unit: string;
  version: number;
  issue: string;
  edited: boolean;
  unitConfirmed?: boolean;
  suggestedName?: string;
  newGood?: { name: string; category: string; location: string };
  intent?: DictationIntent;
  candidates?: string[];
};
type VoiceEntry = {
  key: string;
  itemId: string;
  name: string;
  intent: DictationIntent;
  quantity: number | null;
  unit: string;
  status: "pending" | "saved" | "undone" | "skipped" | "failed";
  note?: string;
};
// Long enough to catch a misheard item while walking, short enough not to hold up the list.
const UNDO_MS = 3000;
const intentLabels: Record<DictationIntent, string> = {
  order: "To order",
  out: "Out · to order",
  enough: "Enough",
  cancel: "Remove from To order",
};
function intentPayload(board: OperationsBoard, itemId: string, intent: DictationIntent, quantity: number | null, unit: string): QuickPayload {
  const base = { action: "checkItem" as const, requestId: crypto.randomUUID(), itemId, version: board.stock[itemId]?.version || 0, date: board.today };
  if (intent === "cancel") return { ...base, decision: "cancelOrder" };
  const count = quantity !== null ? { quantity, unit } : {};
  return intent === "enough"
    ? { ...base, decision: "sufficient", ...count }
    : { ...base, decision: "order", flagOnly: true, ...count };
}
type Payload = {
  action: "confirmTextLog";
  requestId: string;
  text: string;
  date: string;
  staffName: string;
  lines: { itemId: string; quantity: number; unit: string; version: number; newGood?: Row["newGood"] }[];
};
function priorCount(item: OperationsBoard["stock"][string] | undefined) {
  return {
    quantity:
      item?.stockSource === "receipt"
        ? (item.lastCountQuantity ?? null)
        : (item?.quantity ?? null),
    unit:
      item?.stockSource === "receipt"
        ? item.lastCountUnit || item.unit
        : item?.unit || "",
  };
}
const sameCountingUnit = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
export default function InventoryTextLog({
  board,
  onSaved,
  onClose,
  undoMs = UNDO_MS,
}: {
  board: OperationsBoard;
  onSaved: (board: OperationsBoard) => void;
  onClose?: () => void;
  undoMs?: number;
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [stage, setStage] = useState<"write" | "review">("write"),
    [reviewed, setReviewed] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [discard, setDiscard] = useState(false),
    [feedback, setFeedback] = useState(""),
    [storageWarning, setStorageWarning] = useState("");
  const quick = useInventoryQuickReview();
  const [voice, setVoice] = useState<VoiceEntry[]>([]);
  const boardRef = useRef(board),
    quickRef = useRef(quick),
    textRef = useRef(text),
    voiceRef = useRef<VoiceEntry[]>([]),
    timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  boardRef.current = board;
  quickRef.current = quick;
  textRef.current = text;
  function updateVoice(next: VoiceEntry[]) {
    voiceRef.current = next;
    setVoice(next);
  }
  function commitVoice(key: string) {
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    const entry = voiceRef.current.find((e) => e.key === key && e.status === "pending");
    if (!entry) return;
    let status: VoiceEntry["status"] = "saved", note = "";
    try {
      if (!quickRef.current) throw new Error("Quick saving is not ready. Reload and try again.");
      quickRef.current.enqueue(intentPayload(boardRef.current, entry.itemId, entry.intent, entry.quantity, entry.unit), entry.name);
      try { navigator.vibrate?.(25); } catch {}
    } catch (e) {
      status = "failed";
      note = (e as Error).message;
    }
    updateVoice(voiceRef.current.map((e) => (e.key === key ? { ...e, status, ...(note ? { note } : {}) } : e)));
  }
  function undoVoice(key: string) {
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    updateVoice(voiceRef.current.map((e) => (e.key === key && e.status === "pending" ? { ...e, status: "undone" } : e)));
  }
  function flushVoice() {
    for (const key of Array.from(timers.current.keys())) commitVoice(key);
  }
  /** Clear spoken actions save after a short Undo window; a newer phrase for the same item replaces a pending one. */
  function queueVoice(ready: DictationRow[]) {
    const current = boardRef.current;
    let next = [...voiceRef.current];
    const added: VoiceEntry[] = [];
    for (const row of ready) {
      const replaced = next.find((e) => e.itemId === row.itemId && e.status === "pending");
      if (replaced) {
        clearTimeout(timers.current.get(replaced.key));
        timers.current.delete(replaced.key);
        next = next.map((e) => (e === replaced ? { ...e, status: "undone", note: "Replaced" } : e));
      }
      const entry: VoiceEntry = {
        key: crypto.randomUUID(),
        itemId: row.itemId,
        name: current.goods.find((g) => g.id === row.itemId)?.name || row.itemId,
        intent: row.intent!,
        quantity: row.quantity,
        unit: row.unit,
        status: "pending",
      };
      added.push(row.intent === "cancel" && !current.stock[row.itemId]?.orderOpen ? { ...entry, status: "skipped", note: "Not on To order" } : entry);
    }
    updateVoice([...next, ...added]);
    for (const entry of added)
      if (entry.status === "pending") timers.current.set(entry.key, setTimeout(() => commitVoice(entry.key), undoMs));
  }
  const flushRef = useRef(flushVoice);
  flushRef.current = flushVoice;
  useEffect(() => () => flushRef.current(), []);
  const speech = useSpeechCapture((phrase) => {
    const current = boardRef.current;
    const parsed = parseInventoryLog(phrase, current.goods, current.offers, current.stock, current.customUnits);
    queueVoice(parsed.filter(dictationRowReady));
    const rest = parsed.filter((row) => !dictationRowReady(row) && row.id !== "log-limit").map((row) => row.source);
    if (rest.length) persist([textRef.current.trim(), ...rest].filter(Boolean).join("\n"));
  });
  const lock = useRef(false),
    pending = useRef<Payload | null>(null),
    key = useRef(""),
    date = useRef(""),
    requestId = useRef("");
  useEffect(() => {
    if (!open || !text.trim()) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [open, text]);
  function persist(value: string) {
    setText(value);
    try {
      if (value) localStorage.setItem(key.current, value);
      else localStorage.removeItem(key.current);
      localStorage.removeItem(`${key.current}:pending`);
    } catch {
      setStorageWarning(
        "This browser cannot retain your draft. Keep this screen open until you save or copy your text.",
      );
    }
  }
  function start() {
    flushVoice();
    updateVoice([]);
    key.current = `tablego-stock-log:${board.today}`;
    date.current = board.today;
    requestId.current = crypto.randomUUID();
    pending.current = null;
    setUncertain(false);
    setName("");
    setRows([]);
    setExpandedRows({});
    setStage("write");
    setReviewed(false);
    setError("");
    setFeedback("");
    setStorageWarning("");
    try {
      setText(localStorage.getItem(key.current) || "");
      const stored = JSON.parse(
        localStorage.getItem(`${key.current}:pending`) || "null",
      ) as Payload | null;
      if (
        stored &&
        stored.action === "confirmTextLog" &&
        stored.date === board.today &&
        typeof stored.requestId === "string" &&
        typeof stored.text === "string" &&
        Array.isArray(stored.lines) &&
        stored.lines.length <= 200 &&
        stored.lines.every(
          (l) =>
            typeof l.itemId === "string" &&
            typeof l.quantity === "number" &&
            typeof l.unit === "string" &&
            typeof l.version === "number",
        )
      ) {
        pending.current = stored;
        requestId.current = stored.requestId;
        setText(stored.text);
        setName(stored.staffName || "");
        setRows(
          stored.lines.map((l, index) => ({
            ...l,
            id: `restored-${index}`,
            source:
              board.goods.find((g) => g.id === l.itemId)?.name || l.newGood?.name || l.itemId,
            quantity: String(l.quantity),
            issue: "",
            edited: true,
            unitConfirmed: true,
          })),
        );
        setUncertain(true);
        setReviewed(true);
        setStage("review");
        setError(
          "A previous save was interrupted. Retry the original log to safely confirm its result.",
        );
      }
    } catch {
      setStorageWarning(
        "This browser cannot restore a draft. Keep this screen open while you work.",
      );
    }
    setOpen(true);
  }
  function close() {
    if (busy) return;
    speech.stop();
    flushVoice();
    setOpen(false);
    onClose?.();
  }
  function review() {
    setError("");
    if (!text.trim()) {
      setError("Speak or type at least one item and quantity.");
      return;
    }
    setExpandedRows({});
    speech.stop();
    const all = parseInventoryLog(
      text,
      board.goods,
      board.offers,
      board.stock,
      board.customUnits,
    );
    const ready = all.filter(dictationRowReady),
      parsed = all.filter((row) => !dictationRowReady(row));
    if (ready.length) {
      queueVoice(ready);
      persist(parsed.filter((row) => row.id !== "log-limit").map((row) => row.source).join("\n"));
      if (!parsed.length) return;
    }
    setRows(
      parsed.map((row) => ({
        ...row,
        quantity: row.quantity === null ? "" : String(row.quantity),
        version: board.stock[row.itemId]?.version || 0,
        edited: false,
      })),
    );
    setReviewed(false);
    setStage("review");
  }
  function edit(id: string, patch: Partial<Row>) {
    setReviewed(false);
    setRows((previous) =>
      previous.map((row) =>
        row.id === id ? { ...row, ...patch, edited: true } : row,
      ),
    );
  }
  function issue(row: Row) {
    if (row.newGood && (!row.newGood.name.trim() || !row.newGood.category.trim()))
      return "Enter a name and category for the new item.";
    if (row.newGood && [...board.goods, ...rows.filter(r => r.id !== row.id && r.newGood).map(r => ({name: r.newGood!.name}))].some(g => g.name.trim().toLocaleLowerCase() === row.newGood!.name.trim().toLocaleLowerCase()))
      return "This name already exists. Choose the existing item or use a distinct name.";
    if (!row.newGood && !board.goods.some((g) => g.id === row.itemId))
      return "Choose the inventory item, or remove this entry.";
    if (rows.filter((r) => r.itemId === row.itemId).length > 1)
      return "This item appears more than once. Combine the counts into one entry and remove the duplicate.";
    if (row.intent === "cancel") {
      if (row.quantity.trim()) return "Save a count separately from removing an order.";
      return board.stock[row.itemId]?.orderOpen ? "" : "This item is not on the To order list.";
    }
    if (row.intent && !row.quantity.trim()) return row.edited || !row.issue ? "" : row.issue;
    const quantity = Number(row.quantity);
    if (
      !row.quantity.trim() ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      quantity > 999999 ||
      Math.round(quantity * 100) / 100 !== quantity
    )
      return "Enter an on-hand quantity with up to two decimal places.";
    try {
      validateInventoryUnit(row.unit);
    } catch {
      return "Enter a valid counting unit.";
    }
    const previous = priorCount(board.stock[row.itemId]);
    if (
      previous.unit &&
      !sameCountingUnit(previous.unit, row.unit) &&
      !row.unitConfirmed
    )
      return "Confirm the changed counting unit before saving.";
    if (!row.edited && row.issue) return row.issue;
    return "";
  }
  async function save() {
    if (
      lock.current ||
      (!pending.current &&
        (!reviewed || !rows.length || rows.some((row) => issue(row))))
    )
      return;
    const actionRows = pending.current ? [] : rows.filter((row) => row.intent),
      countRows = rows.filter((row) => !row.intent);
    if (actionRows.length) {
      if (!quick) {
        setError("Quick saving is not ready. Reload and try again.");
        return;
      }
      try {
        for (const row of actionRows)
          quick.enqueue(
            intentPayload(board, row.itemId, row.intent!, row.quantity.trim() ? Number(row.quantity) : null, row.unit.trim()),
            board.goods.find((g) => g.id === row.itemId)?.name || row.itemId,
          );
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      setRows(countRows);
      if (!countRows.length) {
        persist("");
        setOpen(false);
        setFeedback(`${actionRows.length} entr${actionRows.length === 1 ? "y" : "ies"} saved · Syncing in background`);
        onClose?.();
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const payload = pending.current || {
      action: "confirmTextLog" as const,
      requestId: requestId.current,
      text,
      date: date.current,
      staffName: name.trim(),
      lines: countRows.map((row) => ({
        itemId: row.itemId,
        quantity: Number(row.quantity),
        unit: row.unit.trim(),
        version: row.version,
        ...(row.newGood ? { newGood: row.newGood } : {}),
      })),
    };
    pending.current = payload;
    try {
      localStorage.setItem(`${key.current}:pending`, JSON.stringify(payload));
    } catch {
      setStorageWarning(
        "Keep this screen open until the save result is confirmed. The retry request could not be retained on this device.",
      );
    }
    try {
      const response = await fetch("/api/staff/inventory/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw Object.assign(
          new Error(result.error || "Unable to save your log."),
          { status: response.status },
        );
      onSaved(result);
      try {
        localStorage.removeItem(key.current);
        localStorage.removeItem(`${key.current}:pending`);
      } catch {}
      setText("");
      pending.current = null;
      setUncertain(false);
      setOpen(false);
      setFeedback(
        `${payload.lines.length} stock counts saved${actionRows.length ? ` · ${actionRows.length} order/enough entries syncing` : ""} · History retained`,
      );
      onClose?.();
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status && status < 500) {
        pending.current = null;
        try {
          localStorage.removeItem(`${key.current}:pending`);
        } catch {}
        setUncertain(false);
        setError(
          `${(e as Error).message} Your draft is kept. Refresh stock before reviewing again if another device changed an item.`,
        );
      } else {
        setUncertain(true);
        setError(
          "The save response was interrupted. Retry the same reviewed log below. The original request is retained to prevent duplicate counts.",
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const valid = rows.length > 0 && rows.every((row) => !issue(row));
  const actionCount = rows.filter((row) => row.intent).length;
  const voiceList = voice.length > 0 && (
    <ul className={styles.voice} aria-label="Spoken actions">
      {voice.slice().reverse().map((entry) => (
        <li key={entry.key} data-intent={entry.intent} data-status={entry.status}>
          <span>
            <strong>{entry.name}</strong>
            <small>
              {intentLabels[entry.intent]}
              {entry.quantity !== null && entry.intent !== "out" ? ` · ${entry.quantity} ${entry.unit}` : ""}
            </small>
          </span>
          {entry.status === "pending" ? (
            <button type="button" onClick={() => undoVoice(entry.key)}>Undo</button>
          ) : (
            <em>{entry.status === "saved" ? "✓ Saved" : entry.status === "undone" ? entry.note || "Undone" : entry.note}</em>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <button className={styles.trigger} type="button" onClick={start}>
        Speak or type stock log
      </button>
      {feedback && (
        <p role="status" className={styles.success}>
          {feedback}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          className="max-w-xl max-h-[94dvh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogTitle>
            {stage === "write"
              ? "Speak or type your stock log"
              : "Review stock counts"}
          </DialogTitle>
          <DialogDescription>
            {stage === "write"
              ? "Say an item and what to do: “basil low”, “cilantro good”, “out of limes”, “cancel mint”. Order and Enough save after a 3-second Undo. Counts like “rice 2 bags” wait for your review."
              : "Check every item, quantity and unit against what you physically counted."}
          </DialogDescription>
          <div className={styles.body}>
            {storageWarning && (
              <p role="alert" className={styles.notice}>
                {storageWarning}
              </p>
            )}
            {stage === "write" && speech.supported && (
              <div className={styles.mic}>
                <button
                  type="button"
                  aria-pressed={speech.listening}
                  className={speech.listening ? styles.micOn : styles.micOff}
                  onClick={speech.listening ? speech.stop : speech.start}
                >
                  <span aria-hidden="true" className={styles.micDot} />
                  {speech.listening ? "Stop listening" : "Start listening"}
                </button>
                <p aria-live="polite">
                  {speech.listening
                    ? speech.interim || "Listening… keep talking as you move."
                    : "Tap once and talk while you walk. The screen stays on."}
                </p>
              </div>
            )}
            {speech.error && (
              <p role="alert" className={styles.notice}>
                {speech.error}
              </p>
            )}
            {voiceList}
            {stage === "write" ? (
              <>
                <label>
                  Stock log
                  <textarea
                    rows={8}
                    maxLength={20000}
                    value={text}
                    onChange={(e) => persist(e.target.value)}
                    placeholder="Basil low. Cilantro good. White rice 2 bags."
                    autoCapitalize="sentences"
                  />
                </label>
                <p>
                  Your text draft stays on this device for this inventory day.
                  Separate items with a new line, a period, or a pause in
                  dictation. You can create unmatched items during review.
                </p>
                <div className={styles.actions}>
                  <button type="button" onClick={close}>
                    Keep draft & close
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={review}
                    disabled={!text.trim()}
                  >
                    Review log
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.summary}>
                  <p>{rows.length} entries to review · Nothing in this list saved yet</p>
                  <button
                    type="button"
                    disabled={busy || uncertain}
                    onClick={() => {
                      setStage("write");
                      setReviewed(false);
                    }}
                  >
                    Edit original text
                  </button>
                </div>
                <div className={styles.rows}>
                  {rows.map((row, index) => {
                    const previous = board.stock[row.itemId],
                      previousAt = inventoryCountedAt(previous),
                      physical = priorCount(previous),
                      problem = issue(row),
                      expanded = !!expandedRows[row.id] || !!problem,
                      sameUnit = sameCountingUnit(physical.unit, row.unit),
                      difference =
                        row.quantity.trim() &&
                        physical.quantity !== null &&
                        sameUnit
                          ? Math.round(
                              (Number(row.quantity) - physical.quantity!) * 100,
                            ) / 100
                          : null;
                    return (
                      <section
                        key={row.id}
                        className={styles.row}
                        aria-label={`Count entry ${index + 1}`}
                      >
                        <div className={styles.rowTop}>
                          <div>
                            <strong>
                              {board.goods.find((g) => g.id === row.itemId)
                                ?.name || row.newGood?.name || "Unmatched item"}
                            </strong>
                            <p>
                              {row.intent ? (
                                <span className={styles.intent} data-intent={row.intent}>
                                  {intentLabels[row.intent]}
                                </span>
                              ) : null}
                              {row.intent && !row.quantity ? "" : `${row.quantity || "—"} ${row.unit}`}
                            </p>
                          </div>
                          {!expanded && (
                            <button
                              type="button"
                              disabled={busy || uncertain}
                              onClick={() =>
                                setExpandedRows((all) => ({
                                  ...all,
                                  [row.id]: true,
                                }))
                              }
                            >
                              Edit
                            </button>
                          )}
                          {expanded && (
                            <button
                              type="button"
                              disabled={busy || uncertain}
                              onClick={() => {
                                setRows((all) =>
                                  all.filter((r) => r.id !== row.id),
                                );
                                setReviewed(false);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {row.candidates && !board.goods.some((g) => g.id === row.itemId) && (
                          <div className={styles.choices} role="group" aria-label={`Which item for “${row.source}”?`}>
                            {row.candidates
                              .map((id) => board.goods.find((g) => g.id === id))
                              .filter((g) => g !== undefined)
                              .map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  disabled={busy || uncertain}
                                  onClick={() =>
                                    edit(row.id, {
                                      itemId: g.id,
                                      version: board.stock[g.id]?.version || 0,
                                      unit: row.unit.trim() || board.stock[g.id]?.unit || g.baseUnit,
                                      unitConfirmed: false,
                                    })
                                  }
                                >
                                  {g.name}
                                  {g.detail ? <small>{g.detail}</small> : null}
                                </button>
                              ))}
                          </div>
                        )}
                        {expanded && (
                          <>
                            <p>{row.source}</p>
                            <label>
                              Inventory item
                              <select
                                disabled={busy || uncertain}
                                value={row.newGood ? "__new__" : row.itemId}
                                onChange={(e) => {
                                  if (e.target.value === "__new__") {
                                    edit(row.id, { itemId: crypto.randomUUID(), version: 0,
                                      newGood: {name: row.suggestedName || "", category: "Unsorted goods", location: ""},
                                      unitConfirmed: false });
                                    return;
                                  }
                                  edit(row.id, {
                                    newGood: undefined,
                                    itemId: e.target.value,
                                    version:
                                      board.stock[e.target.value]?.version || 0,
                                    unit:
                                      row.unit.trim() ||
                                      board.stock[e.target.value]?.unit ||
                                      board.goods.find(
                                        (g) => g.id === e.target.value,
                                      )?.baseUnit ||
                                      row.unit,
                                    unitConfirmed: false,
                                  });
                                }}
                              >
                                <option value="">Choose matching item</option>
                                {!row.intent && <option value="__new__">Create new item…</option>}
                                {board.goods.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {row.newGood && <>
                              <p>This item and its on-hand count will be added when you confirm the log.</p>
                              <label>New item name<input disabled={busy || uncertain} maxLength={160} value={row.newGood.name} onChange={e => edit(row.id, {newGood: {...row.newGood!, name: e.target.value}})} /></label>
                              <div className={styles.pair}>
                                <label>Category<input disabled={busy || uncertain} maxLength={80} value={row.newGood.category} onChange={e => edit(row.id, {newGood: {...row.newGood!, category: e.target.value}})} /></label>
                                <label>Location (optional)<input disabled={busy || uncertain} maxLength={120} value={row.newGood.location} onChange={e => edit(row.id, {newGood: {...row.newGood!, location: e.target.value}})} /></label>
                              </div>
                            </>}
                            <div className={styles.pair}>
                              <label>
                                On hand
                                <input
                                  disabled={busy || uncertain}
                                  type="number"
                                  min={0}
                                  max={999999}
                                  step=".01"
                                  inputMode="decimal"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    edit(row.id, { quantity: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Counting unit
                                <input
                                  disabled={busy || uncertain}
                                  list="stock-log-units"
                                  maxLength={24}
                                  value={row.unit}
                                  onChange={(e) =>
                                    edit(row.id, {
                                      unit: e.target.value,
                                      unitConfirmed: false,
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </>
                        )}
                        <p className={styles.count}>
                          Last physical count:{" "}
                          {physical.quantity === null
                            ? "Not counted"
                            : `${physical.quantity} ${physical.unit}`}
                          {previousAt
                            ? ` · ${new Date(previousAt).toLocaleString(undefined, { timeZone: board.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                            : ""}
                          {difference !== null &&
                          Number.isFinite(difference) ? (
                            <>
                              <br />
                              Change from last count:{" "}
                              {difference > 0 ? "+" : ""}
                              {difference} {row.unit}
                            </>
                          ) : null}
                          {previous && row.unit.trim() && !sameUnit ? (
                            <>
                              <br />
                              Different counting units. Verify the amount; no
                              conversion will be assumed.
                            </>
                          ) : null}
                        </p>
                        {expanded &&
                          physical.unit &&
                          row.unit.trim() &&
                          !sameUnit && (
                            <label className={styles.check}>
                              <input
                                type="checkbox"
                                disabled={busy || uncertain}
                                checked={!!row.unitConfirmed}
                                onChange={(e) =>
                                  edit(row.id, {
                                    unitConfirmed: e.target.checked,
                                  })
                                }
                              />
                              I am counting in {row.unit}, instead of{" "}
                              {physical.unit}.
                            </label>
                          )}
                        {row.issue &&
                          !row.edited &&
                          row.itemId &&
                          row.quantity.trim() && (
                            <label className={styles.check}>
                              <input
                                type="checkbox"
                                disabled={busy || uncertain}
                                checked={false}
                                onChange={() => edit(row.id, { edited: true })}
                              />
                              I checked this interpretation against the item and
                              its unit.
                            </label>
                          )}
                        {expanded && !problem && (
                          <button
                            type="button"
                            disabled={busy || uncertain}
                            onClick={() =>
                              setExpandedRows((all) => ({
                                ...all,
                                [row.id]: false,
                              }))
                            }
                          >
                            Done editing
                          </button>
                        )}
                        {problem && (
                          <p className={styles.error} role="alert">
                            {problem}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
                <datalist id="stock-log-units">
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
                      ...board.customUnits,
                      ...board.goods.map((g) => g.baseUnit),
                    ]),
                  ).map((unit) => (
                    <option value={unit} key={unit} />
                  ))}
                </datalist>
                {!rows.length && (
                  <p>Add an item in the original text to save a count.</p>
                )}
                <label>
                  Counted by (optional)
                  <input
                    disabled={busy || uncertain}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Team"
                  />
                </label>
                <label className={styles.check}>
                  <input
                    disabled={busy || uncertain || !valid}
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  I reviewed these items, quantities and units.
                </label>
                <div className={styles.actions}>
                  <button type="button" disabled={busy} onClick={close}>
                    Keep draft & close
                  </button>
                  <button
                    className={styles.primary}
                    type="button"
                    disabled={busy || (!uncertain && (!valid || !reviewed))}
                    onClick={() => void save()}
                  >
                    {busy
                      ? "Saving…"
                      : uncertain
                        ? "Retry original log"
                        : actionCount
                          ? `Save ${rows.length} entr${rows.length === 1 ? "y" : "ies"}`
                          : `Confirm ${rows.length} stock counts`}
                  </button>
                </div>
              </>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setDiscard(true)}
            >
              Discard draft
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogTitle>Discard this stock log?</DialogTitle>
          <DialogDescription>
            Unsaved text and reviewed entries will be removed from this device.
            Saved stock history is kept. If a save was interrupted, check the
            saved history before entering the same log again.
          </DialogDescription>
          <div className={styles.body}>
            <div className={styles.actions}>
              <button type="button" onClick={() => setDiscard(false)}>
                Keep draft
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(key.current);
                    localStorage.removeItem(`${key.current}:pending`);
                  } catch {}
                  setDiscard(false);
                  setText("");
                  setRows([]);
                  pending.current = null;
                  setUncertain(false);
                  close();
                }}
              >
                Discard log
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
