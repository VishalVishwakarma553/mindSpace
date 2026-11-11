import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-google-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MeetMind", template: "%s · MeetMind" },
  description: "Local-first AI meeting assistant: record Google Meet, get transcripts, summaries and action items.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={googleSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
