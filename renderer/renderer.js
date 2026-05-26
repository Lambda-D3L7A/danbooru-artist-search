const $ = (id) => document.getElementById(id);

const state = {
  source: 'recent',
  sort: 'count',
  query: '',
  page: 1,
  perPage: 20,
  artists: [],
  posts: [],
  selected: new Set(),
  favorites: { groups: ['默认'], items: [] },
  pendingFavNames: [],
  artist: { name: null, page: 1 },
  suggest: { items: [], active: -1 },
  listScroll: 0,
  favQuery: '',
  lightboxSample: null,
};

// ---- format helpers ----
const displayName = (name) => name.replace(/_/g, ' ');
const toAnima = (name) => '@' + name.replace(/_/g, ' ').toLowerCase();
// CDN blocks browser-UA requests; route images through the main-process proxy.
const proxied = (url) => 'dimg://fetch/?u=' + encodeURIComponent(url);

function setStatus(msg) {
  $('status').textContent = msg || '';
}

let toastTimer = null;
function showToast(text, kind) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (kind ? ' ' + kind : ' success');
  el.textContent = text;
  // restart entry animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (el && el.parentNode) el.remove(); }, 1500);
}

// ---- load + render grid (infinite scroll) ----
const cardEls = new Map();
const postEls = new Map();
let loading = false;
let reachedEnd = false;

function isPostMode() {
  return state.source === 'theme';
}

function pagePerSize() {
  return isPostMode() ? 40 : state.perPage;
}

async function load() {
  if (!$('artistView').classList.contains('hidden')) closeArtist();
  state.artists = [];
  state.posts = [];
  reachedEnd = false;
  clearGrid();
  updateGridVisibility();
  $('listView').scrollTop = 0;
  await fetchPage(false);
}

function clearGrid() {
  $('grid').innerHTML = '';
  $('postsGrid').innerHTML = '';
  cardEls.clear();
  postEls.clear();
}

function updateGridVisibility() {
  $('grid').classList.toggle('hidden', isPostMode());
  $('postsGrid').classList.toggle('hidden', !isPostMode());
  updateSelectionBar();
}

async function fetchPage(append) {
  if (loading || (append && reachedEnd)) return;
  loading = true;
  const page = append ? state.page + 1 : 1;
  const perPage = pagePerSize();
  setStatus(append ? '加载更多…' : '加载中…');
  try {
    const items = await window.api.getArtists({
      source: state.source,
      sort: state.sort,
      query: state.query,
      page,
      perPage,
      sampleCount: 4,
    });
    state.page = page;
    const raw = items ? items.length : 0;
    if (isPostMode()) {
      const fresh = (items || []).filter((p) => p.postId && !postEls.has(p.postId));
      state.posts.push(...fresh);
      appendPosts(fresh);
    } else {
      const fresh = (items || []).filter((a) => !cardEls.has(a.name));
      state.artists.push(...fresh);
      appendCards(fresh);
    }
    if (raw === 0) reachedEnd = true;
    else if (state.source !== 'random' && state.source !== 'recent' && raw < perPage) reachedEnd = true;
    const count = isPostMode() ? state.posts.length : state.artists.length;
    const unit = isPostMode() ? '张作品' : '位画师';
    setStatus(count ? `已加载 ${count} ${unit}${reachedEnd ? '（已全部）' : ''}` : '没有结果');
    setTimeout(checkFill, 60);
  } catch (e) {
    setStatus('加载失败：' + e.message);
  } finally {
    loading = false;
  }
}

function loadMore() {
  fetchPage(true);
}

function appendCards(artists) {
  const grid = $('grid');
  for (const a of artists) grid.appendChild(renderCard(a));
  updateSelectionBar();
}

function appendPosts(posts) {
  const g = $('postsGrid');
  for (const p of posts) {
    if (!p.postId) continue;
    const cell = renderPostCell(p);
    g.appendChild(cell);
    postEls.set(p.postId, cell);
  }
}

function renderPostCell(p) {
  const cell = document.createElement('div');
  cell.className = 'pcell';
  if (p.thumb) {
    const img = document.createElement('img');
    img.src = proxied(p.thumb);
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(p));
    cell.appendChild(img);
  } else {
    cell.classList.add('empty');
  }
  return cell;
}

function refreshStars() {
  for (const [name, refs] of cardEls) refs.star.classList.toggle('on', isFav(name));
}

function onScroll() {
  if (loading || reachedEnd) return;
  const el = $('listView');
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 700) loadMore();
}

function checkFill() {
  if (loading || reachedEnd) return;
  const el = $('listView');
  if (el.scrollHeight <= el.clientHeight + 100) loadMore();
}

function renderCard(artist) {
  const card = document.createElement('div');
  card.className = 'card' + (state.selected.has(artist.name) ? ' selected' : '');

  const head = document.createElement('div');
  head.className = 'card-head';

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'card-check';
  check.checked = state.selected.has(artist.name);

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = displayName(artist.name);
  name.title = '查看 ' + displayName(artist.name) + ' 的全部作品';
  name.addEventListener('click', (e) => { e.stopPropagation(); openArtist(artist.name); });

  const count = document.createElement('div');
  count.className = 'card-count';
  if (artist.postCount != null) count.textContent = artist.postCount;
  else if (artist.themeCount != null) count.textContent = '×' + artist.themeCount;

  const star = document.createElement('div');
  star.className = 'card-star' + (isFav(artist.name) ? ' on' : '');
  star.textContent = '★';
  star.title = '收藏';

  const link = document.createElement('div');
  link.className = 'card-link';
  link.textContent = '↗';
  link.title = '在 Danbooru 打开';

  head.append(check, name, count, star, link);

  const thumbs = document.createElement('div');
  thumbs.className = 'thumbs';
  const samples = artist.samples || [];
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement('div');
    cell.className = 'thumb';
    const s = samples[i];
    if (s && s.thumb) {
      const img = document.createElement('img');
      img.src = proxied(s.thumb);
      img.loading = 'lazy';
      img.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openLightbox(s);
      });
      cell.appendChild(img);
    } else {
      cell.classList.add('empty');
    }
    thumbs.appendChild(cell);
  }

  // interactions
  card.addEventListener('click', () => toggleSelect(artist.name));
  check.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect(artist.name); });
  star.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(artist.name); star.classList.toggle('on', isFav(artist.name)); });
  link.addEventListener('click', (e) => {
    e.stopPropagation();
    window.api.openExternal(`https://danbooru.donmai.us/posts?tags=${encodeURIComponent(artist.name)}`);
  });

  card.append(head, thumbs);
  cardEls.set(artist.name, { card, check, star });
  return card;
}

// ---- selection ----
function toggleSelect(name) {
  const sel = state.selected;
  if (sel.has(name)) sel.delete(name);
  else sel.add(name);
  const refs = cardEls.get(name);
  if (refs) {
    refs.card.classList.toggle('selected', sel.has(name));
    refs.check.checked = sel.has(name);
  }
  updateSelectionBar();
}

function updateSelectionBar() {
  const n = state.selected.size;
  $('selCount').textContent = n;
  $('selectionBar').classList.toggle('hidden', n === 0 || isPostMode());
}

// ---- copy ----
async function copyAnima(names) {
  if (!names.length) return;
  const text = names.map(toAnima).join(', ');
  await window.api.copy(text);
  showToast(`✓ 已复制 ${names.length} 位画师`);
}

// ---- favorites ----
function isFav(name) {
  return state.favorites.items.some((it) => it.name === name);
}
function toggleFav(name) {
  if (isFav(name)) {
    state.favorites.items = state.favorites.items.filter((it) => it.name !== name);
    saveFav();
  } else {
    openGroupModal([name]);
  }
}
function addToGroup(names, group) {
  if (!state.favorites.groups.includes(group)) state.favorites.groups.push(group);
  for (const name of names) {
    if (!isFav(name)) state.favorites.items.push({ name, group });
  }
  saveFav();
}
async function saveFav() {
  await window.api.storeSet('favorites', state.favorites);
  renderFavCount();
  renderFavPanel();
  refreshStars();
  if (state.artist.name && !$('artistView').classList.contains('hidden')) updateArtistStar();
}
function renderFavCount() {
  $('favCount').textContent = state.favorites.items.length;
}
function renderFavPanel() {
  const list = $('favList');
  list.innerHTML = '';
  const q = (state.favQuery || '').trim().toLowerCase();
  const byGroup = new Map();
  for (const g of state.favorites.groups) byGroup.set(g, []);
  for (const it of state.favorites.items) {
    if (q && !displayName(it.name).toLowerCase().includes(q)) continue;
    if (!byGroup.has(it.group)) byGroup.set(it.group, []);
    byGroup.get(it.group).push(it.name);
  }
  let shown = 0;
  for (const [group, names] of byGroup) {
    if (!names.length) continue;
    names.sort((a, b) => displayName(a).localeCompare(displayName(b)));
    shown += names.length;
    const wrap = document.createElement('div');
    wrap.className = 'fav-group';
    const gh = document.createElement('div');
    gh.className = 'fav-group-head';
    const title = document.createElement('span');
    title.textContent = `${group} (${names.length})`;
    const copyG = document.createElement('button');
    copyG.className = 'small';
    copyG.textContent = '复制';
    copyG.addEventListener('click', () => copyAnima(names));
    gh.append(title, copyG);
    wrap.appendChild(gh);
    for (const name of names) wrap.appendChild(renderFavItem(name));
    list.appendChild(wrap);
  }
  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = q ? '没有匹配的收藏' : '还没有收藏画师';
    list.appendChild(empty);
  }
}

function renderFavItem(name) {
  const item = document.createElement('div');
  item.className = 'fav-item';

  const top = document.createElement('div');
  top.className = 'fav-item-top';
  const sp = document.createElement('span');
  sp.className = 'fav-name';
  sp.textContent = displayName(name);
  sp.title = '查看 ' + displayName(name) + ' 的全部作品';
  sp.addEventListener('click', () => {
    $('favPanel').classList.add('hidden');
    openArtist(name);
  });
  const rm = document.createElement('button');
  rm.textContent = '✕';
  rm.addEventListener('click', () => {
    state.favorites.items = state.favorites.items.filter((it) => it.name !== name);
    saveFav();
  });
  top.append(sp, rm);

  const thumbs = document.createElement('div');
  thumbs.className = 'fav-thumbs';
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement('div');
    cell.className = 'fav-thumb';
    thumbs.appendChild(cell);
  }
  item.append(top, thumbs);
  fillFavThumbs(name, thumbs);
  return item;
}

const favSampleCache = new Map();
async function fillFavThumbs(name, container) {
  let samples = favSampleCache.get(name);
  if (!samples) {
    try {
      samples = await window.api.getArtistPosts({ name, page: 1, limit: 4 });
    } catch {
      samples = [];
    }
    favSampleCache.set(name, samples);
  }
  const cells = container.children;
  for (let i = 0; i < cells.length; i++) {
    const s = samples[i];
    if (s && s.thumb) {
      const img = document.createElement('img');
      img.src = proxied(s.thumb);
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(s));
      cells[i].innerHTML = '';
      cells[i].appendChild(img);
    }
  }
}

// ---- group modal ----
function openGroupModal(names) {
  state.pendingFavNames = names;
  const sel = $('groupSelect');
  sel.innerHTML = '';
  for (const g of state.favorites.groups) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    sel.appendChild(opt);
  }
  $('newGroupInput').value = '';
  $('groupModal').classList.remove('hidden');
}

// ---- search autocomplete ----
let suggestTimer = null;
function scheduleSuggest() {
  clearTimeout(suggestTimer);
  const q = $('query').value.trim();
  const eligible = state.source === 'search' || state.source === 'theme';
  if (!eligible || q.length < 1) {
    hideSuggest();
    return;
  }
  suggestTimer = setTimeout(() => fetchSuggest(q), 250);
}

async function fetchSuggest(q) {
  try {
    const type = state.source === 'theme' ? 'tag_query' : 'artist';
    const items = await window.api.autocomplete(q, type);
    if ($('query').value.trim() !== q) return; // stale
    state.suggest = { items, active: -1 };
    renderSuggest();
  } catch {
    hideSuggest();
  }
}

const TAG_CAT = { 0: 'gen', 1: 'artist', 3: 'copy', 4: 'char', 5: 'meta' };

function renderSuggest() {
  const box = $('suggest');
  const { items, active } = state.suggest;
  box.innerHTML = '';
  if (!items.length) {
    hideSuggest();
    return;
  }
  items.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 'suggest-item' + (i === active ? ' active' : '');
    const left = document.createElement('span');
    left.className = 'suggest-label';
    left.textContent = it.label;
    d.appendChild(left);
    const metaParts = [];
    if (it.category != null && TAG_CAT[it.category]) metaParts.push(TAG_CAT[it.category]);
    if (it.postCount != null) metaParts.push(it.postCount.toLocaleString());
    if (metaParts.length) {
      const right = document.createElement('span');
      right.className = 'suggest-meta cat-' + (TAG_CAT[it.category] || 'x');
      right.textContent = metaParts.join(' · ');
      d.appendChild(right);
    }
    d.addEventListener('mousedown', (e) => { e.preventDefault(); selectSuggest(it.label); });
    box.appendChild(d);
  });
  box.classList.remove('hidden');
}

function hideSuggest() {
  $('suggest').classList.add('hidden');
  state.suggest.active = -1;
}

function selectSuggest(label) {
  $('query').value = label;
  state.query = label;
  hideSuggest();
  state.page = 1;
  load();
}

// ---- artist detail view (all works) ----
async function openArtist(name) {
  state.listScroll = $('listView').scrollTop;
  state.artist = { name, page: 1 };
  $('artistTitle').textContent = displayName(name);
  $('artistTitle').title = displayName(name);
  $('artistPosts').innerHTML = '';
  updateArtistStar();
  $('listView').classList.add('hidden');
  $('selectionBar').classList.add('hidden');
  $('artistView').classList.remove('hidden');
  $('artistView').scrollTop = 0;
  // reset download UI unless this artist is the one currently downloading
  if (!activeDownload || activeDownload.name !== name) {
    $('artistDownload').classList.remove('hidden');
    $('artistDataset').classList.remove('hidden');
    $('artistDownloadStatus').classList.add('hidden');
    $('artistDownloadCancel').classList.add('hidden');
  }
  await loadArtistPosts();
}

function closeArtist() {
  $('artistView').classList.add('hidden');
  $('listView').classList.remove('hidden');
  updateSelectionBar();
  $('listView').scrollTop = state.listScroll || 0;
}

async function loadArtistPosts() {
  const s = $('artistStatus');
  const more = $('artistMore');
  s.textContent = '加载中…';
  more.disabled = true;
  try {
    const posts = await window.api.getArtistPosts({ name: state.artist.name, page: state.artist.page, limit: 40 });
    renderArtistPosts(posts);
    if (!posts.length) {
      s.textContent = state.artist.page === 1 ? '没有作品' : '没有更多了';
      more.classList.add('hidden');
    } else {
      s.textContent = '';
      more.classList.remove('hidden');
    }
  } catch (e) {
    s.textContent = '加载失败：' + e.message;
  } finally {
    more.disabled = false;
  }
}

function renderArtistPosts(posts) {
  const g = $('artistPosts');
  for (const p of posts) {
    const cell = document.createElement('div');
    cell.className = 'pcell';
    if (p.thumb) {
      const img = document.createElement('img');
      img.src = proxied(p.thumb);
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(p));
      cell.appendChild(img);
    } else {
      cell.classList.add('empty');
    }
    g.appendChild(cell);
  }
}

// ---- download all artist works ----
let activeDownload = null;

async function startArtistDownload(mode) {
  if (!state.artist.name) return;
  if (activeDownload) {
    setStatus(`另一个下载进行中（${activeDownload.name}），请等待完成或取消`);
    return;
  }
  const dir = await window.api.pickFolder();
  if (!dir) return;
  activeDownload = { name: state.artist.name, mode: mode || 'images' };
  $('artistDownload').classList.add('hidden');
  $('artistDataset').classList.add('hidden');
  const s = $('artistDownloadStatus');
  s.className = 'dl-status';
  s.classList.remove('hidden');
  s.textContent = mode === 'dataset' ? '准备数据集…' : '准备中…';
  $('artistDownloadCancel').classList.remove('hidden');
  window.api.downloadStart({ name: state.artist.name, parentDir: dir, mode: mode || 'images' });
}

function onDownloadProgress(p) {
  if (!activeDownload || p.name !== activeDownload.name) return;
  const s = $('artistDownloadStatus');
  const ds = p.mode === 'dataset' ? '数据集' : '';
  if (p.status === 'enumerating') {
    s.textContent = `${ds ? '准备' + ds : '准备中'}… 已发现 ${p.total} 张`;
  } else if (p.status === 'downloading') {
    s.textContent = `${ds ? ds + '下载中' : '下载中'} ${p.current}/${p.total}`;
  } else if (p.status === 'done') {
    s.className = 'dl-status done';
    const extra = [];
    if (p.errors) extra.push(`失败 ${p.errors}`);
    if (p.skipped) extra.push(`跳过 ${p.skipped}`);
    s.textContent = `✓ ${ds || ''}完成 ${p.current}/${p.total}` + (extra.length ? ` (${extra.join('，')})` : '');
    finishDownloadUI();
  } else if (p.status === 'cancelled') {
    s.className = 'dl-status err';
    s.textContent = `已取消 ${p.current}/${p.total}`;
    finishDownloadUI();
  } else if (p.status === 'error') {
    s.className = 'dl-status err';
    s.textContent = '失败：' + (p.error || '未知错误');
    finishDownloadUI();
  }
}

function finishDownloadUI() {
  activeDownload = null;
  $('artistDownloadCancel').classList.add('hidden');
  setTimeout(() => {
    $('artistDownload').classList.remove('hidden');
    $('artistDataset').classList.remove('hidden');
    $('artistDownloadStatus').classList.add('hidden');
  }, 4000);
}

function updateArtistStar() {
  const btn = $('artistStar');
  const on = isFav(state.artist.name);
  btn.classList.toggle('artist-star', true);
  btn.classList.toggle('on', on);
  btn.textContent = on ? '★ 已收藏' : '★ 收藏';
}

// ---- lightbox ----
function openLightbox(sample) {
  const isObj = sample && typeof sample === 'object';
  const src = isObj ? (sample.large || sample.thumb) : sample;
  state.lightboxSample = isObj ? sample : null;
  const box = $('lightbox');
  const img = $('lightboxImg');
  box.classList.add('loading');
  img.onload = () => box.classList.remove('loading');
  img.onerror = () => box.classList.remove('loading');
  img.src = proxied(src);
  if (isObj && hasAnyTags(sample)) {
    renderLightboxTags(sample);
    $('lightboxTags').classList.remove('hidden');
  } else {
    $('lightboxTags').classList.add('hidden');
  }
  box.classList.remove('hidden');
}

function hasAnyTags(s) {
  return ['tagsGeneral', 'tagsCharacter', 'tagsCopyright', 'tagsArtist', 'tagsMeta']
    .some((k) => s[k] && s[k].length);
}

function ratingLabel(r) {
  return ({ s: 'safe', g: 'general', q: 'questionable', e: 'explicit', sensitive: 'sensitive' })[r] || r || '';
}

function renderLightboxTags(s) {
  $('ltRating').textContent = s.rating ? 'rating: ' + ratingLabel(s.rating) : '';
  const link = $('ltPost');
  if (s.pageUrl) {
    link.style.display = '';
    link.dataset.url = s.pageUrl;
  } else {
    link.style.display = 'none';
  }
  const sections = $('ltSections');
  sections.innerHTML = '';
  const groups = [
    { key: 'tagsCharacter', label: 'character' },
    { key: 'tagsCopyright', label: 'copyright' },
    { key: 'tagsArtist', label: 'artist', isArtist: true },
    { key: 'tagsGeneral', label: 'general' },
    { key: 'tagsMeta', label: 'meta' },
  ];
  for (const g of groups) {
    const tags = s[g.key] || [];
    if (!tags.length) continue;
    const sec = document.createElement('div');
    sec.className = 'lt-section';
    const head = document.createElement('div');
    head.className = 'lt-section-head';
    head.textContent = `${g.label} · ${tags.length}`;
    sec.appendChild(head);
    for (const t of tags) {
      const chip = document.createElement('span');
      chip.className = 'lt-chip' + (g.isArtist ? ' artist' : '');
      const display = displayName(t);
      chip.textContent = g.isArtist ? '@' + display : display;
      chip.title = '点击复制';
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTagText(t, g.isArtist);
      });
      // (the chip's click handler above already shows a toast via copyTagText)
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const items = g.isArtist
          ? [
              { label: '复制为 @' + displayName(t), action: () => copyTagText(t, true) },
              { label: '进入画师主页', action: () => { $('lightbox').classList.add('hidden'); openArtist(t); } },
            ]
          : [
              { label: '复制 ' + displayName(t), action: () => copyTagText(t, false) },
              { label: '搜索此 tag 的作品', action: () => searchTagAsTheme(t) },
            ];
        showContextMenu(e.clientX, e.clientY, items);
      });
      sec.appendChild(chip);
    }
    sections.appendChild(sec);
  }
}

// ---- context menu ----
let activeCtxMenu = null;
function showContextMenu(x, y, items) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'ctx-item';
    row.textContent = it.label;
    row.addEventListener('click', () => {
      it.action();
      closeContextMenu();
    });
    menu.appendChild(row);
  }
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);
  // adjust so menu stays in viewport
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 4);
  const top = Math.min(y, window.innerHeight - rect.height - 4);
  menu.style.left = Math.max(4, left) + 'px';
  menu.style.top = Math.max(4, top) + 'px';
  menu.style.visibility = '';
  activeCtxMenu = menu;
  setTimeout(() => {
    document.addEventListener('mousedown', onCtxOutside, true);
    document.addEventListener('keydown', onCtxKey, true);
    window.addEventListener('blur', closeContextMenu, { once: true });
  }, 0);
}
function onCtxOutside(e) {
  if (activeCtxMenu && !activeCtxMenu.contains(e.target)) closeContextMenu();
}
function onCtxKey(e) {
  if (e.key === 'Escape') closeContextMenu();
}
function closeContextMenu() {
  if (!activeCtxMenu) return;
  activeCtxMenu.remove();
  activeCtxMenu = null;
  document.removeEventListener('mousedown', onCtxOutside, true);
  document.removeEventListener('keydown', onCtxKey, true);
}

function copyTagText(t, isArtist) {
  const text = isArtist ? toAnima(t) : displayName(t).toLowerCase();
  window.api.copy(text);
  showToast('✓ 已复制：' + text);
}

function searchTagAsTheme(t) {
  $('lightbox').classList.add('hidden');
  state.source = 'theme';
  $('source').value = 'theme';
  $('sort').disabled = true;
  $('query').placeholder = '题材/角色 tag，例：1girl';
  hideSuggest();
  state.query = displayName(t);
  $('query').value = state.query;
  updateGridVisibility();
  load();
}

function buildAnima(s) {
  const f = (t) => displayName(t).toLowerCase();
  const parts = [];
  for (const t of s.tagsCharacter || []) parts.push(f(t));
  for (const t of s.tagsCopyright || []) parts.push(f(t));
  for (const t of s.tagsArtist || []) parts.push(toAnima(t));
  for (const t of s.tagsGeneral || []) parts.push(f(t));
  for (const t of s.tagsMeta || []) parts.push(f(t));
  return parts.join(', ');
}

function buildPlain(s) {
  return [
    ...(s.tagsCharacter || []),
    ...(s.tagsCopyright || []),
    ...(s.tagsArtist || []),
    ...(s.tagsGeneral || []),
    ...(s.tagsMeta || []),
  ].join(', ');
}

// ---- settings ----
async function loadSettings() {
  const s = await window.api.storeGet('settings', {});
  $('loginInput').value = s.login || '';
  $('apiKeyInput').value = s.apiKey || '';
}

// ---- wire up ----
function bind() {
  $('source').addEventListener('change', (e) => {
    state.source = e.target.value;
    $('sort').disabled = state.source !== 'search';
    const q = $('query');
    if (state.source === 'search') q.placeholder = '输入画师名搜索';
    else if (state.source === 'theme') q.placeholder = '题材/角色 tag，例：1girl';
    else if (state.source === 'import') q.placeholder = '粘贴画师名，逗号或换行分隔';
    else if (state.source === 'random') q.placeholder = '（随机模式无需输入）';
    else q.placeholder = '（最近更新，无需输入）';
    hideSuggest();
    updateGridVisibility();
  });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; });
  $('query').addEventListener('input', (e) => { state.query = e.target.value; scheduleSuggest(); });
  $('query').addEventListener('focus', () => { if (state.suggest.items.length) renderSuggest(); });
  $('query').addEventListener('blur', () => setTimeout(hideSuggest, 150));
  $('query').addEventListener('keydown', (e) => {
    const open = !$('suggest').classList.contains('hidden');
    const items = state.suggest.items;
    if (open && items.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.suggest.active = (state.suggest.active + 1) % items.length;
        renderSuggest();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.suggest.active = (state.suggest.active - 1 + items.length) % items.length;
        renderSuggest();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const a = state.suggest.active;
        selectSuggest(a >= 0 ? items[a].label : $('query').value);
        return;
      }
      if (e.key === 'Escape') {
        hideSuggest();
        return;
      }
    }
    if (e.key === 'Enter') { state.page = 1; load(); }
  });
  $('loadBtn').addEventListener('click', () => { state.page = 1; load(); });

  $('listView').addEventListener('scroll', onScroll);

  $('copyBtn').addEventListener('click', () => copyAnima([...state.selected]));
  $('favSelBtn').addEventListener('click', () => { if (state.selected.size) openGroupModal([...state.selected]); });
  $('clearSelBtn').addEventListener('click', () => {
    state.selected.clear();
    for (const refs of cardEls.values()) { refs.card.classList.remove('selected'); refs.check.checked = false; }
    updateSelectionBar();
  });

  $('favBtn').addEventListener('click', () => { renderFavPanel(); $('favPanel').classList.remove('hidden'); });
  $('favCloseBtn').addEventListener('click', () => $('favPanel').classList.add('hidden'));
  $('copyAllFavBtn').addEventListener('click', () => copyAnima(state.favorites.items.map((it) => it.name)));
  $('favSearch').addEventListener('input', (e) => { state.favQuery = e.target.value; renderFavPanel(); });

  $('settingsBtn').addEventListener('click', () => {
    $('keyTestResult').textContent = '';
    $('keyTestResult').className = 'key-result';
    $('settingsModal').classList.remove('hidden');
  });
  $('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
  $('testKeyBtn').addEventListener('click', async () => {
    const r = $('keyTestResult');
    r.className = 'key-result';
    r.textContent = '测试中…';
    const res = await window.api.testAuth({
      login: $('loginInput').value.trim(),
      apiKey: $('apiKeyInput').value.trim(),
    });
    if (res.resolvedLogin) $('loginInput').value = res.resolvedLogin; // UID -> username
    if (res.ok) {
      r.className = 'key-result ok';
      r.textContent = `✓ 连接成功：${res.name}（${res.level}）${res.note || ''}`;
    } else {
      r.className = 'key-result err';
      r.textContent = `✗ ${res.error}`;
    }
  });
  $('saveSettingsBtn').addEventListener('click', async () => {
    await window.api.storeSet('settings', { login: $('loginInput').value.trim(), apiKey: $('apiKeyInput').value.trim() });
    $('settingsModal').classList.add('hidden');
    showToast('✓ 已保存 API 设置');
  });

  $('confirmGroupBtn').addEventListener('click', () => {
    const newG = $('newGroupInput').value.trim();
    const group = newG || $('groupSelect').value || '默认';
    addToGroup(state.pendingFavNames, group);
    $('groupModal').classList.add('hidden');
  });
  $('cancelGroupBtn').addEventListener('click', () => $('groupModal').classList.add('hidden'));

  $('lightbox').addEventListener('click', (e) => {
    if (e.target.closest('.lightbox-tags')) return; // ignore clicks inside tags panel
    $('lightbox').classList.add('hidden');
  });
  $('ltCopyAll').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.lightboxSample) return;
    window.api.copy(buildAnima(state.lightboxSample));
    showToast('✓ 已复制 Anima 提示词');
  });
  $('ltCopyAllPlain').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.lightboxSample) return;
    window.api.copy(buildPlain(state.lightboxSample));
    showToast('✓ 已复制全部提示词');
  });
  $('ltPost').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const u = e.currentTarget.dataset.url;
    if (u) window.api.openExternal(u);
  });
  $('ltDownload').addEventListener('click', async (e) => {
    e.stopPropagation();
    const s = state.lightboxSample;
    if (!s) return;
    const url = s.fileUrl || s.large || s.thumb;
    if (!url) { setStatus('该作品没有可下载的图片地址'); return; }
    const ext = s.fileExt || ((url.match(/\.([a-z0-9]{2,4})(?:\?|$)/i) || [])[1]) || 'jpg';
    const artistPart = (s.tagsArtist && s.tagsArtist[0]) ? s.tagsArtist[0] + '_' : '';
    const suggested = `${artistPart}${s.postId || 'image'}.${ext}`;
    setStatus('下载中…');
    const r = await window.api.downloadSingle({ url, suggestedName: suggested });
    if (r.ok) showToast('✓ 已保存：' + r.filePath);
    else if (r.cancelled) setStatus('');
    else showToast('✗ 下载失败：' + r.error, 'err');
  });

  $('artistBack').addEventListener('click', closeArtist);
  $('artistMore').addEventListener('click', () => { state.artist.page++; loadArtistPosts(); });
  $('artistCopy').addEventListener('click', () => copyAnima([state.artist.name]));
  $('artistStar').addEventListener('click', () => { toggleFav(state.artist.name); updateArtistStar(); });
  $('artistOpen').addEventListener('click', () =>
    window.api.openExternal(`https://danbooru.donmai.us/posts?tags=${encodeURIComponent(state.artist.name)}`));

  $('artistDownload').addEventListener('click', () => startArtistDownload('images'));
  $('artistDataset').addEventListener('click', () => startArtistDownload('dataset'));
  $('artistDownloadCancel').addEventListener('click', () => {
    if (activeDownload) window.api.downloadCancel(activeDownload.name);
  });
  window.api.onDownloadProgress(onDownloadProgress);
}

async function init() {
  bind();
  $('sort').disabled = state.source !== 'search';
  $('query').placeholder = '（最近更新，无需输入）';
  state.favorites = await window.api.storeGet('favorites', { groups: ['默认'], items: [] });
  if (!state.favorites.groups) state.favorites.groups = ['默认'];
  if (!state.favorites.items) state.favorites.items = [];
  renderFavCount();
  await loadSettings();
  load();
}

init();
