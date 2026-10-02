"use client";

import { useState } from "react";
import { Badge, Button, inputClass } from "@/components/ui-primitives";
import { fmtRange, LANE_LABEL } from "@/lib/client/format";
import { ApiClientError, apiSend } from "@/lib/client/use-api";

export interface SettingsZone { id: number; code: string; name: string; min_c: number | null; max_c: number | null }
export interface SettingsProduct {
  id: number; sku: string; name: string; unit: string; zone_id: number; expiry_type: string; trace_lane: string; near_expiry_days: number;
}
type Done = (ok: boolean, text: string) => void;

const str = (v: number | null) => (v === null ? "" : String(v));

export function ZoneThresholdRow({ zone, canEdit, onDone }: { zone: SettingsZone; canEdit: boolean; onDone: Done }) {
  const [min, setMin] = useState(str(zone.min_c));
  const [max, setMax] = useState(str(zone.max_c));
  const dirty = min !== str(zone.min_c) || max !== str(zone.max_c);
  async function save() {
    try {
      await apiSend("PATCH", `/api/settings/zones/${zone.id}`, { min_c: min, max_c: max });
      onDone(true, `Đã lưu ngưỡng ${zone.name}: ${fmtRange(min === "" ? null : Number(min), max === "" ? null : Number(max))}`);
    } catch (err) { onDone(false, (err as ApiClientError).message); }
  }
  return (
    <tr>
      <td className="font-medium">{zone.name}</td>
      <td><input type="number" step="0.1" value={min} disabled={!canEdit} onChange={(e) => setMin(e.target.value)} className={`${inputClass} w-28 py-1`} aria-label={`Min ${zone.name}`} /></td>
      <td><input type="number" step="0.1" value={max} disabled={!canEdit} onChange={(e) => setMax(e.target.value)} className={`${inputClass} w-28 py-1`} aria-label={`Max ${zone.name}`} /></td>
      <td>{canEdit && <Button variant="secondary" disabled={!dirty} onClick={save} className="py-1">Lưu</Button>}</td>
    </tr>
  );
}

export function ProductExpiryRow({ product, zones, canEdit, onDone }: { product: SettingsProduct; zones: SettingsZone[]; canEdit: boolean; onDone: Done }) {
  const [type, setType] = useState(product.expiry_type);
  const [days, setDays] = useState(String(product.near_expiry_days));
  const zone = zones.find((z) => z.id === product.zone_id);
  const dirty = type !== product.expiry_type || days !== String(product.near_expiry_days);
  async function save() {
    try {
      await apiSend("PATCH", `/api/settings/products/${product.id}`, { expiry_type: type, near_expiry_days: Number(days) });
      onDone(true, `Đã lưu ${product.sku}: ${type === "use_by" ? "消費期限" : "賞味期限"}, cảnh báo trước ${days} ngày`);
    } catch (err) { onDone(false, (err as ApiClientError).message); }
  }
  return (
    <tr>
      <td><div className="font-medium">{product.sku}</div><div className="text-xs text-slate-500">{product.name}</div></td>
      <td className="text-xs">{zone?.name}<div className="text-slate-500">{fmtRange(zone?.min_c ?? null, zone?.max_c ?? null)}</div></td>
      <td>{product.trace_lane !== "internal_lot" ? <Badge tone="violet">{LANE_LABEL[product.trace_lane]}</Badge> : <span className="text-xs text-slate-400">Nội bộ (internal_lot)</span>}</td>
      <td>
        <select value={type} disabled={!canEdit} onChange={(e) => setType(e.target.value)} className={`${inputClass} w-44 py-1`} aria-label={`Loại hạn ${product.sku}`}>
          <option value="best_before">賞味期限 (best-before)</option>
          <option value="use_by">消費期限 (use-by)</option>
        </select>
      </td>
      <td><input type="number" min={0} value={days} disabled={!canEdit} onChange={(e) => setDays(e.target.value)} className={`${inputClass} w-20 py-1`} aria-label={`Ngưỡng cận hạn ${product.sku}`} /></td>
      <td>{canEdit && <Button variant="secondary" disabled={!dirty} onClick={save} className="py-1">Lưu</Button>}</td>
    </tr>
  );
}
