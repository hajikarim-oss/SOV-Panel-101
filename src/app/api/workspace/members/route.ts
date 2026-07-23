import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const members = await queryAll<any>(`
      SELECT
        pm.campaign_id, pm.user_id, pm.role, pm.created_at as joined_at,
        u.email, u.role as user_role
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.campaign_id = $1::uuid
      ORDER BY
        CASE pm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'editor' THEN 3
          WHEN 'viewer' THEN 4
        END,
        pm.created_at ASC
    `, [campaignId])

    return NextResponse.json({ members })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg, members: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { campaign_id, user_id, role } = await req.json()
    if (!campaign_id || !user_id || !role) {
      return NextResponse.json({ error: 'campaign_id, user_id, and role required' }, { status: 400 })
    }
    if (!['owner', 'admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    await queryAll(
      `INSERT INTO project_members (campaign_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (campaign_id, user_id) DO UPDATE SET role = $3`,
      [campaign_id, user_id, role, session.id]
    )

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const campaign_id = req.nextUrl.searchParams.get('campaign_id')
    const user_id = req.nextUrl.searchParams.get('user_id')

    if (!campaign_id || !user_id) {
      return NextResponse.json({ error: 'campaign_id and user_id required' }, { status: 400 })
    }

    // Prevent removing the last owner
    const owners = await queryAll<any>(
      `SELECT user_id FROM project_members WHERE campaign_id = $1::uuid AND role = 'owner'`,
      [campaign_id]
    )
    if (owners.length === 1 && owners[0].user_id === user_id) {
      return NextResponse.json({ error: 'Cannot remove the last owner. Transfer ownership first.' }, { status: 400 })
    }

    await queryAll(
      `DELETE FROM project_members WHERE campaign_id = $1::uuid AND user_id = $2::uuid`,
      [campaign_id, user_id]
    )

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
