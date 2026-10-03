import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:py-8">{children}</main>
    </>
  );
}
