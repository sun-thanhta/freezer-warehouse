"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorBox, Loading } from "@/components/async-state";
import { emptyLine, InboundLineEditor, type LineDraft, type MasterData } from "@/components/inbound-line-editor";
import { Button, Card, Field, inputClass, LinkButton, PageHeader } from "@/components/ui-primitives";
import { todayJst } from "@/lib/rules/date-utils";
import { ApiClientError, apiSend, useApi } from "@/lib/client/use-api";

export default function NewInboundPage() {
  const router = useRouter();
  const { data: master, error, loading } = useApi<MasterData>("/api/master");
  const [supplierId, setSupplierId] = useState("");
  const [arrival, setArrival] = useState(todayJst());
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [submitError, setSubmitError] = useState<ApiClientError | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error || !master) return <ErrorBox error={error ?? "Không tải được danh mục"} />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await apiSend<{ id: string }>("POST", "/api/inbound", {
        supplier_id: Number(supplierId), arrival_date: arrival, note,
        lines: lines.map((l) => ({
          ...l, product_id: Number(l.product_id), qty: Number(l.qty),
          temp_c: l.temp_c === "" ? null : Number(l.temp_c), location_id: l.location_id ? Number(l.location_id) : null,
        })),
      });
      router.push(`/inbound/${res.id}`);
    } catch (err) {
      setSubmitError(err as ApiClientError);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  const rejected = lines.filter((l) => l.result !== "accepted").length;
  return (
    <form onSubmit={onSubmit}>
      <PageHeader title="Tạo & kiểm phiếu nhập" subtitle="SCR-07 · Kiểm nhập: nhiệt độ theo ngưỡng Yuki, lô, hạn, mã truy xuất — dòng Đạt sinh lô tồn kho, 保留 vào khu 隔離"
        actions={<LinkButton href="/inbound" variant="secondary">Hủy</LinkButton>} />
      {submitError && <div className="mb-4"><ErrorBox error={submitError} /></div>}
      <Card title="Thông tin phiếu" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nhà cung cấp">
            <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">— Chọn —</option>
              {master.suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </Field>
          <Field label="Ngày nhận"><input type="date" required value={arrival} onChange={(e) => setArrival(e.target.value)} className={inputClass} /></Field>
          <Field label="Ghi chú"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>
        </div>
      </Card>
      <div className="space-y-3">
        {lines.map((line, i) => (
          <InboundLineEditor key={i} index={i} line={line} master={master}
            onChange={(l) => setLines(lines.map((x, j) => (j === i ? l : x)))}
            onRemove={lines.length > 1 ? () => setLines(lines.filter((_, j) => j !== i)) : undefined} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => setLines([...lines, emptyLine()])}>+ Thêm dòng</Button>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{lines.length} dòng · {rejected} không đạt (từ chối / 保留)</span>
          <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Xác nhận kiểm & nhập kho"}</Button>
        </div>
      </div>
    </form>
  );
}
