import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YCCMS Prototype — Yuki Cold-Chain",
  description: "Prototype kho lạnh Yuki: kiểm hàng nhập/xuất, FIFO, chặn 日付逆転",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
