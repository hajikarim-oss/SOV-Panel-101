import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export async function GET() {
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
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Campaigns GET error:', error)
      return { error: error.message, campaigns: [] }
    }

    const enriched = await Promise.all((campaigns || []).map(async (c: any) => {
      const [kwRes, brRes, sjRes] = await Promise.all([
        supabase.from('keywords').select('id').eq('campaign_id', c.id).eq('status', 'active'),
        supabase.from('campaign_brands').select('id').eq('campaign_id', c.id),
        supabase.from('scrape_jobs').select('created_at').eq('campaign_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      return {
        ...c,
        keyword_count: (kwRes.data || []).length,
        brand_count: (brRes.data || []).length,
        last_scraped: sjRes.data?.created_at || null,
      }
    }))

    return { campaigns: enriched }
}

export async function POST(req: NextRequest) {
  try {
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
