-- Published tournaments should always surface as an active public season.

UPDATE seasons s
SET status = 'active', updated_at = NOW()
FROM tournaments t
WHERE t.id = s.tournament_id
  AND s.status <> 'concluded'
  AND (t.is_published = TRUE OR t.status = 'published');
