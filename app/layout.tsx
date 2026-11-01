import type { Metadata } from 'next'
import { Space_Grotesk, Plus_Jakarta_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
})

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_STORE_NAME || 'ACCGIARE'} - Hệ thống phân phối tài khoản tự động`,
  description: 'Hệ thống phân phối tài khoản, key bản quyền và dịch vụ số tự động 24/7.',
  icons: { icon: '/logo.png' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${plusJakartaSans.variable} ${spaceMono.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
