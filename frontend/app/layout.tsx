import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { WalletProvider } from "../components/web3/WalletProvider";

export const metadata: Metadata = {
  title: "Crossy Chicken Bet | Monad Demo",
  description: "Crossy chicken game with mock betting HUD on Next.js.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
