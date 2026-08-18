INSERT INTO users (id, name, email, avatar_initials) VALUES
  ('u-rony', 'Sarowar Hossain Rony', 'shrony1995@gmail.com', 'SR'),
  ('u-maya', 'Maya Rahman', 'maya@example.com', 'MR'),
  ('u-adnan', 'Adnan Khan', 'adnan@example.com', 'AK')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, description) VALUES
  ('ws-cyber-invasion', 'Cyber Invasion Army', 'A live planning space for CTF operations and security research.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('ws-cyber-invasion', 'u-rony', 'owner'), ('ws-cyber-invasion', 'u-maya', 'admin'), ('ws-cyber-invasion', 'u-adnan', 'member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO projects (id, workspace_id, name, summary, color) VALUES
  ('p-platform', 'ws-cyber-invasion', 'Platform Hardening', 'Harden the collaboration delivery stack.', '#6d5dfc'),
  ('p-ctf', 'ws-cyber-invasion', 'CTF Operations', 'Coordinate research and challenge preparation.', '#e28c49')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date) VALUES
  ('t-001', 'p-platform', 'Add Socket.IO presence indicators', 'Show who is viewing the active workspace.', 'in_progress', 'high', 'u-rony', '2026-08-21'),
  ('t-002', 'p-platform', 'Document Redis adapter fallback', 'Explain single-node and Redis-backed modes.', 'in_review', 'medium', 'u-maya', '2026-08-20'),
  ('t-003', 'p-ctf', 'Create forensics challenge brief', 'Draft the task flow and evidence set.', 'backlog', 'high', 'u-adnan', '2026-08-24'),
  ('t-004', 'p-ctf', 'Review deployment runbook', 'Validate the production rollback sequence.', 'done', 'low', 'u-maya', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO activity (id, workspace_id, actor_id, message, occurred_at) VALUES
  ('a-001', 'ws-cyber-invasion', 'u-maya', 'moved “Document Redis adapter fallback” to review.', '2026-08-18T07:30:00.000Z'),
  ('a-002', 'ws-cyber-invasion', 'u-rony', 'started “Add Socket.IO presence indicators”.', '2026-08-18T08:00:00.000Z')
ON CONFLICT (id) DO NOTHING;
