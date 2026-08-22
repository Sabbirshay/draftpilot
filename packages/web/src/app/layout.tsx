import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "DraftPilot | AI-drafted replies, inside the inbox you already use",
  description: "Stop copy-pasting from shared docs. DraftPilot reads the conversation, finds the right answer from your team's knowledge base, and drafts a reply — all without leaving Gmail.",
  openGraph: {
    title: "DraftPilot | AI-drafted replies in Gmail",
    description: "Your macros, your voice. Zero migration AI support assistant.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DraftPilot | AI-drafted replies in Gmail",
    description: "Your macros, your voice. Zero migration AI support assistant.",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased min-h-screen flex flex-col bg-bg text-text">
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
