-- Moves the Info Bar relationship fields (id lists in `info`) into `relations`:
-- one row per tie, so both records show it. A tie listed on both sides (A's
-- Children has B, B's Parents has A) is one row: the unique pair index drops
-- the second copy. The field keys stay in `info` as presence markers (null),
-- keeping the user's field order. Ids that match no record are skipped.

INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'parent', CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, 'person', r.id, j.value || '|' || r.id, 'biological', NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.parents') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.parents', json('null')) WHERE json_valid(info) AND json_type(info, '$.parents') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'parent', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, r.id || '|' || j.value, 'biological', NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.children') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.children', json('null')) WHERE json_valid(info) AND json_type(info, '$.children') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'spouse', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, 'unknown',
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.partners') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.partners', json('null')) WHERE json_valid(info) AND json_type(info, '$.partners') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'sibling', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.siblings') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.siblings', json('null')) WHERE json_valid(info) AND json_type(info, '$.siblings') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'ally', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.allies') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.allies', json('null')) WHERE json_valid(info) AND json_type(info, '$.allies') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'enemy', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.enemies') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.enemies', json('null')) WHERE json_valid(info) AND json_type(info, '$.enemies') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'mentor', CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, 'person', r.id, j.value || '|' || r.id, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.mentors') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.mentors', json('null')) WHERE json_valid(info) AND json_type(info, '$.mentors') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'memberOf', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, r.id || '|' || j.value, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.organizations') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.organizations', json('null')) WHERE json_valid(info) AND json_type(info, '$.organizations') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'relative', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.family') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.family', json('null')) WHERE json_valid(info) AND json_type(info, '$.family') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'friend', 'person', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM people r, json_each(r.info, '$.friends') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE people SET info = json_set(info, '$.friends', json('null')) WHERE json_valid(info) AND json_type(info, '$.friends') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'founded', CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, 'organization', r.id, j.value || '|' || r.id, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.founders') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.founders', json('null')) WHERE json_valid(info) AND json_type(info, '$.founders') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'leads', CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, 'organization', r.id, j.value || '|' || r.id, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.leaders') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.leaders', json('null')) WHERE json_valid(info) AND json_type(info, '$.leaders') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'memberOf', CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, 'organization', r.id, j.value || '|' || r.id, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.notableMembers') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.notableMembers', json('null')) WHERE json_valid(info) AND json_type(info, '$.notableMembers') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'ally', 'organization', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.alliedOrganizations') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.alliedOrganizations', json('null')) WHERE json_valid(info) AND json_type(info, '$.alliedOrganizations') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'rival', 'organization', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, CASE WHEN r.id < j.value THEN r.id || '|' || j.value ELSE j.value || '|' || r.id END, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.rivalOrganizations') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.rivalOrganizations', json('null')) WHERE json_valid(info) AND json_type(info, '$.rivalOrganizations') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'branch', CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, 'organization', r.id, j.value || '|' || r.id, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.parentOrganization') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.parentOrganization', json('null')) WHERE json_valid(info) AND json_type(info, '$.parentOrganization') IN ('array', 'text');
--> statement-breakpoint
INSERT OR IGNORE INTO relations (id, world_id, type, from_kind, from_id, to_kind, to_id, pair_key, parent_kind, spouse_status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), r.world_id, 'branch', 'organization', r.id, CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END, j.value, r.id || '|' || j.value, NULL, NULL,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 + COALESCE(j.key, 0), CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM organizations r, json_each(r.info, '$.subordinateOrganizations') j
  WHERE json_valid(r.info) AND j.type = 'text' AND j.value <> r.id
    AND (CASE
      WHEN EXISTS (SELECT 1 FROM people x WHERE x.id = j.value) THEN 'person'
      WHEN EXISTS (SELECT 1 FROM organizations x WHERE x.id = j.value) THEN 'organization'
      WHEN EXISTS (SELECT 1 FROM territories x WHERE x.id = j.value) THEN 'territory'
      WHEN EXISTS (SELECT 1 FROM articles x WHERE x.id = j.value) THEN 'article'
    END) IS NOT NULL;
--> statement-breakpoint
UPDATE organizations SET info = json_set(info, '$.subordinateOrganizations', json('null')) WHERE json_valid(info) AND json_type(info, '$.subordinateOrganizations') IN ('array', 'text');
