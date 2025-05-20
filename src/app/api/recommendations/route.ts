import { NextResponse } from "next/server";
import { z } from "zod";

// --- 환경 변수 로드 ( 실제 배포 환경에서는 빌드 시점에 주입됨 ) ---
// 로컬 개발 시 .env.local 파일에 아래와 같이 키를 설정해야 합니다.
// ORCID_API_BASE_URL=https://pub.orcid.org/v3.0
// DEEPSEEK_API_KEY=your_deepseek_api_key
// DEEPSEEK_BASE_URL=https://api.deepseek.com (예시, 실제 URL 확인 필요)
// DEEPSEEK_EMBEDDING_ENDPOINT=/v1/embeddings (예시, 실제 엔드포인트 확인 필요)
// DEEPSEEK_EMBEDDING_MODEL=deepseek-embed (예시, 실제 모델명 확인 필요)
// DEEPSEEK_EMBEDDING_VECTOR_PATH=data.0.embedding_vector (예시, 실제 경로 확인 필요)

const ORCID_API_BASE_URL = process.env.ORCID_API_BASE_URL || "https://pub.orcid.org/v3.0";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_CHAT_ENDPOINT = "/v1/chat/completions"; // 채팅 엔드포인트
const DEEPSEEK_EMBEDDING_ENDPOINT = process.env.DEEPSEEK_EMBEDDING_ENDPOINT || "/v1/embeddings"; // 기본 임베딩 엔드포인트, .env.local에서 설정 권장
const DEEPSEEK_CHAT_MODEL = "deepseek-chat"; // 기존 채팅 모델
const DEEPSEEK_EMBEDDING_MODEL = process.env.DEEPSEEK_EMBEDDING_MODEL || "deepseek-chat"; // 예시 임베딩 모델
// DeepSeek 임베딩 API 응답에서 실제 벡터 경로 (예: data.0.embedding_vector)
const DEEPSEEK_EMBEDDING_VECTOR_PATH = process.env.DEEPSEEK_EMBEDDING_VECTOR_PATH || "data.0.embedding"; // 기본값은 이전 코드와 동일하게, 필요시 .env로 수정

// let openai: OpenAI | null = null; // OpenAI 클라이언트 변수 제거
// if (OPENAI_API_KEY) {
// openai = new OpenAI({ apiKey: OPENAI_API_KEY });
// } else {
// console.warn("[API Route] OPENAI_API_KEY is not set. Career scenario generation will be skipped.");
// }

const recommendationRequestSchema = z.object({
  major: z.string().min(1, "전공은 필수입니다."),
  keywords: z.string().min(1, "관심 키워드는 필수입니다."),
  educationLevel: z.string().min(1, "학력은 필수입니다."),
  additionalInfo: z.string().optional(),
});

interface LabRecommendation {
  id: string;
  logoUrl: string;
  name: string;
  keywords: string[];
  matchRate: number; // 유사도 점수 또는 LLM 기반 matchRate
  projects: string[];
  publicationTrends: { year: string | number; count: number }[];
  memberCount: number;
  mentors: MentorRecommendation[];
  careerScenario: string;
  similarityScore?: number; // 임베딩 유사도 점수 (선택적)
}

interface MentorRecommendation {
  id: string;
  avatarUrl?: string;
  name: string;
  title: string;
  profile: string;
}

// --- 목업 데이터 (API 호출 실패 또는 개발 중 사용) ---
const MOCK_API_RESPONSE: LabRecommendation[] = [
  {
    id: "mock-lab-ai-detailed",
    logoUrl: "https://picsum.photos/seed/mockdetailedai/100/100",
    name: "[Mock] 미래 AI 융합 연구센터",
    keywords: ["인공지능", "데이터과학", "HCI", "로보틱스"],
    matchRate: 88,
    projects: ["인간-로봇 상호작용 고도화", "설명가능 AI (XAI) 모델 개발", "헬스케어 데이터 분석 플랫폼"],
    publicationTrends: [{ year: "2021", count: 8 }, { year: "2022", count: 12 }, { year: "2023", count: 18 }],
    memberCount: 25,
    mentors: [
      { id: "mock-mentor-ai-1", avatarUrl: "https://picsum.photos/seed/mockmA1/80/80", name: "이민호 교수", title: "센터장, 컴퓨터공학과 교수", profile: "기계학습 및 데이터 마이닝 전공, 다수 기업 과제 리드" },
      { id: "mock-mentor-ai-2", avatarUrl: "https://picsum.photos/seed/mockmA2/80/80", name: "박서준 연구원", title: "선임 연구원 (Ph.D)", profile: "자연어처리 및 딥러닝 응용, 전도유망한 신진 연구자" }
    ],
    careerScenario: "[Mock] 본 센터는 AI 핵심 기술과 다양한 응용 분야를 연구합니다. 참여 연구원들은 프로젝트 기반 학습과 국내외 학회 발표 기회를 통해 빠르게 성장하며, 졸업 후 학계 및 산업계의 주요 AI 연구 그룹으로 진출하는 경우가 많습니다."
  },
];

// --- Helper 함수 ---
function dotProduct(vecA: number[], vecB: number[]): number {
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

function magnitude(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    console.warn("[API Route] Invalid vectors for cosine similarity:", {vecA_len: vecA?.length, vecB_len: vecB?.length});
    return 0; // 유효하지 않은 입력 처리
  }
  const prod = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) {
    return 0; // 제로 벡터 처리
  }
  return prod / (magA * magB);
}

function normalizeOrcidId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.toLowerCase().replace(/-/g, "");
}

// 경로 문자열을 기반으로 객체에서 값을 안전하게 가져오는 함수
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/); // 배열 인덱스 처리 (예: data[0])
    if (arrayMatch) {
      current = current[arrayMatch[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2], 10)];
      } else {
        return undefined;
      }
    } else {
      current = current[key];
    }
    if (current === undefined) return undefined;
  }
  return current;
}

// --- API 호출 및 데이터 처리 함수 ---

async function embedTextWithDeepSeek(text: string): Promise<number[] | null> {
  if (!DEEPSEEK_API_KEY) {
    console.warn("[API Route] DEEPSEEK_API_KEY is not set. Text embedding will be skipped.");
    return null;
  }
  if (!text || text.trim() === "") {
    console.warn("[API Route] Empty text provided for embedding. Skipping.");
    return null;
  }

  const embeddingUrl = `${DEEPSEEK_BASE_URL}${DEEPSEEK_EMBEDDING_ENDPOINT}`; 
  console.log(`[API Route] Requesting embedding for text (first 50 chars): "${text.substring(0, 50)}..." from ${embeddingUrl}`);

  try {
    const response = await fetch(embeddingUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_EMBEDDING_MODEL, // DeepSeek에서 제공하는 임베딩 모델명 사용
        input: [text], // 일부 모델은 배열 형태로 입력을 받을 수 있음, 혹은 단일 문자열
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Route] DeepSeek Embedding API Error: ${response.status} - ${errorBody}`);
      throw new Error(`DeepSeek Embedding API 요청 실패 (상태: ${response.status})`);
    }

    const result = await response.json();
    // DeepSeek API 응답 구조에 따라 임베딩 벡터 추출 경로 수정 필요
    // DEEPSEEK_EMBEDDING_VECTOR_PATH 환경 변수 사용
    const embedding = getValueByPath(result, DEEPSEEK_EMBEDDING_VECTOR_PATH);
    
    if (!embedding || !Array.isArray(embedding) || embedding.some(isNaN)) {
      console.error("[API Route] Failed to extract valid embedding vector from DeepSeek response using path '" + DEEPSEEK_EMBEDDING_VECTOR_PATH + "':", JSON.stringify(result).substring(0,500));
      return null;
    }
    return embedding;
  } catch (error: any) {
    console.error("[API Route] DeepSeek Embedding API request failed:", error.message);
    return null;
  }
}

async function searchOrcid(query: string, rows: number = 10): Promise<any[]> {
  const url = `${ORCID_API_BASE_URL}/search/?q=${encodeURIComponent(query)}&rows=${rows}`;
  console.log(`[API Route] ORCID Search URL: ${url}`);
  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Route] ORCID API Error: ${response.status} - ${errorBody}`);
      // 클라이언트에 전달할 수 있는 더 구체적인 오류 메시지 생성 가능
      throw new Error(`ORCID API 요청 실패 (상태: ${response.status})`); 
    }
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error("[API Route] ORCID API request failed:", error);
    // 여기서 발생한 오류는 최종 catch 블록에서 처리됨
    throw error; // 오류를 다시 던져서 호출 측에서 처리하도록 함
  }
}

async function analyzeWithDeepSeek(userProfile: z.infer<typeof recommendationRequestSchema>, orcidItemsForLLM: any[], userQueryForLLM: string): Promise<LabRecommendation[]> {
  if (!DEEPSEEK_API_KEY) {
    console.warn("[API Route] DEEPSEEK_API_KEY is not set. Returning mock data for analysis.");
    return MOCK_API_RESPONSE;
  }
  
  if (orcidItemsForLLM.length === 0) {
    console.log("[API Route] No ORCID items to analyze for LLM. Returning mock data.");
    return MOCK_API_RESPONSE;
  }

  // LLM에 전달할 문서 형식화: 각 item은 orcidId와 content를 포함해야 함
  const documentsForAnalysis = orcidItemsForLLM.map(item => {
    // item.id는 ORCID ID 여야 함 (searchOrcid 결과에서 추출 또는 생성 시 주의)
    // item.content는 임베딩 및 LLM 분석에 사용될 텍스트
    const orcidId = item.id || `unknown-id-${Math.random().toString(36).substring(7)}`;
    const content = item.content || "내용 없음";
    const similarityInfo = item.similarityScore ? `(계산된 유사도: ${(item.similarityScore * 100).toFixed(0)}%)` : "";
    return `ORCID ID: ${orcidId} ${similarityInfo}
연구 내용 요약: ${content}`;
  }).join("\n---\n");
  
  console.log("[API Route] Documents for DeepSeek analysis (first 500 chars):", documentsForAnalysis.substring(0, 500) + "...");
  
  const prompt = `당신은 연구실 추천 전문가입니다. 다음 사용자 프로필과 제공된 연구자/문서 목록(ORCID 기반, 관련도 순으로 일부 필터링됨)을 참고하여, 사용자에게 가장 적합한 연구실 3-5개를 추천하고, 각 연구실별 가능한 멘토 1-2명을 제시해주세요.

사용자 질의: ${userQueryForLLM}
사용자 프로필: 전공 ${userProfile.major}, 관심 키워드 ${userProfile.keywords}, 학력 ${userProfile.educationLevel}${userProfile.additionalInfo ? `, 추가 정보: ${userProfile.additionalInfo}` : ''}.

제공된 연구자/문서 목록:
---
${documentsForAnalysis}
---

응답 지침:
1. 반드시 아래 명시된 JSON 형식의 배열을 반환해야 합니다.
2. 각 추천 연구실 객체의 'id' 필드에는 해당 연구실의 대표 연구자 ORCID ID (형식: 0000-0001-2345-6789) 또는 가장 관련있는 문서의 ORCID ID를 사용해야 합니다. 만약 적절한 ORCID ID가 없다면, "temp-lab-id-"로 시작하는 임시 ID를 생성하세요.
3. 'mentors' 배열의 각 멘토 객체 'id' 필드에도 가능하다면 ORCID ID를 사용하고, 없다면 "temp-mentor-id-"로 시작하는 임시 ID를 생성하세요.
4. logoUrl과 mentor의 avatarUrl은 "https://picsum.photos/seed/UNIQUE_SEED/SIZE" 형식으로 생성해주세요.
5. matchRate (0-100 사이의 수치로, 사용자와의 적합도), projects, publicationTrends, memberCount 등은 현실적으로 추정하여 채워주세요.
6. careerScenario 필드는 "AI 커리어 시나리오 생성 예정..."으로 설정해주세요.

JSON 응답 형식:
[
  {
    "id": "(ORCID ID 또는 임시 ID)",
    "logoUrl": "https://picsum.photos/seed/lab_seed_example/100/100",
    "name": "(추천 연구소명)",
    "keywords": ["키워드1", "키워드2"],
    "matchRate": 85, 
    "projects": ["프로젝트 예시 1", "프로젝트 예시 2"],
    "publicationTrends": [{ "year": "2022", "count": 10 }, { "year": "2023", "count": 12 }],
    "memberCount": 20,
    "mentors": [
      { "id": "(ORCID ID 또는 임시 ID)", "avatarUrl": "https://picsum.photos/seed/mentor_seed_example/80/80", "name": "(멘토 이름)", "title": "(직책)", "profile": "(연구분야 및 간략소개)" }
    ],
    "careerScenario": "AI 커리어 시나리오 생성 예정..."
  }
  // ... (다른 추천 연구실 객체들)
]`;

  try {
    console.log("[API Route] Sending request to DeepSeek API (Chat Completion)...");
    const response = await fetch(`${DEEPSEEK_BASE_URL}${DEEPSEEK_CHAT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: DEEPSEEK_CHAT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Route] DeepSeek API Error: ${response.status} - ${errorBody}`);
      throw new Error(`DeepSeek API 요청 실패 (상태: ${response.status}). 응답: ${errorBody.substring(0,100)}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
        console.error("[API Route] DeepSeek API did not return content.");
        throw new Error("DeepSeek API로부터 유효한 응답을 받지 못했습니다.");
    }
    
    console.log("[API Route] Raw content from DeepSeek:", content.substring(0, 500) + "...");

    try {
      let parsedLabs = JSON.parse(content);
      // DeepSeek이 배열을 직접 반환하지 않고 객체 내부에 배열을 포함할 경우 처리
      // 예를 들어, { "recommendations": [...] } 형태로 반환한다면:
      if (parsedLabs && typeof parsedLabs === 'object' && !Array.isArray(parsedLabs)) {
          if (parsedLabs.recommendations && Array.isArray(parsedLabs.recommendations)) {
              parsedLabs = parsedLabs.recommendations;
          } else if (parsedLabs.labs && Array.isArray(parsedLabs.labs)) {
              parsedLabs = parsedLabs.labs;
          } else if (Array.isArray(parsedLabs.results)) { // 다양한 가능한 키값 시도
              parsedLabs = parsedLabs.results; 
          } else {
            throw new Error("DeepSeek API 응답이 예상된 배열 형식이 아닙니다. (객체 내 추천 배열 누락)");
          }
      }
      
      if (!Array.isArray(parsedLabs)) {
        console.error("[API Route] DeepSeek response content is not a valid JSON array:", parsedLabs);
        throw new Error("DeepSeek API 응답이 JSON 배열 형식이 아닙니다.");
      }

      return parsedLabs.map((lab: any, index: number) => ({
        id: lab.id || `temp-lab-${Date.now()}-${index}`, // LLM이 ID를 제공하지 않으면 임시 ID
        logoUrl: lab.logoUrl || `https://picsum.photos/seed/ds_lab_${normalizeOrcidId(lab.name) || index}/100/100`,
        name: lab.name || "이름 없는 연구소",
        keywords: Array.isArray(lab.keywords) ? lab.keywords : [],
        matchRate: typeof lab.matchRate === 'number' ? Math.min(100, Math.max(0, lab.matchRate)) : 75,
        projects: Array.isArray(lab.projects) ? lab.projects : ["정보 없음"],
        publicationTrends: Array.isArray(lab.publicationTrends) ? lab.publicationTrends.map((pt:any) => ({year: String(pt.year), count: Number(pt.count) || 0})) : [],
        memberCount: typeof lab.memberCount === 'number' ? lab.memberCount : 0,
        mentors: Array.isArray(lab.mentors) ? lab.mentors.map((mentor: any, mIndex: number) => ({
          id: mentor.id || `temp-mentor-${Date.now()}-${index}-${mIndex}`, // LLM이 ID를 제공하지 않으면 임시 ID
          avatarUrl: mentor.avatarUrl || `https://picsum.photos/seed/ds_mentor_${normalizeOrcidId(mentor.name) || mIndex}/80/80`,
          name: mentor.name || "이름 없는 멘토",
          title: mentor.title || "직책 정보 없음",
          profile: mentor.profile || "프로필 정보 없음",
        })) : [],
        careerScenario: lab.careerScenario || "AI 커리어 시나리오 생성 예정...",
        similarityScore: lab.similarityScore || 0,
      }));
    } catch (e: any) {
      console.error("[API Route] DeepSeek response JSON parsing error:", e.message, "Raw content was:", content);
      throw new Error(`DeepSeek 응답 처리 중 오류 발생: ${e.message}`);
    }
  } catch (error) {
    console.error("[API Route] DeepSeek API request/processing failed:", error);
    throw error;
  }
}

async function generateCareerScenario(labName: string, labKeywords: string[]): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    console.warn("[API Route] DEEPSEEK_API_KEY is not set. Career scenario generation will be skipped.");
    return "[DeepSeek 연동 없음] AI 기반 커리어 시나리오 생성 기능이 현재 비활성화되어 있습니다. (API 키 누락)";
  }

  const prompt = `당신은 IT/과학 분야 커리어 컨설턴트입니다. 다음 연구소에 합류했을 때 예상되는 커리어 비전, 성장 기회, 네트워킹 이점 등을 1~2문장으로 간결하고 매력적으로 요약해주세요. (100자 이내)

연구소 이름: "${labName}"
주요 연구 키워드: ${labKeywords.join(", ")}

요약:`;

  try {
    console.log(`[API Route] Generating career scenario for ${labName} with DeepSeek API...`);
    const response = await fetch(`${DEEPSEEK_BASE_URL}${DEEPSEEK_CHAT_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 또는 사용하고자 하는 DeepSeek 모델
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100, // 커리어 시나리오 길이에 맞게 조절
        temperature: 0.5, // 약간의 창의성을 위해 0.5로 설정, 필요시 조절
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Route] DeepSeek API Error (Career Scenario): ${response.status} - ${errorBody}`);
      throw new Error(`DeepSeek API 요청 실패 (커리어 시나리오, 상태: ${response.status}). 응답: ${errorBody.substring(0,100)}`);
    }

    const result = await response.json();
    const scenario = result.choices?.[0]?.message?.content?.trim();

    if (!scenario) {
      console.warn("[API Route] DeepSeek (Career Scenario) returned empty scenario.");
      return "해당 연구소의 커리어 정보를 AI가 생성하지 못했습니다. 직접 탐색해보세요.";
    }
    return scenario;
  } catch (error: any) {
    console.error("[API Route] DeepSeek API request failed (Career Scenario):", error.message);
    // error.details 등을 포함하여 더 자세한 오류 정보를 반환할 수 있습니다.
    return `[오류] AI 커리어 시나리오 생성 중 문제가 발생했습니다: ${error.message}`;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[API Route] Received request body:", body);
    const parsedRequest = recommendationRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      console.warn("[API Route] Invalid request body:", parsedRequest.error.format());
      return NextResponse.json({ error: "입력값이 유효하지 않습니다.", details: parsedRequest.error.flatten().fieldErrors }, { status: 400 });
    }

    const userData = parsedRequest.data;
    let recommendedLabs: LabRecommendation[] = [];

    try {
        const orcidQuery = `${userData.keywords} ${userData.major}`; // ORCID 검색용 기본 쿼리
        let orcidResults = await searchOrcid(orcidQuery, 30); // 유사도 계산 및 LLM 전달을 위해 충분한 결과 요청 (예: 30개)
        console.log(`[API Route] Found ${orcidResults.length} results from ORCID for initial query.`);

        const userTextForEmbedding = `${userData.major} ${userData.keywords} ${userData.educationLevel} ${userData.additionalInfo || ''}`.trim();
        const userEmbedding = await embedTextWithDeepSeek(userTextForEmbedding);

        let processedOrcidItemsForLLM: any[] = []; // LLM에 최종 전달될 아이템 목록 (ID와 content 포함)

        if (userEmbedding && orcidResults.length > 0) {
          console.log("[API Route] Calculating similarity scores for ORCID results...");
          
          const orcidItemsWithText = orcidResults.map(item => {
            const orcidId = item?.["orcid-identifier"]?.path; // ORCID ID 추출
            const title = item?.["title"]?.[0]?.title?.value || item?.["name"]?.value || "";
            const summary = item?.["summary"]?.[0]?.value || item?.["biography"]?.value || "";
            const workSummaries = item.group?.['work-summary']?.map((ws: any) => {
                const workTitle = ws.title?.title?.value || "";
                const journalTitle = ws['journal-title']?.value || "";
                return `${workTitle} ${journalTitle}`;
            }).join(" ") || "";
            const keywordsText = item?.["keywords"]?.value?.join(' ') || '';
            const contentForEmbedding = `${title} ${summary} ${keywordsText} ${workSummaries}`.trim();
            return { item, orcidId, contentForEmbedding }; // 원본 item, orcidId, 임베딩용 텍스트 포함
          }).filter(data => data.orcidId && data.contentForEmbedding.length > 0);

          const similarityTasks = orcidItemsWithText.map(async (data) => {
            const orcidItemEmbedding = await embedTextWithDeepSeek(data.contentForEmbedding);
            if (orcidItemEmbedding) {
              const similarity = cosineSimilarity(userEmbedding, orcidItemEmbedding);
              return { ...data.item, id: data.orcidId, content: data.contentForEmbedding, similarityScore: similarity }; // 원본 item 정보에 id, content, 유사도 추가
            }
            return { ...data.item, id: data.orcidId, content: data.contentForEmbedding, similarityScore: 0 }; // 임베딩 실패 시 유사도 0
          });

          const resultsWithSimilarity = await Promise.all(similarityTasks);
          
          processedOrcidItemsForLLM = resultsWithSimilarity
            .filter(item => item.similarityScore > 0.1) // 최소 유사도 임계값 (예: 0.1, 조정 가능)
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .slice(0, 10); // LLM에 전달할 상위 10개 결과
          
          console.log(`[API Route] Filtered and sorted ${processedOrcidItemsForLLM.length} ORCID items by similarity for LLM.`);
          if(processedOrcidItemsForLLM.length === 0 && orcidResults.length > 0) {
            console.warn("[API Route] No ORCID items after similarity filtering, using original top 5 ORCID items for LLM if available.");
            // 원본 ORCID 결과에서 텍스트를 다시 만들어 LLM에 전달
            processedOrcidItemsForLLM = orcidResults.slice(0,5).map(item => {
                const orcidId = item?.["orcid-identifier"]?.path;
                const title = item?.["title"]?.[0]?.title?.value || item?.["name"]?.value || "";
                const summary = item?.["summary"]?.[0]?.value || item?.["biography"]?.value || "";
                return { id: orcidId, content: `${title} ${summary}`.trim() }; // 간략한 정보로 LLM 전달
            }).filter(item => item.id && item.content);
          }

        } else {
          console.warn("[API Route] User embedding failed or no initial ORCID results. Using top 5 original ORCID results for LLM if available.");
          processedOrcidItemsForLLM = orcidResults.slice(0, 5).map(item => {
            const orcidId = item?.["orcid-identifier"]?.path;
            const title = item?.["title"]?.[0]?.title?.value || item?.["name"]?.value || "";
            const summary = item?.["summary"]?.[0]?.value || item?.["biography"]?.value || "";
            return { id: orcidId, content: `${title} ${summary}`.trim() };
        }).filter(item => item.id && item.content);
        }
        
        const userQueryForLLM = userTextForEmbedding; 

        // 디버깅: LLM에 전달될 ID 목록 출력
        console.debug("[API Route] ORCID Item IDs being passed to LLM:", processedOrcidItemsForLLM.map(i => i.id));

        recommendedLabs = await analyzeWithDeepSeek(userData, processedOrcidItemsForLLM, userQueryForLLM);
        console.log(`[API Route] Received ${recommendedLabs.length} recommendations from DeepSeek analysis.`);

        // 디버깅: LLM으로부터 받은 ID 목록 출력
        console.debug("[API Route] Lab IDs received from LLM:", recommendedLabs.map(l => l.id));

        recommendedLabs = recommendedLabs.map(lab => {
            const normalizedLabId = normalizeOrcidId(lab.id);
            const matchedOrcidItem = processedOrcidItemsForLLM.find(item => normalizeOrcidId(item.id) === normalizedLabId);
            
            let finalMatchRate = lab.matchRate; // LLM이 제공한 matchRate 기본 사용
            let finalSimilarityScore = matchedOrcidItem?.similarityScore ? parseFloat((matchedOrcidItem.similarityScore * 100).toFixed(2)) : undefined;

            if (matchedOrcidItem?.similarityScore !== undefined) {
                // LLM의 matchRate와 계산된 유사도 점수를 조합하거나 선택할 수 있음
                // 여기서는 LLM의 matchRate를 우선하되, similarityScore도 기록
                if (finalMatchRate === undefined || finalMatchRate < (matchedOrcidItem.similarityScore * 100)) {
                     // LLM이 matchRate를 안줬거나, 계산된 유사도가 더 높으면 그걸로 일부 반영
                    finalMatchRate = parseFloat((matchedOrcidItem.similarityScore * 100).toFixed(0));
                }
            } else if (finalMatchRate === undefined) {
                finalMatchRate = 70; // 기본값, 매칭되는 ORCID 아이템 없을 경우
            }

            console.debug(`[API Route] Matching Lab ID: ${lab.id} (Normalized: ${normalizedLabId}) with ORCID Item. Found: ${!!matchedOrcidItem}, Similarity: ${finalSimilarityScore}, LLM MatchRate: ${lab.matchRate}, Final MatchRate: ${finalMatchRate}`);

            return {
                ...lab,
                id: lab.id || matchedOrcidItem?.id || `temp-final-lab-${Date.now()}`, // ID 최종 결정
                similarityScore: finalSimilarityScore,
                matchRate: finalMatchRate
            };
        });

        if (recommendedLabs.length === 0 && MOCK_API_RESPONSE.length > 0 && !DEEPSEEK_API_KEY) { // API 키 없을때만 목업 확실히
            console.warn("[API Route] No recommendations from DeepSeek (and API key missing), falling back to mock data.");
            recommendedLabs = MOCK_API_RESPONSE;
        } else if (recommendedLabs.length === 0 && orcidResults.length > 0) { // API는 있었지만 결과가 없을 때
             console.warn("[API Route] No recommendations from DeepSeek (but API key exists), attempting to return mock if available or empty.");
             // 여기서 목업 데이터를 강제로 반환할지, 아니면 빈 배열을 그대로 둘지 정책 결정 필요
             // MOCK_API_RESPONSE는 API 키가 없을 때의 최후 수단으로 남겨두는 것이 좋을 수 있음
        }

        if (recommendedLabs.length > 0) {
            for (let lab of recommendedLabs) {
                if (!lab.careerScenario || lab.careerScenario.includes("생성 예정")) {
                    lab.careerScenario = await generateCareerScenario(lab.name, lab.keywords);
                }
            }
            console.log("[API Route] Career scenarios generated with DeepSeek API.");
        }
        
        console.log("[API Route] Final recommendations being sent:", recommendedLabs.slice(0,1)); // 첫번째 결과만 로그 (데이터량 조절)
        return NextResponse.json(recommendedLabs);

    } catch (apiError: any) {
        // searchOrcid, analyzeWithDeepSeek, generateCareerScenario 내부에서 발생한 특정 API 오류들
        console.error("[API Route] Error during API processing pipeline:", apiError.message);
        // 이미 해당 함수들에서 console.error로 상세 내용이 찍혔을 것이므로, 여기서는 클라이언트에게 보낼 메시지에 집중
        return NextResponse.json({ 
            error: "추천 정보를 가져오는 중 문제가 발생했습니다.", 
            details: `세부 오류: ${apiError.message}`,
            // 필요하다면, 부분적으로 성공한 데이터나 목업 데이터를 반환할 수도 있음
            // data: MOCK_API_RESPONSE // 최후의 수단으로 목업 데이터 제공
        }, { status: 500 });
    }

  } catch (error: any) {
    // 요청 body 파싱 오류 등 POST 핸들러의 최상위 try-catch
    console.error("[API Route] Top-level POST handler error:", error.message);
    return NextResponse.json({ error: "서버 처리 중 예기치 않은 오류가 발생했습니다.", details: error.message }, { status: 500 });
  }
} 