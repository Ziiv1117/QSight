CREATE TABLE products (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    revision TEXT NOT NULL DEFAULT 'A',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
);

CREATE TABLE batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_code TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(product_id, batch_code)
);

CREATE TABLE workpieces (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    serial_no TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'REGISTERED',
    created_at TEXT NOT NULL
);

CREATE TABLE inspections (
    id TEXT PRIMARY KEY,
    workpiece_id TEXT NOT NULL REFERENCES workpieces(id),
    model_version_id TEXT,
    view_recipe TEXT NOT NULL,
    expected_view_count INTEGER NOT NULL CHECK(expected_view_count BETWEEN 1 AND 32),
    state TEXT NOT NULL,
    decision TEXT,
    start_at TEXT,
    end_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE inspection_views (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    view_id TEXT NOT NULL,
    view_name TEXT,
    image_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(inspection_id, view_id)
);

CREATE TABLE system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id TEXT REFERENCES inspections(id),
    level TEXT NOT NULL,
    component TEXT NOT NULL,
    event_code TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_inspections_created_at ON inspections(created_at DESC);
CREATE INDEX idx_inspections_state ON inspections(state);
CREATE INDEX idx_inspection_views_inspection ON inspection_views(inspection_id);
CREATE INDEX idx_system_events_inspection ON system_events(inspection_id, created_at);

