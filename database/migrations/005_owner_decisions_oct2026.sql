-- ===========================================
-- MIGRATION 005 — Owner decisions of 24–28 Oct 2026
-- ===========================================
-- Source: PM-DEC-002 v1.1 and PM-Decision-Log v1.2 (Google Drive / Decision_Log).
--   DEC-001  Free delivery from XCG 100 (>=, after discounts, before delivery);
--            otherwise near zone XCG 10, far zone XCG 20; unknown zone = "to be
--            confirmed by WhatsApp", never charged automatically.
--   DEC-003  Panties: no voluntary exchange for hygiene; defects, damage and wrong
--            delivery always accepted; no period shown as a legal limit.
--   DEC-004  Pickup exists but stays hidden until details are authorised.
--   DEC-005  Returns text for bras, shapewear, perfume, beauty: not published yet.
--   DEC-013  (PROPOSED, safe default) launch with cash on delivery + MCB transfer;
--            Sentoo hidden.
--   DEC-016  Delivery usually next day, according to the route.
--   DEC-006  (OPEN) exact neighbourhood list per zone — stored as editable data.
-- Owner can change every value afterwards in Admin → Settings / Zones.
-- ===========================================

INSERT INTO settings (key, value, updated_at) VALUES
    ('free_delivery_threshold', '100', NOW()),
    ('free_delivery_rule',      '"gte"', NOW()),
    ('pickup_enabled',          'false', NOW()),
    ('payment_methods',         '["cod","bank_transfer"]', NOW()),
    ('return_policy',           '{"panties":"For hygiene reasons panties cannot be exchanged voluntarily. Defective, damaged or wrongly delivered items are always accepted — contact us on WhatsApp.","default":null}', NOW()),
    ('pending_approval',        '["zones","payment_methods","bank_details","support_whatsapp","return_policy","delivery_cutoff_hour","payment_expiry_minutes","slots"]', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Retire the 3 zones at 5/10/25 (rejected in DEC-001). Kept, not deleted: old orders reference them.
UPDATE delivery_zones SET is_active = FALSE, updated_at = NOW()
 WHERE slug NOT IN ('near', 'far');

-- No polygons yet (DEC-006 open): the zone is matched by neighbourhood name,
-- anything else is "to be confirmed by WhatsApp".
INSERT INTO delivery_zones (slug, name, fee, free_threshold, estimated_days, color, sort_order, is_active, polygon, neighborhoods) VALUES
('near', 'Near zone', 10, NULL, 'Usually next day', '#27ae60', 1, TRUE, NULL,
 '[{"name":"Santa Maria","desc":"Santa María and surroundings"}]'::jsonb),
('far',  'Far zone',  20, NULL, 'Usually next day', '#e67e22', 2, TRUE, NULL,
 '[{"name":"Montaña","desc":""},{"name":"Punta","desc":""},{"name":"Suaz","desc":""}]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    fee = EXCLUDED.fee,
    free_threshold = NULL,
    estimated_days = EXCLUDED.estimated_days,
    is_active = TRUE,
    updated_at = NOW();
