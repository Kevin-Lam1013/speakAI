import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ThemeWrapper from '@/components/ThemeWrapper';

// Server-side metadata
export const metadata: Metadata = {
  title: 'SpeakAI - Real-time Translation Platform',
  description: 'Break language barriers with real-time translation',
};

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeWrapper>{children}</ThemeWrapper>
      </body>
    </html>
  );
}
