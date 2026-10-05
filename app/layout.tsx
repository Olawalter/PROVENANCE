import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { GeistMono } from "geist/font/mono";

import "./globals.css";
import { Shell } from "@/components/shell/shell";
import { WalletProvider } from "@/lib/wallet/wallet";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PROVENANCE: evidence becomes state",
  description:
    "PROVENANCE turns public evidence into independently adjudicated, "
    + "time-bound semantic state finalized on GenLayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"
          className={`${inter.variable} ${instrumentSerif.variable} `
                     + `${GeistMono.variable}`}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
