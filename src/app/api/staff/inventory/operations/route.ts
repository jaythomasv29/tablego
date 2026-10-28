import { adminSession, requireAdmin } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/auth/rateLimit";
import {
  privateJson,
  ReservationError,
  reservationError,
} from "@/lib/reservations/http";
import {
  getOperations,
  getOperationsHistory,
  mutateOperations,
} from "@/lib/inventory/operationsRepository";
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    return privateJson(
      params.has("history")
        ? await getOperationsHistory(
            params.get("history")!,
            params.get("cursor") || undefined,
          )
        : await getOperations(),
    );
  } catch (error) {
    console.error("Inventory operations request failed", error);
    return reservationError(error);
  }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const session = await adminSession(request);
    if (!session) throw new ReservationError("Authentication required", 401);
    const limited = await rateLimit(
      "inventory-operations",
      session.id,
      120,
      60,
    );
    if (limited) return limited;
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 250000)
      throw new ReservationError("Inventory request is too large", 413);
    return privateJson(
      await mutateOperations(await boundedJson(request), session.id),
    );
  } catch (error) {
    console.error("Inventory operations request failed", error);
    return reservationError(error);
  }
}

async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ReservationError('Enter inventory details');
  const decoder = new TextDecoder(); let text = '', size = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 250000) { await reader.cancel(); throw new ReservationError('Inventory request is too large', 413); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
