'use client';

import { LabCard, type LabData } from "@/features/results/components/lab-card";
import { MentorCard, type MentorData } from "@/features/results/components/mentor-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCw, AlertTriangle } from "lucide-react"; // AlertTriangle 아이콘 추가
import Link from "next/link";
import { useRouter } from 'next/navigation'; // useRouter 임포트 추가
import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast"; // 제공된 예시 코드를 따라 이 경로로 수정
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface LabDetailData extends LabData {
  projects: string[];
  publicationTrends: { year: number | string; count: number }[];
  memberCount: number;
  mentors: MentorData[];
  careerScenario: string;
}

interface SearchCriteria {
    major: string;
    keywords: string;
    educationLevel: string;
    additionalInfo?: string;
}

interface PublicationChartProps {
  data: { year: number | string; count: number }[];
}

const PublicationTrendChart: React.FC<PublicationChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-4">논문 트렌드 데이터가 제공되지 않았습니다.</p>;
  }
  const chartData = data.map(item => ({ ...item, year: String(item.year) }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="#64748b"/>
        <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem'}} 
            labelStyle={{ color: '#cbd5e1', fontWeight: 'bold'}}
            itemStyle={{ color: '#94a3b8' }}
        />
        <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}/>
        <Bar dataKey="count" name="논문 수" fill="#38bdf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};


export default function ResultsPage() {
  const router = useRouter(); // useRouter 초기화
  const { toast } = useToast();
  const [loading, setLoading] = useState(true); // 초기 페이지 로드 상태
  const [reFetching, setReFetching] = useState(false); // 새로고침 API 호출 상태
  const [results, setResults] = useState<LabDetailData[]>([]);
  const [selectedLab, setSelectedLab] = useState<LabDetailData | null>(null);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; details?: string } | null>(null);

  const fetchAndSetResults = useCallback(async (criteria: SearchCriteria | null, isInitialLoad = false) => {
    if (!criteria) {
        if (!isInitialLoad) {
            toast({ title: "검색 조건 없음", description: "새로고침할 검색 조건이 없습니다. 홈페이지에서 다시 검색해주세요.", variant: "destructive", duration: 5000 });
        }
        setLoading(false); // 초기 로드 시 criteria 없으면 로딩 완료
        setErrorState({ message: "검색 조건이 없어 추천 결과를 가져올 수 없습니다. 홈페이지에서 검색을 시작해주세요." });
        return;
    }

    if (isInitialLoad) setLoading(true);
    else setReFetching(true);
    setErrorState(null); // 이전 오류 상태 초기화

    try {
        const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(criteria),
        });

        const responseData = await response.json();

        if (!response.ok) {
            const errorMsg = responseData.error || "추천 데이터를 다시 가져오는데 실패했습니다.";
            const errorDetails = typeof responseData.details === 'string' ? responseData.details : JSON.stringify(responseData.details);
            console.error(`[ResultsPage] API Error: ${errorMsg}`, errorDetails);
            throw new Error(`${errorMsg}${errorDetails ? ` (상세: ${errorDetails.substring(0, 100)}...)` : ''}`);
        }
        
        const newResults: LabDetailData[] = responseData;
        localStorage.setItem('recommendationResults', JSON.stringify(newResults));
        localStorage.setItem('lastSearchCriteria', JSON.stringify(criteria)); // 검색 조건도 업데이트/저장
        
        setResults(newResults);
        setSearchCriteria(criteria); // 현재 검색 조건 업데이트
        if (newResults.length > 0) {
            setSelectedLab(newResults[0]);
        } else {
            setSelectedLab(null);
            // 결과가 없을 경우, 사용자에게 알림 (API는 성공했으나 데이터가 없는 경우)
            toast({ title: "검색 결과 없음", description: "입력하신 조건에 맞는 연구소를 찾지 못했습니다. 다른 키워드로 시도해보세요.", variant: "default", duration: 7000 });
        }
        if (!isInitialLoad) {
            toast({ title: "결과 새로고침 완료", description: "최신 추천 정보를 성공적으로 불러왔습니다.", duration: 3000 });
        }

    } catch (error: any) {
        console.error("[ResultsPage] fetchAndSetResults 오류:", error);
        const errorMessage = error.message || "데이터 로드 중 알 수 없는 오류 발생";
        setErrorState({ message: "추천 정보를 가져오는데 실패했습니다.", details: errorMessage });
        toast({ title: "데이터 로드 오류", description: errorMessage, variant: "destructive", duration: 7000 });
        // 오류 발생 시 기존 결과는 유지하거나, 비울 수 있음 (현재는 유지)
    } finally {
        if (isInitialLoad) setLoading(false);
        else setReFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    const storedCriteriaString = localStorage.getItem('lastSearchCriteria');
    let initialCriteria: SearchCriteria | null = null;

    if (storedCriteriaString) {
        try {
            initialCriteria = JSON.parse(storedCriteriaString);
            setSearchCriteria(initialCriteria);
        } catch (e) {
            console.error("[ResultsPage] localStorage criteria 파싱 오류:", e);
            localStorage.removeItem('lastSearchCriteria');
            toast({ title: "오류", description: "저장된 검색 조건 로드 실패.", variant: "destructive", duration: 5000});
        }
    }

    const storedResultsString = localStorage.getItem('recommendationResults');
    if (storedResultsString) {
        try {
            const parsedResults = JSON.parse(storedResultsString) as LabDetailData[];
            setResults(parsedResults);
            if (parsedResults.length > 0) {
                setSelectedLab(parsedResults[0]);
            }
            setLoading(false); // 로컬 데이터로 우선 표시, 로딩 완료
            if (initialCriteria) { // 유효한 검색 조건이 있으면, 백그라운드에서 최신 데이터 가져오기 시도 (선택적)
                 // fetchAndSetResults(initialCriteria, true); // 초기 자동 새로고침 원할 시 주석 해제
            } 
        } catch (e) {
            console.error("[ResultsPage] localStorage results 파싱 오류:", e);
            localStorage.removeItem('recommendationResults');
            toast({ title: "오류", description: "저장된 결과 데이터가 손상되었습니다. 새로 검색해주세요.", variant: "destructive", duration: 7000});
            setLoading(false); // 파싱 오류 시 로딩 중단
            setErrorState({ message: "저장된 결과 로드에 실패했습니다.", details: "데이터 형식이 올바르지 않습니다." });
        }
    } else if (initialCriteria) {
        // 검색 조건은 있는데 결과가 로컬에 없으면 (예: 직접 URL로 접근) API 호출하여 가져오기
        fetchAndSetResults(initialCriteria, true);
    } else {
        // 검색 조건도 결과도 로컬에 없으면
        setLoading(false);
        setErrorState({ message: "표시할 추천 결과가 없습니다.", details: "홈페이지에서 검색을 시작해주세요." });
        toast({ title: "정보 없음", description: "홈페이지에서 검색을 시작해주세요.", duration: 7000 });
    }
}, [toast, fetchAndSetResults]); // fetchAndSetResults를 의존성 배열에서 제거 (내부에서 router 사용 안함)

  const handleLabSelect = (labId: string) => {
    const lab = results.find(r => r.id === labId);
    setSelectedLab(lab || null);
  };
  
  const handleRefresh = () => {
    if (searchCriteria) {
        fetchAndSetResults(searchCriteria, false); // isInitialLoad = false
    } else {
        toast({ title: "새로고침 불가", description: "현재 검색 조건이 없어 새로고침할 수 없습니다.", variant: "destructive"});
    }
  };

  if (loading) return <ResultsSkeleton />;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
            <Link href="/" legacyBehavior>
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> 뒤로가기
                </Button>
            </Link>
            <Button variant="outline" onClick={handleRefresh} disabled={reFetching || !searchCriteria || loading} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                <RotateCw className={cn("mr-2 h-4 w-4", reFetching && "animate-spin")} />
                {reFetching ? "새로고침 중..." : "결과 새로고침"}
            </Button>
        </div>
        <h1 className="text-3xl font-bold mt-4">추천 연구소 및 멘토</h1>
        {searchCriteria && (
            <p className="text-slate-400">
                현재 검색 조건: 전공({searchCriteria.major}), 관심키워드({searchCriteria.keywords}), 학력({searchCriteria.educationLevel})
            </p>
        )}
      </header>

      {errorState && (
        <div className="text-center py-10 bg-slate-800/50 rounded-lg shadow-lg my-6 p-6">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
            <p className="text-xl text-yellow-300 mb-2">오류: {errorState.message}</p>
            {errorState.details && <p className="text-sm text-slate-400">상세 정보: {errorState.details}</p>}
            <Button onClick={() => router.push('/')} className="mt-6">홈으로 돌아가기</Button>
        </div>
      )}

      {!errorState && results.length === 0 && !loading && (
        <div className="text-center py-10">
          <p className="text-xl text-slate-400">추천 결과를 찾을 수 없습니다.</p>
          <p className="text-slate-500">입력하신 조건에 맞는 연구소를 찾지 못했습니다. 검색 조건을 변경하여 다시 시도해보세요.</p>
        </div>
      )}

      {!errorState && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4 h-full md:max-h-[calc(100vh-14rem)] md:overflow-y-auto pr-2 custom-scrollbar">
            <h2 className="text-xl font-semibold text-slate-200 mb-3 sticky top-0 bg-slate-900 py-2 z-10">추천 연구소 ({results.length}곳)</h2>
            {results.map((lab) => (
              <LabCard 
                key={lab.id} 
                lab={lab} 
                onSelect={() => handleLabSelect(lab.id)} 
                isSelected={selectedLab?.id === lab.id}
              />
            ))}
          </div>

          {selectedLab ? (
            <div className="md:col-span-2 space-y-6 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto custom-scrollbar pr-1">
              <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="flex items-start sm:items-center mb-4 flex-col sm:flex-row">
                    <img src={selectedLab.logoUrl} alt={`${selectedLab.name} 로고`} className="w-20 h-20 rounded-md mr-0 sm:mr-4 mb-3 sm:mb-0 object-cover border border-slate-600" />
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-sky-400">{selectedLab.name}</h2>
                        <p className="text-sm text-slate-400">키워드: {selectedLab.keywords.join(', ')}</p>
                        <p className="text-sm text-slate-400">일치율: <span className="font-semibold text-green-400">{selectedLab.matchRate}%</span></p>
                    </div>
                </div>
                
                <h3 className="text-lg font-semibold mt-6 mb-2 text-slate-300">주요 프로젝트</h3>
                <ul className="list-disc list-inside text-slate-400 space-y-1 pl-2">
                    {selectedLab.projects.map(p => <li key={p}>{p}</li>)}
                </ul>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-slate-300">논문 트렌드</h3>
                <div className="p-4 bg-slate-700/50 rounded min-h-[280px] flex items-center justify-center">
                    <PublicationTrendChart data={selectedLab.publicationTrends} />
                </div>
                <p className="text-xs text-slate-500 mt-1">연구실 규모: 약 {selectedLab.memberCount}명</p>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-slate-300">AI 기반 커리어 시나리오</h3>
                <p className="text-slate-300 bg-slate-700/50 p-4 rounded-md italic leading-relaxed">
                    {selectedLab.careerScenario}
                </p>
              </section>

              {selectedLab.mentors && selectedLab.mentors.length > 0 && (
                <section>
                    <h2 className="text-xl font-semibold text-slate-200 mb-3">멘토 후보 ({selectedLab.mentors.length}명)</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedLab.mentors.map((mentor) => (
                        <MentorCard key={mentor.id} mentor={mentor} />
                    ))}
                    </div>
                </section>
              )}
            </div>
          ) : (
             (!loading && results.length > 0 && !errorState) && (
                <div className="md:col-span-2 flex items-center justify-center text-slate-500 h-full">
                    <p>왼쪽 목록에서 연구소를 선택하여 상세 정보를 확인하세요.</p>
                </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

const ResultsSkeleton = () => (
  // Skeleton UI는 이전과 동일하게 유지
  <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 animate-pulse">
    <header className="mb-8">
        <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
        </div>
      <Skeleton className="h-10 w-3/4 mt-4" />
      <Skeleton className="h-5 w-1/2 mt-2" />
    </header>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <Skeleton className="h-8 w-48 mb-3" />
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-800 p-4 rounded-lg shadow">
            <div className="flex items-start space-x-4">
              <Skeleton className="w-16 h-16 rounded-md mr-3" />
              <div className="flex-1">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6 mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="md:col-span-2 space-y-6">
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-start sm:items-center mb-4 flex-col sm:flex-row">
            <Skeleton className="w-20 h-20 rounded-md mr-0 sm:mr-4 mb-3 sm:mb-0" />
            <div className="flex-1">
              <Skeleton className="h-7 w-full sm:w-3/4 mb-2" />
              <Skeleton className="h-4 w-full sm:w-5/6 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-5 w-32 mt-8 mb-3" />
          <Skeleton className="h-4 w-full mb-1.5" />
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-4/5 mb-4" />
          
          <Skeleton className="h-5 w-36 mt-8 mb-3" />
          <Skeleton className="h-[250px] w-full mb-4" /> 
          <Skeleton className="h-4 w-28 mt-1 mb-4" />

          <Skeleton className="h-5 w-40 mt-8 mb-3" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div>
          <Skeleton className="h-6 w-40 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-800 p-4 rounded-lg shadow text-center">
                <Skeleton className="w-20 h-20 rounded-full mx-auto mb-3" />
                <Skeleton className="h-5 w-24 mx-auto mb-1.5" />
                <Skeleton className="h-3 w-32 mx-auto mb-3" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
); 