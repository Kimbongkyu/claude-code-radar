import {useEffect, useMemo, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import type {Activity, Dataset, Kind, Project, SortKey} from './types';
import Detail from './Detail';
import {ACTIVITY_LABEL, ActivityBadge, ago, fmt} from './ui';

const KIND_LABEL: Record<Kind | 'all', string> = {all: '전체', skill: '스킬', plugin: '플러그인', mcp: 'MCP', tool: '기타'};
const SORT_LABEL: Record<SortKey, string> = {stars: '스타', delta: '7일 증가', commits: '30일 커밋', pushed: '최근 푸시'};

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

const sortValue = (p: Project, key: SortKey): number => {
  switch (key) {
    case 'stars':
      return p.stars;
    case 'delta':
      return p.stars_delta_7d ?? -Infinity;
    case 'commits':
      return p.commits_30d ?? -Infinity;
    case 'pushed':
      return new Date(p.pushed_at).getTime();
  }
};

type Row = Project & Record<string, unknown>;

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [activity, setActivity] = useState<Activity | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('stars');
  const [selected, setSelected] = useState<string | null>(null);
  const isMobile = useMedia('(max-width: 820px)');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/projects.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Dataset) => setData(d))
      .catch(() => setError(true));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.projects
      .filter((p) => kind === 'all' || p.kind === kind)
      .filter((p) => activity === 'all' || p.activity === activity)
      .filter((p) => !q || `${p.full_name} ${p.description ?? ''} ${p.topics.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => sortValue(b, sort) - sortValue(a, sort)) as Row[];
  }, [data, query, kind, activity, sort]);

  const rising = useMemo(
    () =>
      (data?.projects ?? [])
        .filter((p) => (p.stars_delta_7d ?? 0) > 0)
        .sort((a, b) => (b.stars_delta_7d ?? 0) - (a.stars_delta_7d ?? 0))
        .slice(0, 5),
    [data],
  );

  const current = data?.projects.find((p) => p.full_name === selected) ?? null;

  const head = (key: SortKey, label: string) => (
    <button type="button" className="sort-head" data-on={sort === key} onClick={() => setSort(key)}>
      {label}
    </button>
  );

  const open = (p: Project) => setSelected(p.full_name);

  const columns = [
    {key: 'rank', header: '#', width: pixel(48), align: 'end' as const, renderCell: (p: Row) => <span className="muted num">{p.rank}</span>},
    {
      key: 'name',
      header: '프로젝트',
      width: proportional(4, {minWidth: 260}),
      renderCell: (p: Row) => (
        <div className="name-cell">
          <button type="button" className="link" data-on={p.full_name === selected} onClick={() => open(p)}>
            <span className="owner">{p.owner}/</span>
            {p.name}
          </button>
          <span className="desc">{p.description}</span>
        </div>
      ),
    },
    {key: 'stars', header: head('stars', '스타'), width: pixel(96), align: 'end' as const, renderCell: (p: Row) => <span className="num">{fmt(p.stars)}</span>},
    {
      key: 'delta',
      header: head('delta', '7일'),
      width: pixel(80),
      align: 'end' as const,
      renderCell: (p: Row) => <span className="num accent">{p.stars_delta_7d ? `+${fmt(p.stars_delta_7d)}` : '–'}</span>,
    },
    {key: 'commits', header: head('commits', '커밋 30일'), width: pixel(104), align: 'end' as const, renderCell: (p: Row) => <span className="num">{fmt(p.commits_30d)}</span>},
    {key: 'pushed', header: head('pushed', '마지막 푸시'), width: pixel(116), align: 'end' as const, renderCell: (p: Row) => <span className="muted">{ago(p.pushed_at)}</span>},
    {key: 'activity', header: '활성도', width: pixel(124), renderCell: (p: Row) => <ActivityBadge value={p.activity} />},
  ];

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>Claude Code Radar</h1>
          <p className="lede">클로드 코드 스킬·플러그인·MCP 서버를 스타와 최근 활동으로 훑어보는 목록</p>
        </div>
        {data && <p className="stamp">{data.count}개 · {data.generated_at.slice(0, 10)} 갱신</p>}
      </header>

      {error && <p className="notice">데이터를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>}
      {!data && !error && <p className="notice">불러오는 중…</p>}

      {data && (
        <>
          {rising.length > 0 && (
            <section className="rising" aria-label="최근 일주일 급상승">
              <h2>이번 주 급상승</h2>
              <ol>
                {rising.map((p) => (
                  <li key={p.full_name}>
                    <button type="button" className="link" onClick={() => open(p)}>
                      {p.name}
                    </button>
                    <span className="num accent">+{fmt(p.stars_delta_7d)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="toolbar">
            <TextInput label="검색" isLabelHidden type="search" placeholder="이름, 설명, 토픽 검색" value={query} onChange={(v) => setQuery(v)} />
            <div className="filters">
              <SegmentedControl label="종류" value={kind} onChange={(v) => setKind(v as Kind | 'all')}>
                {(Object.keys(KIND_LABEL) as (Kind | 'all')[]).map((k) => (
                  <SegmentedControlItem key={k} value={k} label={KIND_LABEL[k]} />
                ))}
              </SegmentedControl>
              <SegmentedControl label="활성도" value={activity} onChange={(v) => setActivity(v as Activity | 'all')}>
                {(Object.keys(ACTIVITY_LABEL) as (Activity | 'all')[]).map((k) => (
                  <SegmentedControlItem key={k} value={k} label={ACTIVITY_LABEL[k]} />
                ))}
              </SegmentedControl>
            </div>
            <label className="sort-select">
              <span>정렬</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="split" data-detail={current ? 'open' : 'closed'}>
            <div className="list">
              {rows.length === 0 ? (
                <p className="notice">조건에 맞는 프로젝트가 없습니다.</p>
              ) : isMobile ? (
                <ul className="cards">
                  {rows.map((p) => (
                    <li key={p.full_name}>
                      <button type="button" className="card" onClick={() => open(p)}>
                        <span className="card-top">
                          <span className="card-name">{p.name}</span>
                          <ActivityBadge value={p.activity} />
                        </span>
                        <span className="desc">{p.description}</span>
                        <span className="card-meta">
                          <span className="num">★ {fmt(p.stars)}</span>
                          {p.stars_delta_7d ? <span className="num accent">+{fmt(p.stars_delta_7d)}</span> : null}
                          <span className="muted">{ago(p.pushed_at)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Table data={rows} columns={columns} idKey="full_name" density="balanced" dividers="rows" hasHover />
              )}
            </div>

            {current && (
              <aside className="detail" aria-label="상세 정보">
                <Detail project={current} onClose={() => setSelected(null)} />
              </aside>
            )}
          </div>
        </>
      )}

      <footer className="foot">
        <p>스타 수는 인기도일 뿐 품질이나 안전성의 증거가 아닙니다. 비공식 프로젝트는 설치 전에 코드와 권한을 직접 확인하세요.</p>
        <Button variant="ghost" size="sm" href="https://github.com/Kimbongkyu/claude-code-radar">
          GitHub
        </Button>
      </footer>
    </div>
  );
}
