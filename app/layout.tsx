import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { getSiteSettings } from '@/lib/settings'

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin', 'vietnamese'],
  weight: ['700', '800'],
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const pageTitle = settings.siteTitle?.trim() || `${settings.siteName} - Hệ thống phân phối tài khoản tự động`
  const faviconUrl = settings.logoUrl || '/favicon.ico'

  return {
    title: pageTitle,
    description: 'Hệ thống phân phối tài khoản, key bản quyền và dịch vụ số tự động 24/7.',
    icons: {
      icon: [{ url: faviconUrl }],
      shortcut: [faviconUrl],
      apple: [faviconUrl],
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = await getSiteSettings()
  const faviconUrl = settings.logoUrl || '/favicon.ico'

  return (
    <html lang="vi" className="dark">
      <head>
        <link rel="icon" href={faviconUrl} />
        <link rel="shortcut icon" href={faviconUrl} />
        <link rel="apple-touch-icon" href={faviconUrl} />
      </head>
      <body
        className={`${beVietnamPro.variable} ${plusJakartaSans.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
