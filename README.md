# Claude Code Radar

클로드 코드 관련 스킬, 플러그인, MCP 서버를 GitHub 스타와 최근 활동으로 한눈에 보는 목록입니다.
GitHub 토픽을 검색해 하루 한 번 데이터를 갱신하고, 정적 웹페이지(GitHub Pages)로 보여줍니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `scripts/collect.py` | 토픽 검색, 활성도·스타 증가량 계산, README 수집 (표준 라이브러리만 사용) |
| `scripts/summarize.py` | README 요약. 공급자(OpenAI/Claude)는 `config.json`에서만 교체 |
| `data/` | `projects.json`(화면용), `history.json`(스타 기록), `summaries.json`(요약 캐시) |
| `web/` | Vite + React + [Astryx](https://astryx.atmeta.com) 화면 |
| `.github/workflows/` | `collect.yml`(매일 수집), `pages.yml`(배포) |

## 처음 설정

1. 저장소 **Settings → Pages → Source** 를 `GitHub Actions` 로 지정
2. **Settings → Secrets and variables → Actions** 에 `OPENAI_API_KEY` 등록 (Claude를 쓸 때는 `ANTHROPIC_API_KEY`)
3. **Actions → collect → Run workflow** 로 첫 수집 실행 (이후 매일 06:17 KST 자동 실행)

키가 없으면 요약만 건너뛰고 나머지 목록은 정상 갱신됩니다.

## 요약 공급자 바꾸기

`config.json` 의 `summary.provider` (`openai` | `anthropic`) 와 `summary.model` 만 바꿉니다.
기존 요약은 유지되고, README가 바뀐 저장소부터 새 공급자로 요약합니다. 전부 다시 만들려면
collect 워크플로를 수동 실행하면서 `resummarize` 를 켭니다.

## 로컬 실행

```bash
cp .env.example .env            # 키 입력 후 `set -a; . ./.env; set +a`
python3 scripts/collect.py --limit 20
cd web && npm install && mkdir -p public/data && cp ../data/projects.json public/data/ && npm run dev
```

## 활성도 기준

마지막 푸시가 30일 이내면 **활발**, 30~90일이면 **주의**, 90일 초과면 **중단 가능성**. 완성형 단일 스킬은 조용할 수 있어 숨기지 않고 표시만 합니다.

설계 문서: Claude Docs 「클로드 코드 생태계 스타 랭킹 페이지 설계」
