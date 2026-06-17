/**
 * GET /api/life-graph — the explainable Life Knowledge Graph, assembled from REAL data only:
 *   - Core API /v1/life/graph        → the persisted personal graph (objectives, deps, risks, domain CRUD)
 *   - Core API /v1/recommendations/roadmap → real recommendations (evidence + confidence)
 *   - Core API /v1/life/my-life      → real life-readiness score for the center node
 * No mock/fabricated data — if the user has nothing yet, this returns an honest empty graph.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { transformLifeGraph, type RawLifeGraph } from '@/lib/lifeGraph/transform';

export const dynamic = 'force-dynamic';

const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);

async function bearer(): Promise<string | null> {
  const sb = await createServerSupabaseClient();
  if (!sb) return null;
  const {
    data: { session },
  } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

async function coreGet(path: string, token: string): Promise<any> {
  try {
    const r = await fetch(`${CORE_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const token = await bearer();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [graph, roadmap, myLife] = await Promise.all([
    coreGet('/v1/life/graph', token),
    coreGet('/v1/recommendations/roadmap', token),
    coreGet('/v1/life/my-life', token),
  ]);

  const raw: RawLifeGraph = graph || { nodes: [], edges: [] };
  const recs = Array.isArray(roadmap?.recommendations)
    ? roadmap.recommendations
    : Array.isArray(roadmap?.items)
      ? roadmap.items
      : Array.isArray(roadmap)
        ? roadmap
        : [];
  const readiness =
    typeof myLife?.readiness?.overall === 'number'
      ? Math.round(myLife.readiness.overall)
      : typeof myLife?.life_readiness === 'number'
        ? Math.round(myLife.life_readiness)
        : typeof graph?.graph_integrity?.score === 'number'
          ? Math.round(graph.graph_integrity.score)
          : null;

  const data = transformLifeGraph(raw, recs, readiness);
  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
