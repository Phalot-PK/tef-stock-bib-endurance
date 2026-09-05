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
  title: 'ระบบสต๊อกเสื้อ BIB Endurance',
  description: 'ค้นหาตำแหน่งเสื้อ BIB และบันทึกการเบิก จ่าย คืน',
  openGraph: {
    title: 'ระบบสต๊อกเสื้อ BIB Endurance',
    description: 'ค้นหา • เบิก • จ่าย • คืน',
    type: 'website',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ระบบสต๊อกเสื้อ BIB Endurance',
    description: 'ค้นหา • เบิก • จ่าย • คืน',
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
