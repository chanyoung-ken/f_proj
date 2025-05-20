"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
// import type { ThemeProviderProps } from "next-themes/dist/types"; // 주석 처리 또는 삭제

// ThemeProviderProps 직접 정의 (라이브러리 타입 경로 문제 시)
interface CustomThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  // next-themes의 다른 유효한 prop들도 필요에 따라 추가 가능
  [key: string]: any; // 나머지 props를 받을 수 있도록
}

export function ThemeProvider({
  children,
  ...props
}: CustomThemeProviderProps) {
  return (
    <NextThemesProvider {...props as any}>
      {children}
    </NextThemesProvider>
  );
} 