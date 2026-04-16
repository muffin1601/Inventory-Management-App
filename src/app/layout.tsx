import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "@/components/Layout.module.css";

export const metadata: Metadata = {
  title: "Watcon International - Dashboard",
  description: "Watcon International Inventory & BI Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className={styles.layout}>
          <Sidebar />
          <main className={styles.main}>
            <Header />
            <div className={styles.pageContent}>
              {children}
            </div>
            <Footer />
          </main>
        </div>
      </body>
    </html>
  );
}
