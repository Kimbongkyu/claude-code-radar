export type Kind = 'skill' | 'plugin' | 'mcp' | 'tool';
export type Activity = 'active' | 'caution' | 'dormant';

export type Summary = {
  one_liner: string;
  features: string[];
  audience: string;
  install: {label: string; command: string}[];
  example: string;
  cautions: string[];
};

export type Project = {
  rank: number;
  full_name: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  description_ko: string | null;
  stars: number;
  stars_delta_7d: number | null;
  forks: number;
  language: string | null;
  license: string | null;
  topics: string[];
  kind: Kind;
  pushed_at: string;
  commits_30d: number | null;
  open_issues: number;
  latest_release: string | null;
  archived: boolean;
  activity: Activity;
  summary: null | {
    summary: Summary;
    provider: string;
    model: string;
    generated_at: string;
  };
};

export type Dataset = {
  generated_at: string;
  count: number;
  projects: Project[];
};

export type SortKey = 'stars' | 'delta' | 'commits' | 'pushed';
