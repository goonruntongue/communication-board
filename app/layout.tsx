import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./css/theme-soft.css";
import "./css/theme-skeuo.css";
import RegisterSW from "@/components/RegisterSW";
import NavProgress from "@/components/NavProgress";
import { MODE_STORAGE_KEY, THEME_STORAGE_KEY } from "@/lib/theme";

// 前回選んだテーマとライト／ダークを、画面が描かれる前に反映する（描いてから切り替えると一瞬ちらつくため）
const THEME_BOOT_SCRIPT = `try{var d=document.documentElement.dataset;if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="skeuo")d.theme="skeuo";if(localStorage.getItem(${JSON.stringify(
  MODE_STORAGE_KEY,
)})==="dark")d.mode="dark"}catch(e){}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Communication Board",
  description: "開発のアイディアなどを話し合うためのカンバンボードだよ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <RegisterSW />
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
