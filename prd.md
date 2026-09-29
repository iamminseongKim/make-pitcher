# [PRD] 모바일 웹 기반 투수 육성 게임: 'ACE PROJECT' (가칭)

본 문서는 AI 코딩 에이전트(Cursor, Claude Code, Windsurf 등)가 단독으로 프로젝트 구조를 설계하고 단계별 구현을 진행할 수 있도록 작성된 게임 기획 및 테크니컬 스펙 명세서입니다.

---

## 1. 프로젝트 개요

*   **프로젝트명**: 투수 키우기 (Pitcher Growth Web Game)
*   **플랫폼**: 모바일 웹 브라우저 (Mobile-First Responsive, 세로 화면 터치 조작 최적화)
*   **장르**: 스포츠 아케이드 + 투구 시뮬레이션 / 육성
*   **핵심 가치 (Core Experience)**:
    *   능력치 1포인트를 투자할 때마다 **눈으로 보고(Visual), 귀로 듣고(Audio), 손으로 느끼는(Haptic)** 압도적인 투구 체감.
    *   MLB 현역/역사적 최고 수준(극한의 영역)까지 도달하는 육성의 재미.
*   **코어 루프 (Core Loop)**:
    1.  **타석 대결**: 구종/로케이션 선택 $\rightarrow$ 릴리스 타이밍 입력 $\rightarrow$ 체감형 궤적 투구 $\rightarrow$ 타자 판정.
    2.  **보상 획득**: 삼진, 범타 처리, 이닝 종료 결과에 따라 TP(Training Point) 및 구종 마스터리 경험치 획득.
    3.  **육성 및 확장**: 구종별 3대 능력치(구속, 제구, 브레이킹) 강화 및 신규 구종 해금 $\rightarrow$ 상위 리그 타자 도전.

---

## 2. MLB 기준 8대 구종 물리 모델 & 궤적 정의

모든 구종은 홈플레이트 도달 직전 마지막 구간에서 궤적이 급격하게 꺾이는 **Late Break 베지어 물리 모델**을 따릅니다.

*   기준 좌표계: 투수판($Z = 18.44\text{m}$) $\rightarrow$ 홈플레이트($Z = 0\text{m}$).
*   $X$축: 좌(-) / 우(+) (우투수 기준: -는 우타자 몸쪽, +는 우타자 바깥쪽).
*   $Y$축: 상(-) / 하(+).

| 구종 (Pitch Type) | 분류 | 회전 특성 및 체감 궤적 | 대표 MLB 레퍼런스 |
| :--- | :--- | :--- | :--- |
| **포심 패스트볼 (Four-Seam)** | 패스트볼 | 백스핀으로 중력 낙하를 억제하여 떠오르는 듯한 라이징 착시 | 아롤디스 채프먼, 저스틴 벌랜더 |
| **싱커 (Sinker/Two-Seam)** | 패스트볼 | 빠른 구속을 유지하며 우타자 몸쪽으로 파고들며 묵직하게 침하 | 브루스더 그라테롤, 잭 브리튼 |
| **커터 (Cutter)** | 패스트볼 | 직구처럼 오다가 홈플레이트 3m 앞에서 우타자 바깥쪽으로 날카롭게 꺾임 | 에마누엘 클라세, 마리아노 리베라 |
| **스플리터 (Splitter)** | 오프스피드 | 직구 궤적으로 유지되다 홈플레이트 바로 앞에서 바닥으로 뚝 떨어짐 | 오타니 쇼헤이, 케빈 가우스먼 |
| **체인지업 (Circle Change)** | 오프스피드 | 완만한 역회전(Arm-side fade)과 낙차, 직구와의 구속 차이로 타이밍 강탈 | 데빈 윌리엄스 (Airbender), 페드로 마르티네스 |
| **슬라이더 (Slider)** | 브레이킹 | 홈플레이트 진입 직전 대각선 아래 바깥쪽으로 예리하게 휘어짐 | 제이콥 디그롬, 맥스 슈어저 |
| **커브 (Curveball)** | 브레이킹 | 릴리스 직후 살짝 솟아올랐다가 수직으로 폭포수처럼 낙하 (큰 포물선) | 클레이튼 커쇼, 타일러 글래스노우 |
| **스위퍼 (Sweeper)** | 브레이킹 | 종낙하를 억제하고 홈플레이트 전체를 가로지르듯 극단적인 수평 횡이동 | 소니 그레이, 다르빗슈 유 |

---

## 3. 능력치 체계 및 최소 / 극한 수치 밸런스

능력치 범위는 최하위 신인 수준인 **MIN(Level 1)**부터, 현대 야구 물리법칙 한계선에 도전하는 **LIMIT(Level 99 / Ultimate)**까지 정의합니다.

### 3.1 구속 (Velocity) 밸런스 테이블

*   비행 시간 공식: $t = \frac{18.44\text{m}}{V \times (1000 / 3600)}$
*   60fps 기준 캔버스 렌더링 프레임: $\text{Frames} = \text{round}(t \times 60)$

| 구종 | 최소 구속 (Min / Lv.1) | 극한의 구속 (Limit / Lv.99) | 비행 프레임 (Min $\rightarrow$ Limit) |
| :--- | :--- | :--- | :--- |
| **포심 (Four-Seam)** | $130\text{ km/h}$ | **$170\text{ km/h}$ ($105.6\text{ mph}$)** | $31\text{f} \rightarrow \mathbf{23\text{f}}$ |
| **싱커 (Sinker)** | $128\text{ km/h}$ | **$166\text{ km/h}$ ($103.1\text{ mph}$)** | $31\text{f} \rightarrow \mathbf{24\text{f}}$ |
| **커터 (Cutter)** | $124\text{ km/h}$ | **$163\text{ km/h}$ ($101.3\text{ mph}$)** | $32\text{f} \rightarrow \mathbf{24\text{f}}$ |
| **스플리터 (Splitter)** | $118\text{ km/h}$ | **$154\text{ km/h}$ ($95.7\text{ mph}$)** | $34\text{f} \rightarrow \mathbf{26\text{f}}$ |
| **체인지업 (Changeup)** | $112\text{ km/h}$ | **$145\text{ km/h}$ ($90.1\text{ mph}$)** | $36\text{f} \rightarrow \mathbf{27\text{f}}$ |
| **슬라이더 (Slider)** | $115\text{ km/h}$ | **$152\text{ km/h}$ ($94.5\text{ mph}$)** | $35\text{f} \rightarrow \mathbf{26\text{f}}$ |
| **커브 (Curveball)** | $100\text{ km/h}$ | **$138\text{ km/h}$ ($85.7\text{ mph}$)** | $40\text{f} \rightarrow \mathbf{29\text{f}}$ |
| **스위퍼 (Sweeper)** | $110\text{ km/h}$ | **$144\text{ km/h}$ ($89.5\text{ mph}$)** | $36\text{f} \rightarrow \mathbf{28\text{f}}$ |

### 3.2 제구 (Control) 밸런스 테이블

*   **스윗스팟 너비 (Sweet Spot)**: 릴리스 타이밍 바 전체 너비 중 PERFECT 판정 비율.
*   **실투 오차 반경 (Max Dispersion)**: 판정 실패(Early/Late) 시 목표 탄착군 대비 공이 빗나가는 최대 픽셀 반경.

| 등급 / 레벨 | 스윗스팟 너비 비율 | 실투 오차 반경 | 타이밍 바 왕복 속도 | 체감 |
| :--- | :--- | :--- | :--- | :--- |
| **MIN (Lv.1)** | $4\%$ (극도로 좁음) | $90\text{px}$ (폭투/한가운데 몰림) | $1.2\text{초/왕복}$ | 손이 떨릴 정도로 타이밍 맞추기 어려움 |
| **MID (Lv.50)** | $12\%$ | $45\text{px}$ | $1.0\text{초/왕복}$ | 스트라이크 존 보더라인 공략 가능 |
| **LIMIT (Lv.99)** | **$28\%$ (넓은 스윗스팟)** | **$4\text{px}$ (핀포인트)** | $0.8\text{초/왕복}$ (안정적) | 원하는 코너에 바늘구멍 제구 완벽 재현 |

### 3.3 브레이킹 (Movement / Stuff) 밸런스 테이블

*   **변화량 (Break Distance)**: 홈플레이트 통과 시 기준 궤적 대비 최대 꺾임 거리.
*   **Late Break 개시 시점**: 비행 거리 대비 궤적 급변 시작 구간.

| 구종 | MIN (Lv.1) 수치 | LIMIT (Lv.99) 수치 | 특수 무브먼트 연출 |
| :--- | :--- | :--- | :--- |
| **스위퍼** | 횡 이동 $12\text{cm}$ | **횡 이동 $58\text{cm}$ (존 전체 횡단)** | 공이 플레이트 좌측 밖에서 우측 밖으로 휘어 들어옴 |
| **커브** | 낙차 $15\text{cm}$ | **낙차 $65\text{cm}$ (시야 이탈 낙하)** | 타자 머리 높이에서 발목까지 수직 드롭 |
| **스플리터** | 낙차 $10\text{cm}$ | **낙차 $52\text{cm}$ (싱크홀 급락)** | 포수 미트 직전 1미터에서 증발하듯 꺼짐 |
| **커터** | 횡 이동 $6\text{cm}$ | **횡 이동 $32\text{cm}$ (톱날 커트)** | 직구 스피드로 오다가 마지막 순간 배트 넥을 쪼갬 |
| **포심** | 수직 무브먼트 $10\text{cm}$ | **수직 무브먼트 $45\text{cm}$ (라이징)** | 중력을 거스르고 솟구쳐 오르는 백스핀 시각 효과 |

---

## 4. 스탯 성장 체감 엔진 (Sensory Feedback System)

능력치 강화가 단순 수치 변경에 그치지 않고, 플레이어가 투구할 때마다 확연한 손맛을 느끼도록 하는 핵심 연출 명세입니다.

```
[구속 강화 시]   ──> 비행 프레임 감소 + 속도 잔상(Trail) 두께 증가 + 파열음 사운드
[제구 강화 시]   ──> 게이지 스윗스팟 확장 + 조준원 떨림 제거 + 포수 미트 정밀 안착
[브레이킹 강화 시] ──> 급격한 꺾임 곡선(Cliff Point) + 궤적 회전 이펙트 + 타자 헛스윙 리액션
```

### 4.1 시각적 체감 (Visual FX)

1.  **스피드 트레일 (Speed Ribbon Trail)**:
    *   $130\text{ km/h}$ 미만: 잔상 없음. 일반 공 오브젝트 비행.
    *   $140\text{ km/h} \sim 150\text{ km/h}$: 반투명 화이트 스피드 라인 2줄 생성.
    *   $160\text{ km/h}$ 이상 (극한 영역): 공 뒤편으로 푸른색 소닉 붐 충격파 링 및 화염 잔상 발생.
2.  **구종별 회전 파티클**:
    *   스위퍼/슬라이더: 회전축 방향으로 휘감기는 나선형 바람 파티클.
    *   스플리터: 급락하는 순간 공 뒤에 하향 충격 벡터 화살표 잔상.
3.  **포구 임팩트 셰이크 (Camera Shake)**:
    *   구속 및 브레이킹 수치에 비례하여 포구 순간 화면 셰이크 강도 결정:
        $$\text{ShakeIntensity} = \left(\frac{V - 120}{40}\right) \times 4\text{px}$$
    *   $160\text{ km/h}$ 이상 포심 투구 시: 화면 전체 $0.08\text{초}$ $4\text{px}$ 셰이크 + 2프레임 히트스탑(정지).

### 4.2 청각 & 촉각 체감 (Audio & Haptics)

1.  **비행 풍절음 (Whistle Sound)**:
    *   구속에 따라 Web Audio API 오실레이터 주파수 변조:
        *   $130\text{ km/h}$: 부드러운 '슈우욱-'
        *   $160\text{ km/h}$: 찢어지는 듯한 고주파 '치이이익-!'
2.  **포구 타격음 (Leather Pop)**:
    *   제구 판정(PERFECT) + 강속구: 미트 한가운데 꽂히는 묵직하고 단단한 '딱-!' 파열음.
    *   LATE/EARLY 판정: 미트 끄트머리에 걸리는 둔탁하고 덜그럭거리는 '퍽'.
3.  **모바일 햅틱 (Web Vibration API)**:
    *   PERFECT 제구: `navigator.vibrate([15, 30, 20])` (단단하고 묵직한 진동).
    *   160km/h 돌파 투구: `navigator.vibrate(60)` (손끝을 때리는 강한 진동).

### 4.3 타자 반응 체감 (Batter Feedback)

*   **구속 압도**: 강속구에 타자가 전혀 타이밍을 맞추지 못하고 스윙이 공보다 한참 뒤처지며 헬멧이 흔들림.
*   **브레이킹 압도 (스위퍼/커브)**: 배트가 헛돈 뒤 타자가 균형을 잃고 한 바퀴 도는 헛스윙 삼진 리액션 연출.
*   **볼끝 제구**: 스트라이크 존 경계면에 걸칠 때 타자가 배트를 멈추고 멍하니 바라보는 루킹 삼진(Called Strike 3) 특수 연출.

---

## 5. 데이터 인터페이스 정의 (TypeScript)

AI 에이전트가 즉각 구현할 수 있도록 8대 구종과 스탯 구조를 타입으로 명시합니다.

```typescript
// 8대 구종 타입 식별자
export type PitchType =
  | 'FOUR_SEAM'
  | 'SINKER'
  | 'CUTTER'
  | 'SPLITTER'
  | 'CHANGEUP'
  | 'SLIDER'
  | 'CURVE'
  | 'SWEEPER';

// 구종별 물리 궤적 파라미터
export interface PitchTrajectoryProfile {
  baseSpeedKmH: number;
  maxSpeedKmH: number;
  horizontalMovementCm: number; // 좌/우 최대 변화폭 (-60 ~ +60)
  verticalMovementCm: number;   // 상/하 최대 낙차 (-60 ~ +60)
  lateBreakStartRatio: number;  // 궤적 급변 시작점 (예: 0.70 = 70% 비행 후 꺾임)
  trailColor: string;
}

// 구종별 성장 스탯 (1 ~ 99)
export interface PitchStat {
  unlocked: boolean;
  level: number;
  velocityLevel: number; // 1 ~ 99 -> 실제 km/h로 매핑
  controlLevel: number;  // 1 ~ 99 -> 스윗스팟 너비 및 탄착 오차 반경 매핑
  breakLevel: number;    // 1 ~ 99 -> 무브먼트 배율 및 Late Break 가속도 매핑
}

// 투수 전체 상태
export interface PitcherProfile {
  name: string;
  trainingPoints: number; // 스탯 강화용 재화 (TP)
  stamina: number;
  maxStamina: number;
  arsenal: Record<PitchType, PitchStat>;
}

// 단일 투구 실행 상태
export interface ActivePitchState {
  pitchType: PitchType;
  target: { x: number; y: number }; // 정규화 좌표 (-1.0 ~ 1.0)
  releaseGrade: 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE';
  finalVelocityKmH: number;
  flightFrames: number;
  currentFrame: number;
  path: Array<{ x: number; y: number; z: number }>;
}
```

---

## 6. 화면 구성 및 UI/UX 와이어프레임

모바일 세로 화면(390px x 844px 기준) 단일 뷰포트 레이아웃.

```
+------------------------------------------+
| [LV.12 에이스]   스태미나 [======  ] TP: 1,450 |
| 볼카운트: 1B - 2S          아웃: ● ● ○     |
+------------------------------------------+
|                                          |
|            [ 타자 2D 실루엣/스프라이트 ]    |
|                                          |
|            +-------------------+         |
|            |   3x3 STRIKE ZONE |         |
|            |   (조준 타겟 표시) |         |
|            +-------------------+         |
|                                          |
|           ● (Late Break 회전 비행)       |
|          /                               |
|       ==/  (스피드 붐 & 컬러 트레일)      |
+------------------------------------------+
| [ 릴리스 타이밍 바: [   |  ■  |   ] ]     |
| [ PITCH! (릴리스 타이밍 탭 버튼)    ]     |
+------------------------------------------+
| 구종 선택 (가로 스크롤 캐러셀):            |
| [포심 158k] [스위퍼 134k] [스플리터] [커브] |
+------------------------------------------+
| [ 투수 훈련실 (스탯 강화 모달 열기) ]      |
+------------------------------------------+
```

---

## 7. AI 에이전트 단계별 구현 로드맵 (Milestones)

### Phase 1: 8대 구종 물리 엔진 & 캔버스 3D 원근 렌더러
*   모바일 캔버스(390px x 844px)에 3x3 스트라이크 존 렌더링.
*   Z축($18.44\text{m} \rightarrow 0\text{m}$) 깊이감 기반 2.5D 투영 공식 적용.
*   8대 구종 각각의 Late Break 베지어 궤적(수평/수직 변화) 및 구속에 따른 프레임 매핑 구현.

### Phase 2: 감각 체감(Juice) 시스템 및 타이밍 조작
*   구속별 스피드 트레일(Ribbon Trail) 및 소닉 붐 링 파티클 렌더링.
*   PERFECT / GOOD / EARLY / LATE 릴리스 타이밍 바 구현.
*   포구 순간 화면 셰이크(Canvas Camera Shake), Web Audio 타격음, Web Vibration 진동 연동.

### Phase 3: 타자 AI 반응 & 삼진 판정
*   구속 프레임과 브레이킹 꺾임 수치에 기반한 타자의 헛스윙/파울/안타 판정 머신.
*   타자의 스윙 모션 애니메이션 및 삼진 리액션 연출.
*   B-S-O 전광판 및 아웃카운트 경기 진행 루프 완성.

### Phase 4: 육성 강화소 & 세이브 시스템
*   아웃/삼진 처리 시 TP(훈련 포인트) 지급.
*   스탯 강화 팝업 UI: 8대 구종의 구속(+km/h), 제구(스윗스팟 확장), 브레이킹(변화폭 증대) 업그레이드.
*   `localStorage`를 이용한 스탯 영속화 저장.

---

## 8. 에이전트 전달용 초기 실행 프롬프트

다른 AI 코딩 에이전트에게 전달할 첫 번째 지시문입니다:

```markdown
당신은 모바일 웹 게임 전문 프론트엔드 엔지니어입니다.
위 PRD 명세서에 기재된 '모바일 웹 투수 키우기 게임: ACE PROJECT'를 Vite + React(TypeScript)와 HTML5 Canvas 2D 컨텍스트를 사용하여 단계적으로 구현해야 합니다.

가장 먼저 [Phase 1: 8대 구종 물리 엔진 & 캔버스 3D 원근 렌더러]를 완성해 주세요.
1. 모바일 비율(최대 430px 너비 고정) 캔버스 레이아웃 생성
2. Z축 거리(18.44m -> 0m) 투영 공식을 적용해 공이 작게 시작해 홈플레이트 앞에서 폭발적으로 커지며 들어오는 원근 투구 애니메이션 구현
3. PRD 3절에 정의된 8대 구종(포심, 싱커, 커터, 스플리터, 체인지업, 슬라이더, 커브, 스위퍼)의 구속별 비행 프레임과 Late Break 궤적이 시각적으로 뚜렷하게 구별되도록 렌더링해 주세요.
```