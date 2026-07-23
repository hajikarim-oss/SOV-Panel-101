import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    // Ensure project_members table exists (idempotent)
    await queryAll(`
      CREATE TABLE IF NOT EXISTS project_members (
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
        invited_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (campaign_id, user_id)
      )
    `)

    // Ensure the logged-in user has an owner entry for every campaign
    // that doesn't have any owner yet
    await queryAll(`
      INSERT INTO project_members (campaign_id, user_id, role)
      SELECT c.id, $1::uuid, 'owner'
      FROM campaigns c
      WHERE NOT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.campaign_id = c.id AND pm.role = 'owner'
      )
      ON CONFLICT (campaign_id, user_id) DO NOTHING
    `, [session.id])

    // Ensure the logged-in user has at least SOME role for every campaign
    // (if they don't already have one)
    await queryAll(`
      INSERT INTO project_members (campaign_id, user_id, role)
      SELECT c.id, $1::uuid, 'owner'
      FROM campaigns c
      WHERE NOT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.campaign_id = c.id AND pm.user_id = $1::uuid
      )
      ON CONFLICT (campaign_id, user_id) DO NOTHING
    `, [session.id])

    // Now query with the project_members join
    const projects = await queryAll<any>(`
      SELECT
        c.id, c.name, c.category, c.sub_category, c.description, c.status, c.created_at,
        COALESCE(pm.role, 'viewer') as role,
        COALESCE(k.cnt, 0)::INT as keyword_count,
        COALESCE(b.cnt, 0)::INT as brand_count,
        s.last_scraped
      FROM campaigns c
      LEFT JOIN project_members pm ON pm.campaign_id = c.id AND pm.user_id = $1::uuid
      LEFT JOIN (
        SELECT campaign_id, COUNT(*)::INT as cnt
        FROM keywords WHERE status = 'active'
        GROUP BY campaign_id
      ) k ON k.campaign_id = c.id
      LEFT JOIN (
        SELECT campaign_id, COUNT(*)::INT as cnt
        FROM campaign_brands
        GROUP BY campaign_id
      ) b ON b.campaign_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (campaign_id) campaign_id, created_at as last_scraped
        FROM scrape_jobs
        ORDER BY campaign_id, created_at DESC
      ) s ON s.campaign_id = c.id
      WHERE pm.user_id = $1::uuid
      ORDER BY c.created_at DESC
    `, [session.id])

    return NextResponse.json({ projects })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Workspace API error:', e)
    return NextResponse.json({ error: msg, projects: [] }, { status: 500 })
  }
}
