import type { ApiClientError } from "@/lib/client/use-api";

export function Loading({ label = "Đang tải dữ liệu từ Supabase…" }: { label?: string }) {
  return <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{label}</div>;
}

export function ErrorBox({ error, onRetry }: { error: ApiClientError | Error | string; onRetry?: () => void }) {
  const message = typeof error === "string" ? error : error.message;
  const details = typeof error === "object" && "details" in error ? error.details : undefined;
  const list = Array.isArray(details) ? details : (details as { errors?: string[] } | undefined)?.errors;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">{message}</div>
      {list && list.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">{list.map((e, i) => <li key={i}>{String(e)}</li>)}</ul>
      )}
      {onRetry && <button onClick={onRetry} className="mt-3 text-xs font-medium underline">Thử lại</button>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}
