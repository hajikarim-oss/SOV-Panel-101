import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { queryAll, queryOne } from './supabase'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface OAuthTokenSet {
  access_token: string
  refresh_token?: string
  expiry_date: number
  token_type: string
}

export interface YouTubeOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

function getOAuthConfig(): YouTubeOAuthConfig {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
  }
}

let oauth2Client: OAuth2Client | null = null

function getOAuth2Client(): OAuth2Client {
  if (!oauth2Client) {
    const config = getOAuthConfig()
    oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri)
  }
  return oauth2Client
}

export function generateAuthUrl(): string {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function exchangeCode(code: string): Promise<OAuthTokenSet> {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const tokenSet: OAuthTokenSet = {
    access_token: tokens.access_token || '',
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || Date.now(),
    token_type: tokens.token_type || 'Bearer',
  }

  await saveOAuthTokens(tokenSet)
  return tokenSet
}

export async function refreshAccessToken(): Promise<OAuthTokenSet> {
  const client = getOAuth2Client()
  const tokens = await loadOAuthTokens()

  if (!tokens) {
    throw new Error('No OAuth tokens found. Please authenticate first.')
  }

  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const { credentials } = await client.refreshAccessToken()

  const tokenSet: OAuthTokenSet = {
    access_token: credentials.access_token || '',
    refresh_token: credentials.refresh_token || tokens.refresh_token,
    expiry_date: credentials.expiry_date || Date.now(),
    token_type: credentials.token_type || 'Bearer',
  }

  await saveOAuthTokens(tokenSet)
  return tokenSet
}

async function saveOAuthTokens(tokens: OAuthTokenSet): Promise<void> {
  const now = new Date().toISOString()
  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ('youtube_oauth_tokens', $1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(tokens), now]
  )
}

export async function loadOAuthTokens(): Promise<OAuthTokenSet | null> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM system_metadata WHERE key = 'youtube_oauth_tokens'`
  )

  if (!row?.value) return null

  try {
    return JSON.parse(row.value)
  } catch {
    return null
  }
}

export async function getValidAccessToken(): Promise<string> {
  let tokens = await loadOAuthTokens()

  if (!tokens) {
    throw new Error('YouTube OAuth not configured. Please authenticate at /api/auth/youtube')
  }

  const buffer = 5 * 60 * 1000
  if (tokens.expiry_date < Date.now() + buffer) {
    tokens = await refreshAccessToken()
  }

  return tokens.access_token
}

export async function youtubeApiFetch<T = unknown>(
  endpoint: string,
  params: Record<string, string> = {},
  options: { quotaCost?: number; keyId?: string } = {}
): Promise<T> {
  const accessToken = await getValidAccessToken()

  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errMsg = (err as { error?: { message?: string } })?.error?.message ?? res.statusText

    if (res.status === 401) {
      await refreshAccessToken()
      return youtubeApiFetch(endpoint, params, options)
    }

    throw new Error(`YouTube API error (${res.status}): ${errMsg}`)
  }

  if (options.quotaCost && options.keyId) {
    await consumeOAuthQuota(options.quotaCost)
  }

  return res.json()
}

async function consumeOAuthQuota(units: number): Promise<void> {
  await queryAll(
    `UPDATE api_keys SET units_used = units_used + $1, last_used_at = NOW() WHERE label = $2`,
    [units, 'oauth_service_account']
  )
}

export interface YouTubeSearchResult {
  items: Array<{
    id: { videoId: string }
    snippet: {
      title: string
      channelTitle: string
      channelId: string
      publishedAt: string
      thumbnails: { medium?: { url: string } }
    }
  }>
  pageInfo: { totalResults: number }
}

export interface YouTubeVideoResult {
  items: Array<{
    id: string
    snippet: {
      title: string
      description: string
      channelTitle: string
      channelId: string
      publishedAt: string
      thumbnails: { medium?: { url: string } }
    }
    statistics: {
      viewCount: string
      likeCount?: string
      commentCount?: string
    }
    contentDetails: {
      duration: string
    }
  }>
}

export async function searchYouTubeOAuth(
  keyword: string,
  maxResults: number = 50,
  regionCode: string = 'IN'
): Promise<YouTubeSearchResult> {
  return youtubeApiFetch<YouTubeSearchResult>('search', {
    part: 'id,snippet',
    q: keyword,
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
    regionCode,
  }, { quotaCost: 100, keyId: 'oauth' })
}

export async function getVideoDetailsOAuth(
  videoIds: string[]
): Promise<YouTubeVideoResult> {
  const idsToFetch = videoIds.slice(0, 50)
  return youtubeApiFetch<YouTubeVideoResult>('videos', {
    part: 'statistics,snippet,contentDetails',
    id: idsToFetch.join(','),
  }, { quotaCost: 1, keyId: 'oauth' })
}

export async function getViewCountsOAuth(
  videoIds: string[]
): Promise<Array<{ youtube_id: string; view_count: number; is_deleted: boolean }>> {
  const idsToFetch = videoIds.slice(0, 50)

  const data = await youtubeApiFetch<YouTubeVideoResult>('videos', {
    part: 'statistics',
    id: idsToFetch.join(','),
  }, { quotaCost: 1, keyId: 'oauth' })

  const found = new Set(data.items?.map(i => i.id) || [])
  return idsToFetch.map(id => ({
    youtube_id: id,
    view_count: found.has(id)
      ? parseInt(data.items!.find(i => i.id === id)!.statistics?.viewCount ?? '0', 10)
      : 0,
    is_deleted: !found.has(id),
  }))
}

export async function getChannelDetailsOAuth(
  channelIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(channelIds)).slice(0, 50)

  const data = await youtubeApiFetch<{ items: Array<{ id: string; snippet?: { country?: string } }> }>('channels', {
    part: 'snippet',
    id: uniqueIds.join(','),
  }, { quotaCost: 1, keyId: 'oauth' })

  const countries = new Map<string, string>()
  data.items?.forEach(item => {
    if (item.snippet?.country) {
      countries.set(item.id, item.snippet.country.toUpperCase())
    }
  })
  return countries
}

export async function revokeOAuthTokens(): Promise<void> {
  const tokens = await loadOAuthTokens()
  if (tokens?.access_token) {
    const client = getOAuth2Client()
    await client.revokeToken(tokens.access_token)
  }
  await queryAll(`DELETE FROM system_metadata WHERE key = 'youtube_oauth_tokens'`)
}
