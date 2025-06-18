import type { Metadata } from 'next'
import '@fontsource/inter/400.css'  // Regular weight
import '@fontsource/inter/500.css'  // Medium weight
import '@fontsource/inter/600.css'  // Semi-bold weight
import '@fontsource/inter/700.css'  // Bold weight
import './globals.css'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
