import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tef-stock-bib-endurance.vercel.app'),
  title: 'ระบบสต๊อกเสื้อ BIB / BIB Shirt Inventory',
  description:
    'ระบบจัดการเสื้อสำหรับการแข่งขัน Endurance (BIB) สำหรับนักกีฬา เจ้าหน้าที่ และกรรมการตัดสิน พร้อมเบิก จ่าย คืน และย้าย.',
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
