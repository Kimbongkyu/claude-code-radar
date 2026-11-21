import {useEffect, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import type {Activity} from './types';

export const ACTIVITY_LABEL: Record<Activity | 'all', string> = {all: '전체', active: '활발', caution: '주의', dormant: '중단 가능성'};
const ACTIVITY_VARIANT = {active: 'success', caution: 'warning', dormant: 'error'} as const;

export const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('ko-KR'));

export function ago(iso: string | null): string {
  if (!iso) return '–';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return '오늘';
  if (days < 31) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export function ActivityBadge({value}: {value: Activity}) {
  return <Badge variant={ACTIVITY_VARIANT[value]} label={ACTIVITY_LABEL[value]} />;
}

export const MOBILE_QUERY = '(max-width: 820px)';

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
