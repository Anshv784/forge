import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ClusterProvider } from "@/components/providers/cluster-provider";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Carapace Console",
  description: "On-chain enforced spending guardrails for autonomous ZeroClaw agents.",
};

// Applies the persisted theme before first paint so there is no
// flash-of-wrong-theme when a user has explicitly chosen light/dark.
const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("carapace-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <ClusterProvider>
            <WalletProvider>
              <ToastProvider>{children}</ToastProvider>
            </WalletProvider>
          </ClusterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
