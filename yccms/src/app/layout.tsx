import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YCCMS — Yuki Cold-Chain",
  description: "Yuki Cold-Chain Management System: nhập kho, tồn kho, xuất kho 3 dải nhiệt",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
