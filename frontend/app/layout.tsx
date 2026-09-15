import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataAnalyst.Ai - Autonomous AI Data Analyst & BI Studio",
  description:
    "Automate exploratory data analysis, root-cause diagnostics, and Power BI report package generation through autonomous multi-agent workflows.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-canvas text-primaryText antialiased selection:bg-accent-violet selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
