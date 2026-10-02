"use client";

import { useState } from "react";
import { Button, inputClass } from "@/components/ui-primitives";
import { ApiClientError, apiSend } from "@/lib/client/use-api";

/** SCR-10: manager releases a quarantined lot to a normal location of its band, or scraps it (reason required). */
export function QuarantineActions({ lotId, lotNo, locations, onDone }: {
  lotId: string; lotNo: string; locations: { id: number; code: string }[]; onDone: (msg: { ok: boolean; text: string }) => void;
}) {
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "release" | "scrap") {
    setBusy(true);
    try {
      await apiSend("POST", `/api/lots/${lotId}/quarantine`, { action, location_id: location ? Number(location) : null, reason });
      onDone({ ok: true, text: `${lotNo}: ${action === "release" ? "đã release về kho" : "đã hủy (scrap)"} — có ghi audit.` });
    } catch (err) {
      onDone({ ok: false, text: (err as ApiClientError).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do (QA)" className={`${inputClass} w-36 py-1`} aria-label={`Lý do xử lý ${lotNo}`} />
      <select value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputClass} w-28 py-1`} aria-label={`Vị trí release ${lotNo}`}>
        <option value="">Vị trí…</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
      </select>
      <Button variant="secondary" className="py-1" disabled={busy} onClick={() => act("release")}>Release</Button>
      <Button variant="danger" className="py-1" disabled={busy} onClick={() => act("scrap")}>Scrap</Button>
    </div>
  );
}
