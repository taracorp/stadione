-- Audit canonical role permission matrix.

WITH canonical_roles AS (
  SELECT unnest(ARRAY[
    'platform_admin',
    'moderator',
    'reporter',
    'tournament_host',
    'venue_partner',
    'assistant_referee',
    'timekeeper',
    'member',
    'fans',
    'supporter'
  ]) AS role
)
SELECT
  cr.role,
  COUNT(rp.permission) AS permission_count,
  COALESCE(array_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL), ARRAY[]::text[]) AS permissions
FROM canonical_roles cr
LEFT JOIN role_permissions rp ON rp.role = cr.role
GROUP BY cr.role
ORDER BY cr.role;
