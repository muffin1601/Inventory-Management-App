import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AppProviders } from "@/components/ui/AppProviders";

export const metadata: Metadata = {
  title: "Watcon International - Inventory Management",
  description: "Inventory, projects, BOQ, procurement, and reporting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
