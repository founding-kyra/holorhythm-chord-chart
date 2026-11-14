-- One row holds the whole shared library (charts, sheets, trash) as JSON.
-- `version` increments on every save so a stale tab can't silently overwrite newer work.
CREATE TABLE IF NOT EXISTS library (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  version INTEGER NOT NULL
);
