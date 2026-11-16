# 🏫 온라인 목포과학대학교

브라우저에서 링크만 열면 바로 걸어 다닐 수 있는 웹 3D 캠퍼스입니다.
정문 → 꽃 계단·오르막 → 인조잔디 운동장 → 석축 위 본관, 그리고 파크골프장까지 돌아다닐 수 있고,
여러 명이 동시에 접속하면 서로의 아바타가 실시간으로 보입니다.

- 기술: Vite + React + TypeScript + React Three Fiber(three.js) + drei + Rapier 물리 + zustand
- 실시간: Supabase Realtime (Broadcast + Presence, **DB는 사용하지 않음**)
- 배포: Vercel (정적 사이트, 별도 서버 없음)
- 모든 건물·나무·아바타는 코드로 만든 도형 + 캔버스 텍스처입니다. (외부 3D 모델 파일 없음)

---

## 1. 내 컴퓨터에서 실행하기

1. [Node.js](https://nodejs.org) LTS 버전을 설치합니다.
2. 이 폴더에서 터미널을 열고 아래 명령을 차례로 실행합니다.

```bash
npm install
```

```bash
npm run dev
```

3. 터미널에 나온 주소(보통 `http://localhost:5173`)를 브라우저로 엽니다.

> Supabase 설정을 하지 않아도 **혼자 둘러보기 모드(⚪)** 로 정상 동작합니다.
> 같은 와이파이의 휴대폰에서 보려면 터미널에 나온 `Network:` 주소로 접속하세요.

---

## 2. Supabase 준비하기 (여러 명 동시 접속용, 무료)

1. <https://supabase.com> 에 가입하고 **New project** 를 누릅니다.
   - 프로젝트 이름: 아무거나 (예: `mokpo-campus`)
   - 데이터베이스 비밀번호: 아무거나 (이 프로젝트에서는 쓰지 않음)
   - 지역(Region): `Northeast Asia (Seoul)` 추천
2. 프로젝트가 만들어지면 왼쪽 아래 **⚙️ Project Settings → API** (또는 **Data API / API Keys**) 메뉴로 갑니다.
3. 아래 두 값을 복사해 둡니다.
   - **Project URL** → 예: `https://abcdefghijk.supabase.co`
   - **anon public** 키 (또는 **Publishable key**) → `eyJ...` 로 시작하는 긴 문자열
4. ⚠️ **`service_role` (secret) 키는 절대 복사하거나 어디에도 넣지 마세요.** 관리자 키입니다.
5. 왼쪽 메뉴 **Realtime → Settings** 에서 **"Allow public access" 가 켜져 있는지**(= "Private channels only"가 꺼져 있는지) 확인합니다.
   이 앱은 로그인 없이 공개 채널(Broadcast/Presence)을 사용합니다.

### 내 컴퓨터에서 멀티플레이 테스트
프로젝트 폴더에 `.env.example` 을 복사해서 `.env` 파일을 만들고 값을 채웁니다.

```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

`npm run dev` 를 다시 실행하고 브라우저 창 두 개로 접속하면 왼쪽 위에 **🟢 2명 접속 중** 이 보입니다.

---

## 3. Vercel 에 배포하기

1. 이 폴더를 GitHub 저장소에 올립니다. (`.env` 파일은 올라가지 않도록 `.gitignore` 에 이미 들어 있습니다.)
2. <https://vercel.com> 에 GitHub 계정으로 로그인 → **Add New… → Project** → 방금 만든 저장소를 **Import** 합니다.
3. Framework Preset 은 자동으로 **Vite** 로 잡힙니다. (Build Command `npm run build`, Output Directory `dist`)
4. **Environment Variables** 항목을 펼쳐 두 개를 추가합니다.

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public 키 |

5. **Deploy** 를 누르면 1~2분 뒤 `https://프로젝트이름.vercel.app` 주소가 생깁니다. 이 링크를 공유하면 끝!

> 환경변수는 **빌드할 때** 코드에 들어갑니다. 나중에 값을 바꾸면 Vercel의 **Deployments → … → Redeploy** 를 꼭 눌러 주세요.

### 방 나누기
주소 뒤에 `?room=코드` 를 붙이면 별도의 방이 됩니다. 예: `https://….vercel.app/?room=class1`
(영문·숫자·`-`·`_` 만 사용, 방마다 최대 30명. 30명을 넘으면 그 다음 사람은 **관전 모드**로 들어옵니다.)

---

## 4. 조작법

| PC | 동작 |
|---|---|
| W A S D / 방향키 | 이동 |
| Shift | 달리기 |
| Space | 점프 |
| 마우스 드래그 / 휠 | 카메라 회전 / 줌 |
| 1 · 2 · 3 | 이모트 (👋 손 흔들기 · 🎉 점프 · 💃 춤) |
| E | 파크골프장 입구에서 미니게임 시작 |
| Esc | 창 닫기 / 파크골프 나가기 |

모바일: 왼쪽 아래 조이스틱으로 이동, 화면 드래그로 시점 회전, 두 손가락으로 줌, 오른쪽 아래 점프·이모트 버튼.

우측 상단: 🎄 크리스마스 버전(내 화면에만 적용) · 🔊 소리 켜기/끄기 · ⚙️ 설정(화질 고/중/저, 배경음악·효과음 볼륨) · 👕 아바타 다시 꾸미기 · ❓ 도움말

### 소리
배경음악과 효과음은 오디오 파일 없이 **브라우저에서 코드로 합성**합니다. (추가 다운로드 0KB, 저작권 걱정 없음)
- 평소: 경쾌한 오리지널 칩튠 루프 / 크리스마스 모드: 징글벨(1857년 곡, 퍼블릭 도메인) 편곡
- 효과음: 입장, 발소리, 점프·착지, 이모트, 순간이동, 크리스마스 전환 방울 소리, 파크골프 타격·튕김·홀인·완주 팡파르, 버튼 클릭, 새 접속자 알림
- 브라우저 정책상 **'입장하기'를 누른 뒤부터** 소리가 납니다. 설정은 브라우저에 저장됩니다.
좌측 상단: 접속 상태(🟢 접속자 수 / 🟡 재연결 중 / ⚪ 혼자 모드)와 접속자 목록, 미니맵과 순간이동 버튼(정문/본관/운동장/파크골프장)

### 파크골프
입구 표지판 앞에서 E(또는 화면 버튼) → 공 근처를 **드래그해서 뒤로 당겼다 놓으면** 반대 방향으로 날아갑니다.
3홀을 마치면 총 타수가 접속자 모두의 **오늘의 리더보드**(상위 5명)에 공유됩니다. (메모리에만 저장 → 모두 나가면 초기화)

---

## 5. 실시간 동기화 설계 (무료 플랜 한도 준수)

- 채널 1개: `campus-room:<방코드>`
- **Presence**: 입장·퇴장, 닉네임, 아바타 외형(7자리 코드). 외형/닉네임이 바뀔 때만 갱신
- **Broadcast**
  - `p` 위치: `{i, p:[x,y,z], r, s}` 소수점 둘째 자리 반올림. **움직일 때만 초당 최대 5회**, 멈추면 마지막 위치 1번만.
    접속자가 많아지면 자동으로 초당 3.3회(11~20명), 2.5회(21명~)로 낮춰 초당 메시지 100개 한도를 지킵니다.
  - `e` 이모트, `g` 골프 결과, `hi` 새 접속자에게 현재 위치 1회 알림, `lbq`/`lb` 리더보드 동기화
- 받는 쪽은 보간(lerp)으로 부드럽게 움직이고, 1.5초 이상 업데이트가 없으면 제자리에 서 있습니다.
- 탭이 백그라운드로 가면 전송을 멈추고, 돌아오면 다시 동기화합니다. 연결이 끊기면 자동으로 재연결합니다.

---

## 6. 성능 최적화 요약

- 창문·나무·관목·전구·눈 등 반복 물체는 **InstancedMesh** / 지오메트리 병합 → 평상시 드로우콜 약 60~70개
- 아바타 1명 = SkinnedMesh 1개(드로우콜 1). 원격 아바타는 거리에 따라 저폴리 LOD, 28m 밖은 이름표 숨김
- 그림자는 해 1개만, 플레이어 주변 ±34m만 (고화질 2048 / 중 1024 / 저 끔)
- `dpr` 최대 1.5, drei `PerformanceMonitor` 로 프레임이 떨어지면 자동으로 화질 단계를 낮춤
- 파크골프 미니게임·크리스마스 장식(bloom 포함)은 **필요할 때만 로딩**(코드 분할)
- 절차적 텍스처는 캔버스로 한 번만 만들고 재사용, 탭이 숨겨지면 렌더링 정지
- 첫 로딩 전송량: 약 **1.3MB (gzip)** — 물리엔진 WASM 0.84MB + three.js 0.19MB + 앱 0.2MB + 폰트 26KB

---

## 7. 3D 간판용 한글 폰트 (서브셋)

정문 금색 글씨(명조)와 현수막·표지판(고딕)은 **필요한 글자만 담은 woff 폰트**(`public/fonts/*.woff`, 각 11~15KB)를 씁니다.
원본은 Google Fonts의 Noto Serif KR / Noto Sans KR (OFL 라이선스)입니다.

간판 문구를 바꾸려면:
1. `src/config/signTexts.json` 의 문구를 고칩니다.
2. Noto Sans KR / Noto Serif KR 가변 폰트 TTF를 받아 `fonts-src/NotoSansKR.ttf`, `fonts-src/NotoSerifKR.ttf` 로 저장합니다.
3. `npm run fonts` 를 실행하면 `public/fonts/` 의 서브셋이 다시 만들어집니다.

---

## 8. 폴더 구조

```
src/
  world/      지형, 하늘·조명, 정문·현수막, 본관, 석축·조경, 운동장, 파크골프장, 텍스처
  player/     내 캐릭터 이동(Rapier 캐릭터 컨트롤러)·3인칭 카메라·입력
  avatar/     아바타 생성(SkinnedMesh)·애니메이션·이름표
  net/        Supabase Realtime 동기화, 원격 아바타
  golf/       파크골프 미니게임 (지연 로딩)
  xmas/       크리스마스 장식·눈·bloom (지연 로딩)
  ui/         입장 화면, HUD, 패널
reference/    참고 사진 (정문, 본관) 
```
