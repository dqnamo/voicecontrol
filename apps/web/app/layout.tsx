import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetBrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  description:
    "Add Jev-powered voice actions to React interfaces with composable primitives and your own model infrastructure.",
  title: "VoiceControl — Headless voice actions for React",
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#fdfcfd",
  width: "device-width",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${inter.variable} ${jetBrainsMono.variable}`} lang="en">
      <body className="root bg-grayscale-1">{children}</body>
    </html>
  );
}
