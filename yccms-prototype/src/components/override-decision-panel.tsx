"use client";

import { useState } from "react";
import { ErrorBox } from "@/components/async-state";
import { Button, Field, inputClass } from "@/components/ui-primitives";
import { fmtDate, fmtDateTime, fmtTemp } from "@/lib/client/format";
import { ApiClientError, apiSend } from "@/lib/client/use-api";
import type { PendingOverride } from "@/lib/services/pick-plan-types";

/** SCR-05 maker-checker: shows a pending 日付逆転 exception; a manager other than the requester decides. */
export function OverrideDecisionPanel({ request, me, onDone }: {
  request: PendingOverride; me: { email: string; role: string } | null; onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<ApiClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const isRequester = me?.email === request.requested_email;
  const canDecide = me?.role === "manager" && !isRequester;

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", `/api/override-requests/${request.id}/decision`, { approve, note });
      onDone();
    } catch (err) {
      setError(err as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
      <div className="font-semibold">Đề nghị ngoại lệ 日付逆転 đang chờ duyệt (maker-checker)</div>
      <div className="mt-1">Người đề nghị: <b>{request.requested_email}</b> · {fmtDateTime(request.created_at)} · nhiệt khi xuất {fmtTemp(request.ship_temp_c)}</div>
      <div className="mt-1">Lý do: “{request.reason}”</div>
      <ul className="mt-2 space-y-0.5 rounded-lg bg-white/70 p-2 text-xs">
        {request.items.map((it, i) => (
          <li key={i}>
            {it.sku} · lô <span className="font-mono">{it.lot_no}</span> · hạn {fmtDate(it.expiry_date)} · SL {it.qty}
            {it.isReversal && <b className="text-red-700"> — vi phạm 日付逆転</b>}
          </li>
        ))}
      </ul>
      {canDecide ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1"><Field label="Ghi chú quyết định (bắt buộc khi từ chối)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field></div>
          <Button onClick={() => decide(true)} disabled={busy}>Duyệt & giao hàng</Button>
          <Button variant="danger" onClick={() => decide(false)} disabled={busy}>Từ chối</Button>
        </div>
      ) : (
        <p className="mt-2 text-xs">{isRequester ? "Bạn là người lập đề nghị — không được tự duyệt; cần một quản lý khác." : "Chỉ quản lý (khác người đề nghị) được duyệt."}</p>
      )}
      {error && <div className="mt-3"><ErrorBox error={error} /></div>}
    </div>
  );
}
