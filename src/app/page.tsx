'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";

// Zod 스키마 정의
const profileFormSchema = z.object({
  major: z.string().min(1, "전공을 입력해주세요."),
  keywords: z.string().min(1, "관심 키워드를 하나 이상 입력해주세요."), // 예시: "AI, Robotics, HCI"
  educationLevel: z.string().min(1, "현재 학력을 선택해주세요."),
  additionalInfo: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      major: "",
      keywords: "",
      educationLevel: "",
      additionalInfo: "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseData = await response.json(); // 응답을 먼저 파싱

      if (!response.ok) {
        // API가 { error: "...", details: "..." } 또는 { error: "...", details: { fieldErrors: { ... }} } 형식으로 응답한다고 가정
        let errorMessage = responseData.error || "추천 데이터를 가져오는데 실패했습니다.";
        if (responseData.details) {
            if (typeof responseData.details === 'string') {
                errorMessage += ` (상세: ${responseData.details})`;
            } else if (responseData.details.fieldErrors) { // Zod 유효성 검사 오류
                const fieldErrors = Object.entries(responseData.details.fieldErrors)
                    .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
                    .join('; ');
                errorMessage = `입력값 오류: ${fieldErrors || responseData.error}`;
            }
        }
        throw new Error(errorMessage);
      }
      
      // 성공 시 results는 responseData 자체가 됨 (LabRecommendation[] 타입으로 가정)
      localStorage.setItem('recommendationResults', JSON.stringify(responseData));
      localStorage.setItem('lastSearchCriteria', JSON.stringify(data));

      toast({
        title: "AI 추천 검색 완료!",
        description: "최적의 연구소와 멘토를 찾았습니다. 결과 페이지로 이동합니다.",
        duration: 3000,
      });

      router.push(`/results`);

    } catch (error: any) {
      console.error("[HomePage] API 호출 또는 처리 오류:", error);
      toast({
        title: "오류 발생",
        description: error.message || "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://picsum.photos/seed/labfinderpage/1920/1080')] bg-cover bg-center opacity-10 z-0"></div>
      <div className="z-10 flex flex-col items-center text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          LabFinder+
        </h1>
        <p className="text-xl text-slate-300 mb-8 max-w-2xl">
          AI가 당신의 연구 여정을 위한 최적의 연구소와 멘토를 찾아드립니다. <br />
          전공, 관심 분야, 학력을 입력하고 맞춤 추천을 받아보세요.
        </p>
      </div>

      <Card className="w-full max-w-lg z-10 bg-slate-800/80 backdrop-blur-md border-slate-700">
        <CardHeader>
          <CardTitle className="text-2xl text-white">연구소 찾기</CardTitle>
          <CardDescription className="text-slate-400">
            아래 정보를 입력하고 맞춤 연구소 및 멘토 추천을 받아보세요.
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="major" className="text-slate-300">전공 <span className="text-red-500">*</span></Label>
              <Input id="major" placeholder="예: 컴퓨터공학, 생명과학" {...form.register("major")} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" disabled={isLoading} />
              {form.formState.errors.major && (
                <p className="text-sm text-red-400">{form.formState.errors.major.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords" className="text-slate-300">관심 키워드 (쉼표로 구분) <span className="text-red-500">*</span></Label>
              <Input id="keywords" placeholder="예: 인공지능, 머신러닝, 데이터 분석" {...form.register("keywords")} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" disabled={isLoading} />
              {form.formState.errors.keywords && (
                <p className="text-sm text-red-400">{form.formState.errors.keywords.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="educationLevel" className="text-slate-300">현재 학력 <span className="text-red-500">*</span></Label>
              <Controller
                control={form.control}
                name="educationLevel"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                    <SelectTrigger id="educationLevel" className="w-full bg-slate-700 border-slate-600 text-white placeholder:text-slate-500">
                      <SelectValue placeholder="학력 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 text-white">
                      <SelectItem value="undergraduate" className="hover:bg-slate-600">학부생</SelectItem>
                      <SelectItem value="masters_applicant" className="hover:bg-slate-600">석사 준비생</SelectItem>
                      <SelectItem value="masters_student" className="hover:bg-slate-600">석사 과정생</SelectItem>
                      <SelectItem value="phd_applicant" className="hover:bg-slate-600">박사 준비생</SelectItem>
                      <SelectItem value="phd_student" className="hover:bg-slate-600">박사 과정생</SelectItem>
                      <SelectItem value="postdoc" className="hover:bg-slate-600">박사후 연구원</SelectItem>
                      <SelectItem value="early_career_researcher" className="hover:bg-slate-600">초기 경력 연구원</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.educationLevel && (
                <p className="text-sm text-red-400">{form.formState.errors.educationLevel.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalInfo" className="text-slate-300">추가 정보 (선택)</Label>
              <Textarea
                id="additionalInfo"
                placeholder="선호하는 연구 환경, 특정 기술 스택 경험 등 자유롭게 작성해주세요."
                {...form.register("additionalInfo")}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 min-h-[100px]"
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 추천 검색 중...
                </>
              ) : "AI로 연구소 찾기"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-12 text-center text-sm text-slate-400 z-10">
        © {new Date().getFullYear()} LabFinder+. All rights reserved.
        <p>Powered by AI & Your Curiosity.</p>
      </footer>
    </main>
  );
} 