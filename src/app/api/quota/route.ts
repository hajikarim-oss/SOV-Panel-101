import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { getQuotaStatus, checkQuotaAlerts, requestQuotaIncrease, exportQuotaReport, getGoogleCloudConsoleUrl, getQuotaIncreaseRequestTemplate } from '@/lib/quota-monitor'

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action')

    if (action === 'status') {
      const status = await getQuotaStatus()
      return NextResponse.json(status)
    }

    if (action === 'alerts') {
      const alerts = await checkQuotaAlerts()
      return NextResponse.json({ alerts })
    }

    if (action === 'report') {
      const report = await exportQuotaReport()
      return NextResponse.json(JSON.parse(report))
    }

    if (action === 'console-url') {
      const projectId = req.nextUrl.searchParams.get('project_id')
      if (!projectId) {
        return NextResponse.json({ error: 'project_id required' }, { status: 400 })
      }
      return NextResponse.json({ url: getGoogleCloudConsoleUrl(projectId) })
    }

    if (action === 'template') {
      return NextResponse.json({ template: getQuotaIncreaseRequestTemplate() })
    }

    const status = await getQuotaStatus()
    const alerts = await checkQuotaAlerts()

    return NextResponse.json({
      status,
      alerts,
      console_url: getGoogleCloudConsoleUrl(process.env.GOOGLE_CLOUD_PROJECT_ID || ''),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'increase') {
      const { project_id, current_limit, requested_limit, justification } = body
      if (!project_id || !current_limit || !requested_limit) {
        return NextResponse.json({ error: 'project_id, current_limit, requested_limit required' }, { status: 400 })
      }

      const result = await requestQuotaIncrease(
        project_id,
        current_limit,
        requested_limit,
        justification || 'Competitive intelligence dashboard - YouTube market analysis'
      )

      return NextResponse.json(result)
    }

    if (action === 'reset-key') {
      const { key_id } = body
      if (!key_id) {
        return NextResponse.json({ error: 'key_id required' }, { status: 400 })
      }

      await queryAll(
        `UPDATE api_keys SET units_used = 0, reset_date = $1 WHERE id = $2`,
        [new Date().toISOString().split('T')[0], key_id]
      )

      return NextResponse.json({ ok: true, message: 'Key quota reset' })
    }

    if (action === 'toggle-key') {
      const { key_id } = body
      if (!key_id) {
        return NextResponse.json({ error: 'key_id required' }, { status: 400 })
      }

      const key = await queryAll<any>(`SELECT is_active FROM api_keys WHERE id = $1`, [key_id])
      const currentActive = key?.[0]?.is_active ?? true

      await queryAll(
        `UPDATE api_keys SET is_active = $1 WHERE id = $2`,
        [!currentActive, key_id]
      )

      return NextResponse.json({ ok: true, message: `Key ${currentActive ? 'disabled' : 'enabled'}` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
