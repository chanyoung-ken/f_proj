import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Tailwind CSS 및 global styles
import { ThemeProvider } from "@/components/theme-provider"; // 방금 생성한 ThemeProvider
import { Toaster } from "@/components/ui/toaster"; // 기존 Toaster 사용

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LabFinder+ : AI 기반 연구소 추천",
  description: "당신의 연구 여정을 도와줄 최적의 연구소와 멘토를 찾아보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class" // next-themes의 ThemeProvider에 전달될 props
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange // Next.js 13+ App Router와 함께 사용할 때 깜빡임 방지
        >
          {children}
          <Toaster /> 
        </ThemeProvider>
      </body>
    </html>
  );
} 