import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../components/auth/AuthProvider";
import { OnboardingModal } from "../components/auth/OnboardingModal";

export const metadata: Metadata = {
  title: "TripSplit — Direct-to-Vendor UPI Bill Splitter & Trip Planner",
  description:
    "All-in-one collaborative trip planner, outing manager, and direct-to-vendor UPI bill splitter for India.",
};

export const viewport: Viewport = {
  themeColor: "#0B1120",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0B1120] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
        <AuthProvider>
          {children}
          <OnboardingModal />
        </AuthProvider>
      </body>
    </html>
  );
}
