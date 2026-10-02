import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      <AppSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
        <footer className="mx-auto mt-10 max-w-7xl text-xs text-slate-400">
          Prototype — dữ liệu trong database là bộ mock đổ sẵn, không phải dữ liệu nghiệp vụ thật.
        </footer>
      </main>
    </div>
  );
}
