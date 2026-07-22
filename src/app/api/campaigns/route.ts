import { NextRequest, NextResponse } from 'next/server'
import { supabase, queryAll } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const data = await getCached(cacheKey.campaigns(), fetchCampaigns, CACHE_TTL.campaigns)
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Campaigns API error:', e)
    return NextResponse.json({ error: msg, campaigns: [] }, { status: 500 })
  }
}

async function fetchCampaigns() {
  try {
    const enriched = await queryAll<any>(`
      SELECT
        c.id, c.name, c.category, c.sub_category, c.description, c.status, c.created_at,
        COALESCE(k.cnt, 0)::INT as keyword_count,
        COALESCE(b.cnt, 0)::INT as brand_count,
        s.last_scraped
      FROM campaigns c
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
      ORDER BY c.created_at DESC
    `)
    return { campaigns: enriched }
  } catch (err: any) {
    console.error('Campaigns GET SQL error:', err)
    return { error: err.message, campaigns: [] }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, category, sub_category, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('campaigns')
      .upsert(
        { name: name.trim(), category: category ?? '', sub_category: sub_category ?? '', description: description ?? '' },
        { onConflict: 'name', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle()

    if (error) {
      console.error('Campaigns POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Campaign name already exists' }, { status: 409 })

    return NextResponse.json({ campaign: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Campaigns POST error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
