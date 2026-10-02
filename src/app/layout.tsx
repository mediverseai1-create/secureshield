import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://secureshieldai.click"),
  title: { default: "SecureShield AI — AI for sales calls, follow-ups and pipeline", template: "%s · SecureShield AI" },
  description:
    "SecureShield AI listens to your sales calls, reads your pipeline and writes the follow-ups and briefings your team needs to close more deals.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b1f3a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
