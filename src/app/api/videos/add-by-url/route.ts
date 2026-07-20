import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

function extractVideoId(input: string): string | null {
  const trimmed = input.trim()
  // Already a video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  // YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = trimmed.match(p)
    if (m) return m[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, campaign_id, tags } = body

    if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    if (!url) return NextResponse.json({ error: 'URL or video ID required' }, { status: 400 })

    const videoId = extractVideoId(url)
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL or video ID' }, { status: 400 })

    // Check if video already exists in DB
    const { data: existing } = await supabase
      .from('videos')
      .select('id, youtube_id, title, channel_name, channel_id, view_count, duration, duration_sec, thumbnail_url, published_at')
      .eq('youtube_id', videoId)
      .single()

    let video = existing

    if (!video) {
      // Fetch metadata from YouTube oEmbed (no API key needed)
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )

      if (!oembedRes.ok) {
        return NextResponse.json({ error: 'Video not found or unavailable' }, { status: 404 })
      }

      const oembed = await oembedRes.json()
      const title = oembed.title || 'Unknown Title'
      const channelName = oembed.author_name || 'Unknown Channel'
      const channelId = oembed.author_url?.split('/').pop() || ''

      // Insert into videos table
      const { data: newVideo, error: insertError } = await supabase
        .from('videos')
        .upsert({
          youtube_id: videoId,
          title,
          channel_name: channelName,
          channel_id: channelId,
          thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          is_deleted: false,
          is_ours: false,
        }, { onConflict: 'youtube_id', ignoreDuplicates: false })
        .select('id, youtube_id, title, channel_name, channel_id, view_count, duration, duration_sec, thumbnail_url, published_at')
        .single()

      if (insertError) {
        console.error('Video insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      video = newVideo
    }

    if (!video) return NextResponse.json({ error: 'Failed to create video' }, { status: 500 })

    // Link to campaign if not already linked
    const { data: existingLink } = await supabase
      .from('campaign_videos')
      .select('video_id')
      .eq('campaign_id', campaign_id)
      .eq('video_id', video.id)
      .single()

    if (!existingLink) {
      const { error: linkError } = await supabase
        .from('campaign_videos')
        .insert({ campaign_id, video_id: video.id, first_seen_at: new Date().toISOString() })

      if (linkError) {
        console.error('Campaign link error:', linkError)
        return NextResponse.json({ error: linkError.message }, { status: 500 })
      }
    }

    // Add brand tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Delete existing tags
      await supabase
        .from('brand_tags')
        .delete()
        .eq('video_id', video.id)
        .eq('campaign_id', campaign_id)

      // Insert new tags
      const tagRows = tags
        .filter((t: string) => t?.trim())
        .map((t: string) => ({
          video_id: video.id,
          brand_name: t.trim(),
          campaign_id,
        }))

      if (tagRows.length > 0) {
        await supabase.from('brand_tags').upsert(tagRows, {
          onConflict: 'video_id,brand_name,campaign_id',
          ignoreDuplicates: true,
        })
      }
    }

    // Fetch fresh view count
    const { data: freshVideo } = await supabase
      .from('videos')
      .select('view_count')
      .eq('id', video.id)
      .single()

    return NextResponse.json({
      video: {
        ...video,
        view_count: freshVideo?.view_count ?? video.view_count,
        tags: tags || [],
      },
      message: existing ? 'Video already in campaign' : 'Video added to campaign',
    })
  } catch (e: any) {
    console.error('Add video by URL error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
