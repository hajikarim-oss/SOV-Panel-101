CREATE TABLE IF NOT EXISTS project_members (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (campaign_id, user_id)
);

-- Migrate existing user campaign assignments into project_members
INSERT INTO project_members (campaign_id, user_id, role, created_at)
SELECT u.campaign_id, u.id, 'admin', u.created_at
FROM users u
WHERE u.campaign_id IS NOT NULL
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- Auto-assign owner for all existing campaigns to any admin user who created them
-- (we use the first admin as fallback owner since we don't have a creator column yet)
INSERT INTO project_members (campaign_id, user_id, role)
SELECT c.id, u.id, 'owner'
FROM campaigns c
CROSS JOIN LATERAL (
  SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
) u
WHERE NOT EXISTS (
  SELECT 1 FROM project_members pm
  WHERE pm.campaign_id = c.id AND pm.role = 'owner'
)
ON CONFLICT (campaign_id, user_id) DO NOTHING;
