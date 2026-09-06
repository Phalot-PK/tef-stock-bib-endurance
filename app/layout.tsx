import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bib-stock-endurance.sweetminty1.chatgpt.site'),
  title: 'ระบบสต๊อกเสื้อ BIB / BIB Shirt Inventory',
  description:
    'จัดกลุ่มเสื้อ BIB, Officials และ Photo พร้อมเบิก จ่าย คืน และย้าย / Grouped stock with withdrawal, issue, return, and transfer.',
  openGraph: {
    title: 'ระบบสต๊อกเสื้อ BIB / BIB Shirt Inventory',
    description: 'BIB • Officials • Photo · เบิก • จ่าย • คืน • ย้าย',
    type: 'website',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ระบบสต๊อกเสื้อ BIB / BIB Shirt Inventory',
    description: 'BIB • Officials • Photo · Withdraw • Issue • Return • Transfer',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
