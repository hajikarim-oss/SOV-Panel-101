'use client'

import { Shield, ExternalLink, PlayCircle, Lock, Eye, Database, Trash2, Mail, CheckCircle } from 'lucide-react'

const LAST_UPDATED = 'July 10, 2026'

function Section({ icon: Icon, iconColor, title, children }: {
  icon: React.ElementType; iconColor: string; title: string; children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: `${iconColor}14`, border: `1px solid ${iconColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-bright)' }}>{title}</h2>
      </div>
      <div style={{
        paddingLeft: 48,
        fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8,
      }}>
        {children}
      </div>
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <CheckCircle size={14} style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div className="anim-fade-up">
      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,159,28,0.08) 0%, rgba(79,156,249,0.06) 100%)',
        border: '1px solid var(--border-1)',
        borderRadius: 16,
        padding: '32px 36px',
        marginBottom: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-dark) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(255,159,28,0.35)',
        }}>
          <Shield size={28} color="#0A0F1A" strokeWidth={2.5} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Privacy <span className="accent">Policy</span></h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
            SOV Panel — YouTube Share-of-Voice Analytics Platform by TheBoredMonkey<br />
            <strong style={{ color: 'var(--text-muted)' }}>The Bored Monkey</strong>
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Last Updated</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>{LAST_UPDATED}</div>
          <div style={{ marginTop: 8 }}>
            <span className="badge badge-green" style={{ fontSize: 10 }}>
              <CheckCircle size={10} /> YouTube API Compliant
            </span>
          </div>
        </div>
      </div>

      {/* ── YouTube API Compliance Notice ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,0,0,0.06) 0%, rgba(255,0,0,0.02) 100%)',
        border: '1px solid rgba(255,70,70,0.25)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 28,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <PlayCircle size={20} style={{ color: '#FF4444', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-primary)' }}>YouTube API Services Notice:</strong> SOV Panel uses the YouTube Data API v3.
          By using this service, you also agree to Google's{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>
            Privacy Policy <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </a>
          {' '}and the{' '}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>
            YouTube Terms of Service <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </a>.
        </div>
      </div>

      {/* ── Policy Content ── */}
      <div className="card" style={{ padding: '32px 36px' }}>

        <Section icon={Shield} iconColor="#FF9F1C" title="1. About This Policy">
          <p style={{ marginBottom: 12 }}>
            This Privacy Policy explains how <strong style={{ color: 'var(--text-primary)' }}>The Bored Monkey</strong> ("we", "our", or "us")
            collects, uses, stores, and protects information in connection with the <strong style={{ color: 'var(--text-primary)' }}>SOV Panel</strong> YouTube analytics platform.
          </p>
          <p>
            This policy applies to all users of SOV Panel, including campaign administrators, brand managers, and analytics viewers.
            We are committed to full compliance with YouTube's API Services Terms of Service, Google's Developer Policies, and applicable data protection laws.
          </p>
        </Section>

        <Section icon={PlayCircle} iconColor="#FF4444" title="2. YouTube API Services & Data Usage">
          <p style={{ marginBottom: 14 }}>
            SOV Panel accesses YouTube Data API v3 strictly for the following <strong style={{ color: 'var(--text-primary)' }}>analytical purposes</strong>:
          </p>
          <BulletList items={[
            'Retrieving public video metadata (title, description, view counts, channel information, published date) for tracked keywords.',
            'Fetching search result rankings to measure keyword-level Share-of-Voice (SOV) for brands.',
            'Recording daily view count snapshots for trend analysis and growth calculations.',
            'Collecting transcript/caption data (where publicly available) for AI-powered brand mention analysis.',
          ]} />
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,159,28,0.06)', borderRadius: 9, border: '1px solid var(--orange-border)' }}>
            <strong style={{ color: 'var(--orange)', fontSize: 13 }}>Important:</strong>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>
              SOV Panel does <em>not</em> access private user data, YouTube account information, watch history, or any personally identifiable viewer information.
              All data collected is publicly available on YouTube.
            </span>
          </div>
        </Section>

        <Section icon={Database} iconColor="#4F9CF9" title="3. Data We Collect">
          <p style={{ marginBottom: 14 }}>We collect two categories of data:</p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              A. YouTube Public Content Data (via YouTube Data API)
            </div>
            <BulletList items={[
              'Video ID, title, description, channel name, channel ID',
              'View count, like count (if public), published date',
              'Search ranking position for tracked keywords',
              'Captions/transcripts (public only)',
              'Video thumbnails (loaded directly from YouTube CDN)',
            ]} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              B. Platform Usage Data (collected from SOV Panel users)
            </div>
            <BulletList items={[
              'Campaign names, keywords, and brand configurations created by you',
              'API key identifiers (encrypted at rest, never displayed in full)',
              'Session activity logs for security and audit purposes',
              'Browser type, operating system, and screen resolution for UI optimization',
            ]} />
          </div>
        </Section>

        <Section icon={Eye} iconColor="#10B981" title="4. How We Use Data">
          <BulletList items={[
            'Generate Share-of-Voice analytics reports and dashboards.',
            'Track brand visibility trends across YouTube search results over time.',
            'Identify competitor brand performance and keyword ranking changes.',
            'Power AI-driven transcript analysis for brand mention extraction.',
            'Send automated alerts when competitor activity surges or rankings drop.',
            'Maintain audit logs for data accuracy and scraping job monitoring.',
            'Improve platform performance and user experience.',
          ]} />
          <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 9, border: '1px solid var(--border-1)' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>We do NOT:</strong>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, marginTop: 8, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 2 }}>
              <li>Sell, rent, or share user data with third parties for advertising</li>
              <li>Use YouTube data to identify individual viewers or users</li>
              <li>Access or store any YouTube user authentication tokens</li>
              <li>Use data for purposes beyond analytical reporting</li>
            </ul>
          </div>
        </Section>

        <Section icon={Lock} iconColor="#9B72F5" title="5. Data Storage & Security">
          <BulletList items={[
            'All data is stored on encrypted servers with AES-256 encryption at rest.',
            'API keys are hashed and never stored in plaintext. Only the first 8 characters are displayed in the UI.',
            'All data transmissions use HTTPS/TLS 1.3 encryption.',
            'Access to production databases is restricted to authenticated system processes only.',
            'YouTube API quota usage data is purged every 90 days.',
            'We conduct regular security audits and penetration testing.',
          ]} />

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(155,114,245,0.06)', borderRadius: 9, border: '1px solid rgba(155,114,245,0.2)' }}>
            <strong style={{ color: '#9B72F5', fontSize: 13 }}>API Quota Compliance:</strong>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.7 }}>
              SOV Panel implements a 2-bucket API key rotation system to stay within YouTube's 10,000 unit daily quota per project.
              We never exceed authorized usage limits. If a project reaches its daily quota, the system automatically rotates to the next available key in the pool.
            </p>
          </div>
        </Section>

        <Section icon={Trash2} iconColor="#F04759" title="6. Data Retention & Deletion">
          <p style={{ marginBottom: 14 }}>Data is retained according to the following schedule:</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                  {['Data Type', 'Retention Period', 'Deletion Method'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', background: 'var(--bg-elevated)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Video metadata (titles, views)', '12 months rolling', 'Automatic purge'],
                  ['Daily view snapshots', '2 years', 'Manual or scheduled purge'],
                  ['Transcripts & brand mentions', '6 months', 'Automatic purge'],
                  ['Dropped ranking logs', '90 days', 'Automatic purge'],
                  ['API quota logs', '90 days', 'Automatic purge'],
                  ['Campaign configurations', 'Until deleted by user', 'User self-service'],
                  ['Security audit logs', '1 year', 'System purge'],
                ].map(([type, period, method], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '11px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>{type}</td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-secondary)' }}>{period}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span className="badge badge-blue" style={{ fontSize: 9 }}>{method}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}>
            To request deletion of your campaign data or account, contact us at the address below.
            Requests are processed within 30 days.
          </p>
        </Section>

        <Section icon={Shield} iconColor="#06C9D7" title="7. Third-Party Services">
          <p style={{ marginBottom: 14 }}>SOV Panel integrates with the following third-party services:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                name: 'YouTube Data API v3',
                company: 'Google LLC',
                purpose: 'Fetching video metadata, search rankings, and captions',
                link: 'https://policies.google.com/privacy',
                linkLabel: "Google's Privacy Policy",
              },
              {
                name: 'Google Gemini AI',
                company: 'Google DeepMind',
                purpose: 'AI transcript analysis and brand mention extraction',
                link: 'https://policies.google.com/privacy',
                linkLabel: "Google's Privacy Policy",
              },
            ].map(svc => (
              <div key={svc.name} style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{svc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{svc.company}</div>
                  </div>
                  <a href={svc.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {svc.linkLabel} <ExternalLink size={11} />
                  </a>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{svc.purpose}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Eye} iconColor="#FF9F1C" title="8. Your Rights">
          <p style={{ marginBottom: 14 }}>
            As a user of SOV Panel, you have the following rights regarding your data:
          </p>
          <BulletList items={[
            'Right to Access: Request a full export of all data associated with your campaigns.',
            'Right to Rectification: Correct any inaccurate data stored in your campaigns.',
            'Right to Erasure: Request deletion of all your data within 30 days.',
            'Right to Restrict Processing: Pause all data collection for your campaigns.',
            'Right to Data Portability: Export your campaign data in JSON or CSV format.',
            'Right to Revoke YouTube Authorization: Revoke API access at any time via Google Security Settings.',
          ]} />
          <div style={{ marginTop: 14 }}>
            <p>To revoke YouTube API authorization specifically, visit:</p>
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 8, padding: '9px 16px', borderRadius: 8,
                background: 'rgba(255,159,28,0.08)', border: '1px solid var(--orange-border)',
                color: 'var(--orange)', textDecoration: 'none', fontWeight: 600, fontSize: 13,
              }}
            >
              <ExternalLink size={13} />
              Google Security Settings — Manage App Permissions
            </a>
          </div>
        </Section>

        <Section icon={Mail} iconColor="#10B981" title="9. Contact Us">
          <p style={{ marginBottom: 14 }}>
            For privacy-related questions, data requests, or to report concerns:
          </p>
          <div style={{
            padding: '20px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 100%)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>The Bored Monkey</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
              <div>📧 Email: <a href="mailto:privacy@theboredmonkey.com" style={{ color: 'var(--orange)', textDecoration: 'none' }}>privacy@theboredmonkey.com</a></div>
              <div>🌐 Website: <a href="https://theboredmonkey.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'none' }}>theboredmonkey.com</a></div>
              <div>⏱ Response time: Within 5 business days for privacy requests</div>
            </div>
          </div>
        </Section>

        {/* ── Footer ── */}
        <div style={{
          marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} TheBoredMonkey · SOV Panel v2.0 · All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Google Privacy Policy <ExternalLink size={10} />
            </a>
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              YouTube Terms <ExternalLink size={10} />
            </a>
            <a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              API ToS <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
