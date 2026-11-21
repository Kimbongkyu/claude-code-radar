import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {ActivityBadge, MOBILE_QUERY, ago, fmt, useMedia} from './ui';
import type {Project} from './types';

const KIND_LABEL = {skill: '스킬', plugin: '플러그인', mcp: 'MCP 서버', tool: '기타'} as const;

function CopyCommand({command}: {command: string}) {
  const mobile = useMedia(MOBILE_QUERY);
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* 클립보드 권한이 없으면 직접 선택해서 복사한다 */
    }
  };
  return (
    <div className="cmd">
      <pre>
        <code>{command}</code>
      </pre>
      <Button variant="secondary" size={mobile ? 'lg' : 'sm'} onClick={copy} label={done ? '복사됨' : '복사'} />
    </div>
  );
}

export default function Detail({project: p, onClose}: {project: Project; onClose: () => void}) {
  const mobile = useMedia(MOBILE_QUERY);
  const size = mobile ? 'lg' : 'md';
  const s = p.summary?.summary;
  return (
    <article className="detail-body">
      <div className="detail-bar">
        <Button variant="ghost" size={mobile ? 'lg' : 'sm'} onClick={onClose} label="← 목록" />
      </div>

      <p className="kicker">{KIND_LABEL[p.kind]}</p>
      <h2>{p.full_name}</h2>
      <p className="detail-lede">{s?.one_liner || p.description_ko || p.description}</p>

      <dl className="facts">
        <div>
          <dt>스타</dt>
          <dd className="num">{fmt(p.stars)}</dd>
        </div>
        <div>
          <dt>마지막 푸시</dt>
          <dd>{ago(p.pushed_at)}</dd>
        </div>
        <div>
          <dt>30일 커밋</dt>
          <dd className="num">{fmt(p.commits_30d)}</dd>
        </div>
        <div>
          <dt>활성도</dt>
          <dd>
            <ActivityBadge value={p.activity} />
          </dd>
        </div>
      </dl>

      {p.archived && <p className="notice">보관 처리된(archived) 저장소입니다.</p>}

      {s ? (
        <>
          {s.features.length > 0 && (
            <section>
              <h3>주요 기능</h3>
              <ul>
                {s.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}
          {s.audience && (
            <section>
              <h3>이런 사람에게</h3>
              <p>{s.audience}</p>
            </section>
          )}
          {s.install.length > 0 && (
            <section>
              <h3>설치</h3>
              {s.install.map((i) => (
                <div key={i.command}>
                  {i.label && <p className="muted small">{i.label}</p>}
                  <CopyCommand command={i.command} />
                </div>
              ))}
            </section>
          )}
          {s.example && (
            <section>
              <h3>사용 예시</h3>
              <p>{s.example}</p>
            </section>
          )}
          {s.cautions.length > 0 && (
            <section>
              <h3>주의할 점</h3>
              <ul>
                {s.cautions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
          <p className="muted small">
            README를 {p.summary!.model}로 요약한 내용이며 오류가 있을 수 있습니다 ({p.summary!.generated_at}). 설치 전에 원문을 확인하세요.
          </p>
        </>
      ) : (
        <p className="muted">아직 README 요약이 없습니다. 원문에서 확인해 주세요.</p>
      )}

      <div className="detail-links">
        <Button variant="primary" size={size} href={p.url} label="GitHub 저장소" />
        <Button variant="ghost" size={size} href={`${p.url}#readme`} label="README 원문" />
      </div>
    </article>
  );
}
