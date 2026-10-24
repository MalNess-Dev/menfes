import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Simple IG Menfess — Kirim Pesan Menfess Anonim",
  description:
    "Kirim pesan menfess anonim ke Instagram secara otomatis. Tanpa filter konten, publik, dan diposting dalam format slide carousel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased dark`}>
      <head>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#060d0e] text-zinc-100 font-sans selection:bg-[#006569] selection:text-white">
        {children}
      </body>
    </html>
  );
}
