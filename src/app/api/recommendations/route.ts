import { NextResponse } from "next/server";
import { z } from "zod";

// --- 환경 변수 로드 ( 실제 배포 환경에서는 빌드 시점에 주입됨 ) ---
// 로컬 개발 시 .env.local 파일에 아래와 같이 키를 설정해야 합니다.
// ORCID_API_BASE_URL=https://pub.orcid.org/v3.0
// DEEPSEEK_API_KEY=your_deepseek_api_key
// OPENAI_API_KEY=your_openai_api_key

const ORCID_API_BASE_URL = process.env.ORCID_API_BASE_URL || "https://pub.orcid.org/v3.0";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // OpenAI API 키 변수 제거

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
  matchRate: number;
  projects: string[];
  publicationTrends: { year: string | number; count: number }[];
  memberCount: number;
  mentors: MentorRecommendation[];
  careerScenario: string;
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

// --- API 호출 및 데이터 처리 함수 ---

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

async function analyzeWithDeepSeek(userProfile: z.infer<typeof recommendationRequestSchema>, orcidResults: any[]): Promise<LabRecommendation[]> {
  if (!DEEPSEEK_API_KEY) {
    console.warn("[API Route] DEEPSEEK_API_KEY is not set. Returning mock data.");
    return MOCK_API_RESPONSE;
  }
  if (orcidResults.length === 0) {
    console.log("[API Route] No ORCID results to analyze. Returning mock data.");
    return MOCK_API_RESPONSE;
  }

  const documentsForAnalysis = orcidResults.map(item => {
    const title = item?.["title"]?.[0]?.title?.value || item?.["name"]?.value || "제목/이름 없음";
    const summary = item?.["summary"]?.[0]?.value || item?.["biography"]?.value || "요약 정보 없음";
    const orcidId = item?.["orcid-identifier"]?.path || item?.["put-code"] || `unknown-id-${Math.random().toString(36).substring(7)}`;
    const keywords = item?.["keywords"]?.value?.join(', ') || "키워드 없음";
    return `ID: ${orcidId}\nTitle/Name: ${title}\nSummary/Bio: ${summary}\nKeywords: ${keywords}`;
  }).join("\n---\n");
  
  console.log("[API Route] Documents for DeepSeek analysis:", documentsForAnalysis.substring(0, 500) + "...");

  const prompt = `... (이전 프롬프트와 유사하게 유지, 필요시 JSON 구조 명확화) ...
    당신은 연구실 추천 전문가입니다. 주어진 사용자 프로필과 ORCID 검색 결과를 바탕으로, 가장 적합한 연구실 3~5개를 추천하고, 각 연구실별 멘토 1~2명을 제시해주세요.
    반드시 다음 JSON 형식의 배열을 반환해야 합니다. 각 객체는 LabRecommendation 타입을 따라야 합니다.
    logoUrl과 mentor의 avatarUrl은 "https://picsum.photos/seed/UNIQUE_SEED/SIZE" 형식으로 생성해주세요.
    matchRate (0-100), projects, publicationTrends, memberCount 등은 현실적으로 추정하여 채워주세요.
    careerScenario 필드는 이 단계에서는 "AI 커리어 시나리오 생성 예정..."으로 설정해주세요.

    JSON 응답 형식:
    [
      {
        "id": "(orcid-id 또는 생성된 고유 ID)",
        "logoUrl": "https://picsum.photos/seed/lab_seed_example/100/100",
        "name": "(추천 연구소명)",
        "keywords": ["키워드1", "키워드2"],
        "matchRate": 85,
        "projects": ["프로젝트 예시 1", "프로젝트 예시 2"],
        "publicationTrends": [{ "year": "2022", "count": 10 }, { "year": "2023", "count": 12 }],
        "memberCount": 20,
        "mentors": [
          { "id": "(mentor-orcid-id 또는 생성된 고유 ID)", "avatarUrl": "https://picsum.photos/seed/mentor_seed_example/80/80", "name": "(멘토 이름)", "title": "(직책)", "profile": "(연구분야 및 간략소개)" }
        ],
        "careerScenario": "AI 커리어 시나리오 생성 예정..."
      }
      // ... 추가 추천 연구소들
    ]
  `;
  // 실제 프롬프트는 이전 단계에서 생성된 상세 프롬프트를 사용해야 함
  // 여기서는 간략화된 설명을 추가

  try {
    console.log("[API Route] Sending request to DeepSeek API...");
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }], // 실제로는 더 자세한 프롬프트가 필요
        temperature: 0.3, // 좀 더 일관된 결과를 위해 온도 낮춤
        max_tokens: 2500, // 충분한 토큰
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
          } else {
            // 예상치 못한 구조일 경우, content 전체를 배열로 감싸서 시도해볼 수 있음 (단, LLM이 단일 객체를 반환한 경우)
            // console.warn("[API Route] DeepSeek response is a single object, attempting to wrap in array.");
            // parsedLabs = [parsedLabs]; // 이 방법은 주의해서 사용
            throw new Error("DeepSeek API 응답이 예상된 배열 형식이 아닙니다. (객체 내 배열 누락)");
          }
      }
      
      if (!Array.isArray(parsedLabs)) {
        console.error("[API Route] DeepSeek response content is not a valid JSON array:", parsedLabs);
        throw new Error("DeepSeek API 응답이 JSON 배열 형식이 아닙니다.");
      }

      return parsedLabs.map((lab: any, index: number) => ({
        id: lab.id || `ds-lab-${Date.now()}-${index}`,
        logoUrl: lab.logoUrl || `https://picsum.photos/seed/ds_lab_${lab.name || index}/100/100`,
        name: lab.name || "이름 없는 연구소",
        keywords: Array.isArray(lab.keywords) ? lab.keywords : [],
        matchRate: typeof lab.matchRate === 'number' ? Math.min(100, Math.max(0, lab.matchRate)) : 75,
        projects: Array.isArray(lab.projects) ? lab.projects : ["정보 없음"],
        publicationTrends: Array.isArray(lab.publicationTrends) ? lab.publicationTrends.map((pt:any) => ({year: String(pt.year), count: Number(pt.count) || 0})) : [],
        memberCount: typeof lab.memberCount === 'number' ? lab.memberCount : 0,
        mentors: Array.isArray(lab.mentors) ? lab.mentors.map((mentor: any, mIndex: number) => ({
          id: mentor.id || `ds-mentor-${Date.now()}-${index}-${mIndex}`,
          avatarUrl: mentor.avatarUrl || `https://picsum.photos/seed/ds_mentor_${mentor.name || mIndex}/80/80`,
          name: mentor.name || "이름 없는 멘토",
          title: mentor.title || "직책 정보 없음",
          profile: mentor.profile || "프로필 정보 없음",
        })) : [],
        careerScenario: lab.careerScenario || "AI 커리어 시나리오 생성 예정...",
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
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
        const orcidQuery = `${userData.keywords} ${userData.major}`;
        const orcidResults = await searchOrcid(orcidQuery, 10);
        console.log(`[API Route] Found ${orcidResults.length} results from ORCID.`);

        recommendedLabs = await analyzeWithDeepSeek(userData, orcidResults);
        console.log(`[API Route] Received ${recommendedLabs.length} recommendations from DeepSeek analysis.`);

        if (recommendedLabs.length === 0) {
            console.warn("[API Route] No recommendations from DeepSeek, falling back to mock data.");
            recommendedLabs = MOCK_API_RESPONSE; // 목업 데이터로 대체
            // 사용자에게 알릴 수 있는 메시지 추가 가능성
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