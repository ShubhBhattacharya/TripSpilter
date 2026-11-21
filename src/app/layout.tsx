import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../components/auth/AuthProvider";
import { OnboardingModal } from "../components/auth/OnboardingModal";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "TripSplit — Direct-to-Vendor UPI Bill Splitter & Trip Planner",
  description:
    "All-in-one collaborative trip planner, outing manager, and direct-to-vendor UPI bill splitter for India.",
};

export const viewport: Viewport = {
  themeColor: "#173B70",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F4F7FB] text-[#172B4D] font-sans selection:bg-[#1685D4]/20 selection:text-[#173B70]">
        <AuthProvider>
          {children}
          <OnboardingModal />
          <Toaster
            position="top-right"
            theme="light"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: '#FFFFFF',
                border: '1px solid #E5EAF1',
                color: '#172B4D',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
