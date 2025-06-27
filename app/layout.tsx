import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeWrapper from '@/components/ThemeWrapper';

// Server-side metadata
export const metadata: Metadata = {
  title: 'SpeakAI - Real-time Translation Platform',
  description: 'Break language barriers with real-time translation',
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <ThemeWrapper>{children}</ThemeWrapper>
      </body>
    </html>
  );
}
