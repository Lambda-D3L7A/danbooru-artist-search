<p align="center">
  <img src="build/logo-source.png" alt="Danbooru Artist Search" width="280" />
</p>

# Danbooru Artist Search

[中文](README.md) · English

[![Release](https://img.shields.io/github/v/release/Lambda-D3L7A/danbooru-artist-search?display_name=tag)](https://github.com/Lambda-D3L7A/danbooru-artist-search/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Lambda-D3L7A/danbooru-artist-search/release.yml)](https://github.com/Lambda-D3L7A/danbooru-artist-search/actions)
[![License](https://img.shields.io/github/license/Lambda-D3L7A/danbooru-artist-search)](LICENSE)

An Electron desktop app for **quickly screening Danbooru artists**. Each artist shows representative thumbnails so you can judge style at a glance, then copy the picks straight into [Anima](https://huggingface.co/circlestone-labs/Anima) prompt-tag format (`@artist name`). Opening any thumbnail also reveals the post's full Danbooru tags, categorized, with one-click copy.

Built for prompt engineering with Anima and other Danbooru-tag-trained image models.

---

## Features

### Artist discovery
- **Recent activity**: aggregates artists from Danbooru's newest posts, ordered by most recent activity (default)
- **Search artists**: search by name with **Danbooru autocomplete** (arrow keys / Enter / Esc)
- **Random**: pick random artists for cold-mining
- **By theme tag**: list artists who draw a given theme/character; also has **tag autocomplete** showing post count and category (general / character / copyright / meta)
- **Import list**: paste artist names to pull thumbnails for each

### Main grid
- Responsive cards, **4 representative thumbnails** per artist (ranked by score; Cloudflare bypassed via image proxy)
- **Batch selection**: click anywhere on a card or the checkbox; a footer bar appears
  - **Copy as Anima format**: converts `nnn_yryr` → `@nnn yryr` (lowercase, underscores → spaces, comma-joined)
  - **Add to favorites**: pick or create a group
  - Clear selection
- **Infinite scroll**: more artists load as you scroll down

### Artist page (click an artist name)
- Browse the artist's full catalog in a thumbnail grid + **Load more** button
- Sticky header: favorite, copy as Anima, open on Danbooru
- Returning to the list **restores your scroll position**

### Image lightbox (click a thumbnail)
- Loads the large image (`large_file_url`, ~850 px) with a "loading…" indicator
- **Right-side tags panel** shows the post's Danbooru tags grouped by category:
  - `character` · `copyright` · `artist` · `general` · `meta`
- **Click a chip to copy that single tag** (artist gets `@`-prefixed Anima formatting)
- Footer buttons:
  - **Copy as Anima prompt**: character → copyright → @artist → general → meta, all formatted for Anima
  - **Copy raw**: keeps underscores, useful as a Danbooru search string

### Favorites
- Groups, **alphabetical sort**
- Top **search box** filters in real time
- Each favorite shows **4 thumbnails** (lazy-loaded + cached, click for the lightbox)
- Copy a single group as Anima, or the entire library at once
- Persisted to Electron's `userData` directory

### Polish
- Fixed top bar and selection bar — **never scroll off-screen**
- Independent scroll containers for list / artist page / lightbox
- Click transitions: lightbox fade, panel slide-in, card press feedback, thumbnail hover
- Built-in Danbooru API throttling (≤ 8 req/s) + 429 backoff + friendly 410 message
- Optional Danbooru account API key (numeric UID auto-resolved to username)

---

## Install & run

### Option A: download installer (recommended)

Grab the latest `danbooru-artist-search-x.y.z-setup.exe` from [Releases](https://github.com/Lambda-D3L7A/danbooru-artist-search/releases) and run it.

### Option B: run from source

Requires Node.js ≥ 18.

```bash
git clone https://github.com/Lambda-D3L7A/danbooru-artist-search.git
cd danbooru-artist-search
npm install
npm start
```

#### No-CLI launchers

- Use the desktop shortcut (created by the installer)
- Or double-click `启动.vbs` (silent, no console) / `启动.bat` (with console) inside the project

### API key (optional)

Click the ⚙ icon top-right:

- **Login**: your Danbooru **username** (not the numeric UID; if you enter a UID, the "Test connection" button auto-resolves it)
- **API Key**: generate one from your Danbooru profile page ("Generate API key")

Hit **Test connection** (green = good), then save. Works anonymously without one, just slower.

---

## Workflow

1. Open the app → recent active artists are listed by default
2. Scroll and **check** the ones you like; skip the rest
3. Want to see an artist's full catalog → **click the artist's name**
4. Click a thumbnail for the lightbox → the right panel shows the full Danbooru tags; click any chip to copy it
5. Done picking → click **"Copy as Anima"** at the bottom → paste into your Anima prompt
6. Save selected artists to **favorites** with grouping for next time

---

## Technical notes

- **Electron**: main process handles Danbooru API + local storage (`userData/`); renderer handles UI
- **Image proxy**: Cloudflare on `cdn.donmai.us` blocks browser-UA image requests, so thumbnails and large images are fetched in the main process via a custom `dimg://` protocol using a non-browser UA
- **Rate limiting**: respects Danbooru's 10 req/s read limit with a global ~7.7 req/s gate + 429 retries with backoff + clean 410 messaging
- **Data flow**: tags.json (artist list) → posts.json per artist (thumbnails + full tag fields) → IPC → renderer grid

## Project layout

```
main.js              Main process: Danbooru API, image proxy, IPC, storage
preload.js           IPC bridge (contextBridge)
renderer/
  index.html         UI structure
  styles.css         Styling
  renderer.js        Interactions: sources / search / grid / favorites / artist page / lightbox
build/
  icon.png / icon.ico  App icon
.github/workflows/
  release.yml        CI: build + publish on tag push
启动.vbs / 启动.bat   Quick-launch scripts
```

## Development & release

```bash
# Dev
npm start

# Local packaging (no publish)
npm run pack      # produces dist/win-unpacked only
npm run dist      # produces a full NSIS installer

# Cut a release
# 1. Add a section to the top of CHANGELOG.md
# 2. Bump version
npm version 0.1.x --no-git-tag-version
# 3. Commit & tag
git add . && git commit -m "Release v0.1.x"
git tag v0.1.x
git push && git push origin v0.1.x
# CI builds and publishes a GitHub Release automatically
```

See [CHANGELOG.md](CHANGELOG.md) for history.

## License

[MIT](LICENSE)
