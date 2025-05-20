'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, User } from "lucide-react"; // 아이콘 추가

export interface MentorData {
  id: string;
  avatarUrl?: string; // 아바타는 선택 사항
  name: string;
  title: string;
  profile: string; // 간략 프로필 또는 주요 연구 분야
}

interface MentorCardProps {
  mentor: MentorData;
}

export function MentorCard({ mentor }: MentorCardProps) {
  return (
    <Card className="bg-slate-800 border-slate-700 hover:shadow-sky-500/30 transition-shadow duration-200">
      <CardHeader className="items-center pb-4">
        <Avatar className="w-20 h-20 mb-3 border-2 border-slate-600">
          <AvatarImage src={mentor.avatarUrl || `https://picsum.photos/seed/${mentor.id}/100/100`} alt={mentor.name} />
          <AvatarFallback className="bg-slate-700 text-slate-400">
            {mentor.name.substring(0, 2).toUpperCase()} {/* 이름 앞 두 글자 대문자로 */}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="text-lg text-sky-400 text-center">{mentor.name}</CardTitle>
        <p className="text-xs text-slate-500 flex items-center">
            <Briefcase className="w-3 h-3 mr-1 text-slate-500"/> {mentor.title}
        </p>
      </CardHeader>
      <CardContent className="text-center pt-0">
        <p className="text-sm text-slate-300 leading-relaxed px-2">
          {mentor.profile}
        </p>
        {/* <Badge variant="outline" className="mt-3 bg-slate-700 border-slate-600 text-slate-400">연구분야</Badge> */}
      </CardContent>
    </Card>
  );
} 