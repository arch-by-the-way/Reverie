# Project Overview: Browser Extension for Instant Website Summaries

## 1. What It Is

A browser extension (Manifest V3) that gives the user a concise, relevant summary of the currently open website with a single click — without needing to open a separate web service. The product's core value is **speed** (an almost instant response thanks to a public cache) and **freshness** (the summary is only recomputed when the page's content has actually changed).

The MVP platform is desktop browsers (Chrome/Edge/Firefox). A mobile version (a native Android app, later iOS) is a separate feature outside the MVP scope, since extensions don't work in mobile browsers.

There is optionally a website that reads from the same DB — for users who prefer not to install the extension; it can also show the history of processed pages.

## 2. Architecture Components

```
┌──────────────────────────────────────────────────┐
│                Browser Extension                 │
│                                                  │
│                                                  │
│ Content script                                   │
│   - extracts the page's main text content        │
│     (not the whole DOM, just the                 │
│     "readability" zone: article/main block)      │
│   - computes a fast local hash of it             │
│                                                  │
│ Background service worker                        │
│   - sends (url_normalized, content_hash,         │
│     extracted_text) to the backend               │
│                                                  │
│ Popup UI                                         │
│   - shows the summary; spinner while             │
│     recomputing                                  │
└──────────────────────────────────────────────────┘
                          │
                        HTTPS
                          ▼
┌──────────────────────────────────────────────────┐
│             Backend (Node.js, REST)              │
│                                                  │
│                                                  │
│ POST /check                                      │
│ 1. Normalizes the URL (strips utm/ref/           │
│    fbclid and other tracking params)             │
│ 2. Looks up a record in pages by                 │
│    url_normalized                                │
│ 3a. No record, or hash differs ->                │
│     calls the LLM, updates the record            │
│ 3b. Hash matches -> returns the cached           │
│     summary, no model call                       │
└──────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────────┐
│   Neon (Postgres)   │   │     Open-source LLM     │
│                     │   │                         │
│ table: pages        │   │ (hosted inference API:  │
│ - public cache of   │   │  Groq / Together /      │
│   summaries         │   │  Fireworks, etc.)       │
└─────────────────────┘   └─────────────────────────┘
           ▲
           | (optionally reads the same data)
┌─────────────────────────┐
│         Website         │
│                         │
│ history of processed    │
│ pages, for users who    │
│ don't use the extension │
└─────────────────────────┘
```

## 3. Data Flow

**First visit to a URL (cache miss):**
1. The content script extracts the main content text and computes a hash.
2. The background worker sends `{url_normalized, content_hash, extracted_text}` to `POST /check`.
3. The backend finds no record for `url_normalized` → calls the LLM with `extracted_text` and gets a summary.
4. The backend writes to `pages`: `content_hash`, `public_summary`, `status='ready'`, `generated_at=now()`.
5. The popup shows the summary.

**Nth visit, content unchanged (cache hit):**
1. The content script again extracts the text and computes the hash.
2. The backend finds the record and compares `content_hash` — it matches.
3. It returns the `public_summary` from the DB — **the LLM is not called**.
4. `hit_count` is incremented (a metric for the demo).

**Nth visit, content changed:**
1. The hash doesn't match the stored one.
2. The backend calls the LLM again and updates `content_hash`, `public_summary`, `generated_at`.
3. All subsequent users get this new summary until the content changes again.

Important: extracting the content (`extracted_text`) is done by the **content script in the user's browser**, not by the backend via a separate `fetch()` — this is more reliable for SPA/JS-rendered sites and doesn't depend on whether the content is visible to an anonymous server-side request (for example, if part of the content requires the user to be logged in in the browser).

## 4. Data Model

```sql
pages (
  url_normalized  text primary key,
  content_hash    text not null,
  raw_content     text,           -- raw extracted_text, kept separate from the summary
  public_summary  text,
  status          text check (status in ('pending','processing','ready')),
  generated_at    timestamptz,
  hit_count       int default 0
)
```

`raw_content` is stored separately from `public_summary` intentionally — once you get to personalized summaries, you won't need to re-extract the content from the page: the personalized prompt just takes the already-saved `raw_content` and generates a different output for that specific user, without hitting the site again.

## 5. Bottlenecks and Open Risks

**Content extraction on SPA/dynamic sites.** The content script may run before the JS framework has finished rendering the content (React/Vue with lazy loading, infinite scroll) — in that case both the hash and the summary will be built on incomplete content. A waiting strategy is needed (e.g., a `MutationObserver` with debounce before taking the hash); otherwise some sites will produce irrelevant summaries with no explicit error — a silent bug that's hard to catch by eye.

**Noise in the hash from irrelevant elements.** If the hash is computed over all visible text on the page rather than just the "main" block (the readability zone), then a change to an ad banner, an online-user counter, or a "related articles" block will trigger a full summary recompute even though the article itself hasn't changed. This isn't just an inaccuracy — it's a direct hit to the cache's economics: pages with "noisy" sidebar blocks effectively lose the caching benefit and will be recomputed on almost every visit.

**No floor on recompute frequency.** If a page comes up whose content keeps changing through no fault of yours (a stock ticker, a live score, an "N users online now" counter), hash-based invalidation will recompute the summary on almost every visit — the cache stops working exactly for the pages under the heaviest load. It's worth adding a minimum TTL (e.g., "no more than once every 5 minutes per URL," even if the hash differs) as a protective floor on top of the main hash-based logic.

**Race condition on simultaneous first visits to the same URL.** Two users landing on a not-yet-cached page at nearly the same time will both see a cache miss and both call the LLM in parallel — double the cost and a potential race on the DB write (with `url_normalized` as a unique key, the second `INSERT` can conflict with the first). This is deliberately left unsolved — flagged as a known, non-blocking risk for the MVP.

**Public summaries as the default model.** The cache is shared across all users — which is right for speed and cost, but it means that if a page's content is visible only to the author of that particular browsing session (e.g., a page behind a login/paywall, a personalized feed), its content effectively becomes visible to all subsequent users who request the same `url_normalized` through the public `public_summary`. For an MVP on public news/informational sites this isn't a problem, but it's worth explicitly deciding: either don't cache pages that require authentication (detected via HTTP status/pattern), or explicitly restrict the product to public content only.

**Single point of failure.** One backend + one DB (Neon), with no redundancy — a standard risk for a hackathon project, but worth stating explicitly: if Neon is unavailable or the backend goes down, the extension should degrade predictably (e.g., show "couldn't get a summary" instead of a spinner stuck forever), not fail silently.

**Manifest V3 background service worker limitations.** The MV3 service worker is event-driven and can be unloaded by the browser between events; you can't rely on long-lived in-memory state in the background script (e.g., waiting for a backend response in a variable that might disappear when the worker is unloaded). The logic needs to be built so that every request is self-contained and doesn't depend on state that survived from a previous invocation.

**Legal risk of publicly aggregating content.** Since one user's summary becomes visible to everyone else for the same URL, this is closer to republishing content than to personal use — some sites explicitly prohibit automated extraction and redistribution of content in their ToS. Not an architectural risk, but an operational one — worth keeping in mind when choosing which sites to demo at the hackathon.