--just an accurate placeholder, you still have to do the real thing, nathan.
CREATE TABLE IF NOT EXISTS pages (
  url_normalized  text PRIMARY KEY,
  content_hash    text,
  raw_content     text,
  public_summary  text,
  status          text CHECK (status IN ('pending', 'processing', 'ready')),
  generated_at    timestamptz,
  hit_count       int DEFAULT 0
);