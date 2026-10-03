"use client";

import { ErrorBox, Loading } from "@/components/async-state";
import type { Me } from "@/components/app-header";
import { Badge, Card, PageHeader } from "@/components/ui-primitives";
import { useApi } from "@/lib/client/use-api";

// Placeholder home until SCR-01 (dashboard) is built — proves the browser → API route → Supabase (RLS) path.
export default function HomePage() {
  const { data, error, loading, reload } = useApi<Me>("/api/me");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <PageHeader title="YCCMS" subtitle="Môi trường phát triển local — các màn nghiệp vụ sẽ được dựng theo docs/development-roadmap.md" />
      <Card title="Phiên đăng nhập">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">Họ tên</dt><dd>{data.full_name}</dd></div>
          <div><dt className="text-xs text-slate-500">Email</dt><dd>{data.email}</dd></div>
          <div>
            <dt className="text-xs text-slate-500">Vai trò</dt>
            <dd className="mt-1 flex flex-wrap gap-1">{data.roles.map((r) => <Badge key={r} tone="blue">{r}</Badge>)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
