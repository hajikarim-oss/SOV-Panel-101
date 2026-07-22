import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authorizeCampaignAccess } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')

  const { authorized, error } = await authorizeCampaignAccess(req, campaignId)
  if (!authorized) return error
  if (!campaignId) return NextResponse.json({ data: [] })

  try {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaign_id, brand_name, metric, threshold, direction, webhook_url, email } = body

    if (!campaign_id || !brand_name || !metric || threshold === undefined || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('alert_rules')
      .insert({
        campaign_id,
        brand_name,
        metric,
        threshold: parseFloat(threshold),
        direction,
        webhook_url: webhook_url || null,
        email: email || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase
      .from('alert_rules')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', body.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
