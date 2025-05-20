import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

// --- 환경 변수 로드 --- (Next.js 런타임에서 process.env 로 자동 주입)
const ORCID_API_BASE_URL = process.env.ORCID_API_BASE_URL || "https://pub.orcid.org/v3.0";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_EMBEDDING_MODEL = process.env.DEEPSEEK_EMBEDDING_MODEL || "deepseek-chat";
const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";

// OpenAI SDK 클라이언트 초기화 (DeepSeek 호환)
const openai = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL
});

// 요청 스키마
const recommendationRequestSchema = z.object({
  major: z.string().min(1),
  keywords: z.string().min(1),
  educationLevel: z.string().min(1),
  additionalInfo: z.string().optional(),
});

// Helper: cosine similarity
function dotProduct(a: number[], b: number[]) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}
function magnitude(v: number[]) {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}
function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  return dotProduct(a, b) / (magnitude(a) * magnitude(b));
}

// ORCID 검색
async function searchOrcid(query: string, rows = 10) {
  const url = `${ORCID_API_BASE_URL}/expanded-search?q=${encodeURIComponent(query)}&rows=${rows}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ORCID API ${res.status}`);
  const json = await res.json();
  return json['expanded-result'] || [];
}

// DeepSeek 임베딩
async function embedTextWithDeepSeek(text: string): Promise<number[] | null> {
  if (!text.trim()) return null;
  const resp = await openai.embeddings.create({
    model: DEEPSEEK_EMBEDDING_MODEL,
    input: text
  });
  const vec = resp.data?.[0]?.embedding;
  return Array.isArray(vec) ? vec as number[] : null;
}

// DeepSeek LLM 분석
async function analyzeWithDeepSeek(prompt: string): Promise<any> {
  const resp = await openai.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2000
  });
  const content = resp.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty DeepSeek response');
  return JSON.parse(content);
}

// 경로 파싱 헬퍼
function normalizeOrcidId(id: string) {
  return id.toLowerCase().replace(/-/g, '');
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = recommendationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { major, keywords, educationLevel, additionalInfo } = parsed.data;
  // 1) ORCID 검색
  const orcidQuery = `${major} ${keywords}`;
  let orcidItems = await searchOrcid(orcidQuery, 20);
  // 2) 사용자 임베딩
  const userEmbedding = await embedTextWithDeepSeek(`${major} ${keywords} ${educationLevel} ${additionalInfo || ''}`);
  // 3) ORCID 결과 임베딩 & 유사도 계산
  const enriched = [] as any[];
  for (const item of orcidItems) {
    const id = item['orcid-id'];
    const summary = item['work-title'] || item['name'];
    const vec = await embedTextWithDeepSeek(summary);
    const sim = userEmbedding && vec ? cosineSimilarity(userEmbedding, vec) : 0;
    enriched.push({ id, summary, similarity: sim });
  }
  enriched.sort((a,b) => b.similarity - a.similarity);
  const top = enriched.slice(0, 10);
  // 4) LLM 분석 프롬프트 생성
  const docs = top.map(x => `ORCID:${x.id} Similarity:${(x.similarity*100).toFixed(1)}% Content:${x.summary}`).join('\n');
  const llmPrompt = `추천 기준:\n사용자 전공:${major}, 키워드:${keywords}, 학력:${educationLevel}\n\n후보 목록:\n${docs}\n\n위 목록에서 상위 5개 연구실 추천하고 JSON으로 반환하세요.`;
  // 5) DeepSeek LLM 호출
  let recommendations = [];
  try {
    recommendations = await analyzeWithDeepSeek(llmPrompt);
  } catch (e: any) {
    console.error('LLM error', e);
    // fallback mock
    recommendations = [{ id: 'mock-lab', name: '[Mock] 연구실', matchRate: 80, mentors: [] }];
  }
  // 6) 후처리 및 응답
  return NextResponse.json(recommendations);
}