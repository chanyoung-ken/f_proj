'use client';

import { cn } from "@/lib/utils"; // shadcn-ui 유틸리티
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

export interface LabData {
  id: string; // 이전에 누락되었던 ID 필드 추가
  logoUrl: string;
  name: string;
  keywords: string[];
  matchRate: number;
  // 필요에 따라 상세 정보 페이지에서만 사용될 다른 필드들도 LabDetailData 등으로 확장 가능
}

interface LabCardProps {
  lab: LabData;
  onSelect: () => void;
  isSelected: boolean;
}

export function LabCard({ lab, onSelect, isSelected }: LabCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all duration-200 ease-in-out",
        "bg-slate-800 border-slate-700 hover:bg-slate-700/70 hover:border-sky-600",
        isSelected && "bg-sky-700/30 border-sky-500 ring-2 ring-sky-500 shadow-lg"
      )}
    >
      <div className="flex items-start space-x-4">
        <img 
          src={lab.logoUrl || `https://picsum.photos/seed/${lab.id}/80/80`} 
          alt={`${lab.name} 로고`} 
          className="w-16 h-16 rounded-md object-cover border border-slate-600"
        />
        <div className="flex-1">
          <h3 className={cn("font-semibold text-lg mb-1", isSelected ? "text-sky-300" : "text-slate-100")}>
            {lab.name}
          </h3>
          <div className="flex items-center text-sm text-slate-400 mb-2">
            <TrendingUp className={cn("w-4 h-4 mr-1.5", isSelected ? "text-sky-400" : "text-green-400")} />
            <span>일치율: {lab.matchRate}%</span>
          </div>
          
        </div>
      </div>
      {lab.keywords && lab.keywords.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1.5">주요 키워드:</p>
          <div className="flex flex-wrap gap-1.5">
            {lab.keywords.slice(0, 5).map((keyword) => (
              <Badge 
                key={keyword} 
                variant={isSelected ? "default" : "secondary"}
                className={cn(isSelected ? "bg-sky-500/20 text-sky-300 border-sky-500/50" : "bg-slate-700 text-slate-300 border-slate-600")}
              >
                {keyword}
              </Badge>
            ))}
            {lab.keywords.length > 5 && (
                 <Badge variant="outline" className="border-slate-600 text-slate-400">...</Badge>
            )}
          </div>
        </div>
        )}
    </div>
  );
} 