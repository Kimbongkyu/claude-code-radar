#!/usr/bin/env python3
"""GitHub 토픽 검색으로 클로드 코드 관련 저장소를 모아 data/projects.json 을 만든다.

표준 라이브러리만 사용한다. GITHUB_TOKEN 이 있으면 호출 한도가 크게 늘어난다.

사용법:
  python3 scripts/collect.py                 # 설정 파일 기준 전체 수집
  python3 scripts/collect.py --limit 20      # 상위 20개만 (로컬 테스트용)
  python3 scripts/collect.py --no-summary    # README 요약 단계 건너뛰기
  python3 scripts/collect.py --resummarize   # 모든 요약 다시 만들기
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
API = "https://api.github.com"
README_LIMIT = 20000  # 요약에 넘기는 README 최대 글자 수


class RateLimited(Exception):
    pass


def gh(path: str, params: dict | None = None, accept: str = "application/vnd.github+json"):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"Accept": accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "claude-code-radar"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                body = res.read().decode("utf-8", "replace")
                return body if accept.endswith("raw") else json.loads(body)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (403, 429):
                remaining = e.headers.get("X-RateLimit-Remaining")
                if remaining == "0" or e.code == 429:
                    raise RateLimited(path)
            if e.code >= 500 and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"  ! {e.code} {path}", file=sys.stderr)
            return None
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"  ! 네트워크 오류 {path}: {e}", file=sys.stderr)
            return None
    return None


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def search_repositories(queries: list[str], pages: int) -> dict[str, dict]:
    found: dict[str, dict] = {}
    for q in queries:
        for page in range(1, pages + 1):
            res = gh("/search/repositories", {"q": q, "sort": "stars", "order": "desc", "per_page": 100, "page": page})
            if not res or not res.get("items"):
                break
            for item in res["items"]:
                if item.get("fork"):
                    continue
                found.setdefault(item["full_name"], item)
            if len(res["items"]) < 100:
                break
            time.sleep(2)  # 검색 API는 분당 호출 수 제한이 따로 있다
        print(f"검색 '{q}' → 누적 {len(found)}개")
    return found


def classify(item: dict) -> str:
    """토픽은 주인이 붙이므로 이름·설명 키워드로 보정한다."""
    topics = " ".join(item.get("topics") or [])
    text = f"{item['name']} {item.get('description') or ''} {topics}".lower()
    if "plugin" in text:
        return "plugin"
    if "skill" in text:
        return "skill"
    if "mcp" in text:
        return "mcp"
    return "tool"


def activity_level(pushed_at: str, now: datetime) -> str:
    pushed = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
    days = (now - pushed).days
    if days <= 30:
        return "active"
    if days <= 90:
        return "caution"
    return "dormant"


def stars_delta(history: dict, full_name: str, stars: int, today: str) -> int | None:
    """7일 전(없으면 그 이후 가장 오래된) 기록과 비교한다. 기록이 오늘뿐이면 None."""
    entries = history.get(full_name, {})
    target = (datetime.fromisoformat(today) - timedelta(days=7)).date().isoformat()
    older = [d for d in entries if d <= target]
    if older:
        return stars - entries[max(older)]
    earlier = [d for d in entries if d < today]
    if earlier:
        return stars - entries[min(earlier)]
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--no-summary", action="store_true")
    ap.add_argument("--resummarize", action="store_true")
    args = ap.parse_args()

    cfg = load_json(ROOT / "config.json", {})
    limit = args.limit or cfg.get("limit", 200)
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()

    history = load_json(DATA / "history.json", {})
    summaries = load_json(DATA / "summaries.json", {})
    previous = {p["full_name"]: p for p in load_json(DATA / "projects.json", {}).get("projects", [])}

    try:
        found = search_repositories(cfg["queries"], cfg.get("search_pages", 3))
    except RateLimited:
        print("검색 중 호출 한도에 도달했습니다. 기존 데이터를 유지합니다.", file=sys.stderr)
        return 1
    if not found:
        print("검색 결과가 비어 있어 기존 데이터를 유지합니다.", file=sys.stderr)
        return 1

    top = sorted(found.values(), key=lambda i: i["stargazers_count"], reverse=True)[:limit]
    since = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")

    summary_mod = None
    if not args.no_summary and cfg.get("summary", {}).get("enabled", True):
        sys.path.insert(0, str(Path(__file__).parent))
        import summarize as summary_mod  # noqa: E402
    new_summaries = 0
    max_new = cfg.get("summary", {}).get("max_per_run", 40)

    projects = []
    limited = False
    for i, item in enumerate(top, 1):
        name = item["full_name"]
        prev = previous.get(name, {})
        commits, release = prev.get("commits_30d"), prev.get("latest_release")
        if not limited:
            try:
                res = gh(f"/repos/{name}/commits", {"since": since, "per_page": 100})
                commits = len(res) if isinstance(res, list) else commits
                rel = gh(f"/repos/{name}/releases/latest")
                release = rel.get("published_at") if rel else None
                if summary_mod:
                    readme = gh(f"/repos/{name}/readme", accept="application/vnd.github.raw") or ""
                    readme = readme[:README_LIMIT]
                    digest = hashlib.sha1(readme.encode("utf-8")).hexdigest()
                    old = summaries.get(name)
                    stale = args.resummarize or not old or old.get("readme_hash") != digest
                    if readme and stale and new_summaries < max_new:
                        meta = {"name": name, "description": item.get("description"), "topics": item.get("topics")}
                        result = summary_mod.summarize(readme, meta, cfg["summary"])
                        if result:
                            summaries[name] = {
                                "readme_hash": digest,
                                "summary": result["summary"],
                                "provider": result["provider"],
                                "model": result["model"],
                                "generated_at": now.strftime("%Y-%m-%d"),
                            }
                            new_summaries += 1
            except RateLimited:
                print("호출 한도에 도달했습니다. 남은 저장소는 이전 값을 사용합니다.", file=sys.stderr)
                limited = True

        history.setdefault(name, {})[today] = item["stargazers_count"]
        projects.append({
            "rank": i,
            "full_name": name,
            "owner": item["owner"]["login"],
            "name": item["name"],
            "url": item["html_url"],
            "description": item.get("description"),
            "stars": item["stargazers_count"],
            "stars_delta_7d": stars_delta(history, name, item["stargazers_count"], today),
            "forks": item["forks_count"],
            "language": item.get("language"),
            "license": (item.get("license") or {}).get("spdx_id"),
            "topics": item.get("topics") or [],
            "kind": classify(item),
            "pushed_at": item["pushed_at"],
            "commits_30d": commits,
            "open_issues": item["open_issues_count"],
            "latest_release": release,
            "archived": item.get("archived", False),
            "activity": activity_level(item["pushed_at"], now),
            "summary": summaries.get(name),
        })
        if i % 20 == 0:
            print(f"  {i}/{len(top)} 처리")

    # 60일 넘은 기록과 목록에서 빠진 저장소의 기록은 정리한다
    cutoff = (now - timedelta(days=60)).date().isoformat()
    names = {p["full_name"] for p in projects}
    history = {n: {d: s for d, s in h.items() if d >= cutoff} for n, h in history.items() if n in names}

    save_json(DATA / "history.json", history)
    save_json(DATA / "summaries.json", {n: s for n, s in summaries.items() if n in names})
    save_json(DATA / "projects.json", {
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(projects),
        "projects": projects,
    })
    print(f"완료: {len(projects)}개 저장, 새 요약 {new_summaries}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
