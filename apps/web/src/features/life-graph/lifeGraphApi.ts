import type { LifeGraphWorkspace } from './types';

export async function fetchLifeGraphWorkspace(): Promise<LifeGraphWorkspace> {
  const res = await fetch('/api/life-graph/workspace', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to load Life Graph: ${res.status}`);
  }

  return res.json();
}

export async function queryLifeGraph(query: string): Promise<Record<string, number>> {
  const res = await fetch('/api/life-graph/query-focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`Failed to query Life Graph: ${res.status}`);
  }

  const data = await res.json();

  return data.nodeRelevance ?? {};
}
