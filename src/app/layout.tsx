import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Tailwind CSS 및 global styles
import { ThemeProvider } from "@/components/theme-provider"; // shadcn-ui 테마 프로바이더 (설치 필요)
import { ToastProvider } from "@/components/ui/toast"; // Shadcn 문서대로라면 ToastProvider가 없을 수 있음.
                                                      // 일반적으로 Toaster를 사용하고 useToast로 호출함.
                                                      // 만약 shadcn-ui가 ToastProvider를 제공한다면 이 경로가 맞을 수 있음.
                                                      // 보통은 ToastProvider 대신 Toaster를 RootLayout에 둡니다.
import { Toaster as RadixToaster } from "@/components/ui/toaster"; // shadcn의 Toaster를 명시적으로 사용

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
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* <ToastProvider> // Shadcn UI의 일반적인 패턴은 ToastProvider가 아닌 Toaster를 사용합니다. */}
            {children}
            <RadixToaster /> {/* Toaster를 여기에 배치합니다. */} 
          {/* </ToastProvider> */}
        </ThemeProvider>
      </body>
    </html>
  );
} 