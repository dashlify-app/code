import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque, DM_Mono, Instrument_Sans, Syne } from "next/font/google";
import "./globals.css";
import "@/styles/dashlify-landing.css";
import "@/styles/dashlify-admin.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Dashlify.app — Dashboards con IA",
  description: "Sube tus datos. La IA interpreta, propone y construye dashboards sin prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${dmMono.variable} ${instrumentSans.variable} ${syne.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap"
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
