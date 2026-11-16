// Danmaku Studio 說明頁：搜尋（含簡繁互通、同義詞）、標題連結、目錄標示目前段落、回到頂端、我遇到問題、截圖放大
(() => {
  const L = document.documentElement.lang || 'zh-Hant';
  const UI = {
    'zh-Hant': { copied: '已複製連結', copyFail: '請手動複製網址', found: n => `${n} 筆`, none: '沒有結果', hint: '按 / 搜尋', top: '↑ 回到頂端',
      empty: q => `找不到「${q}」。試試換個說法，例如：字號、行距、NVENC、下載、過濾。`, start: '開頭', link: '複製這一節的連結', back: '← 上一步', restart: '重新開始' },
    'zh-Hans': { copied: '已复制链接', copyFail: '请手动复制网址', found: n => `${n} 条`, none: '没有结果', hint: '按 / 搜索', top: '↑ 回到顶部',
      empty: q => `找不到“${q}”。试试换个说法，例如：字号、行距、NVENC、下载、过滤。`, start: '开头', link: '复制这一节的链接', back: '← 上一步', restart: '重新开始' },
    'en': { copied: 'Link copied', copyFail: 'Copy the address manually', found: n => `${n} found`, none: 'No results', hint: 'Press / to search', top: '↑ Top',
      empty: q => `Nothing for "${q}". Try another word, e.g. font size, spacing, NVENC, download, filter.`, start: 'Top', link: 'Copy link to this section', back: '← Back', restart: 'Start over' },
  }[L] || {};

  // ---------- 小提示 ----------
  const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast);
  let tt = 0;
  const say = m => { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 1600); };

  // ---------- 標題旁的「🔗 複製連結」 ----------
  document.querySelectorAll('main h1[id], main h2[id], main h3[id]').forEach(h => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'anchor'; b.textContent = '🔗';
    b.title = UI.link; b.setAttribute('aria-label', UI.link + '：' + h.textContent.trim());
    b.addEventListener('click', async e => {
      e.preventDefault();
      const url = location.href.split('#')[0] + '#' + h.id;
      try { await navigator.clipboard.writeText(url); b.classList.add('done'); say(UI.copied); setTimeout(() => b.classList.remove('done'), 1500); }
      catch (err) { say(UI.copyFail + '：' + url); }
      try { history.replaceState(null, '', '#' + h.id); } catch (err) {}
    });
    h.appendChild(b);
  });

  // ---------- 目錄標出目前讀到哪一節 ----------
  const tocLinks = new Map();
  document.querySelectorAll('.toc a[href^="#"]').forEach(a => tocLinks.set(a.getAttribute('href').slice(1), a));
  const heads = Array.from(document.querySelectorAll('main h1[id], main h2[id], main h3[id]')).filter(h => tocLinks.has(h.id));
  function spy() {
    let cur = heads[0];
    for (const h of heads) { if (h.getBoundingClientRect().top < 120) cur = h; else break; }
    tocLinks.forEach(a => a.classList.remove('active'));
    if (cur) {
      const a = tocLinks.get(cur.id); a.classList.add('active');
      const side = document.querySelector('.side');
      if (side && getComputedStyle(side).position === 'sticky') {
        const r = a.getBoundingClientRect(), s = side.getBoundingClientRect();
        if (r.top < s.top + 40 || r.bottom > s.bottom - 40) side.scrollTop += r.top - s.top - s.height / 3;
      }
    }
    topBtn.classList.toggle('show', scrollY > 700);
  }
  const topBtn = document.createElement('button'); topBtn.type = 'button'; topBtn.className = 'totop'; topBtn.textContent = UI.top;
  topBtn.addEventListener('click', () => { scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); document.getElementById('q')?.focus({ preventScroll: true }); });
  document.body.appendChild(topBtn);
  let st = 0; addEventListener('scroll', () => { if (!st) st = requestAnimationFrame(() => { st = 0; spy(); }); }, { passive: true });
  spy();
  // 手機版：點了目錄就收起來
  const mtoc = document.querySelector('details.mtoc');
  if (mtoc) {
    if (matchMedia('(max-width: 1060px)').matches) mtoc.open = false;
    mtoc.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if (matchMedia('(max-width: 1060px)').matches) mtoc.open = false; }));
  }

  // ---------- 換語言時保留目前位置 ----------
  document.querySelectorAll('.langs a').forEach(a => a.addEventListener('click', () => {
    const cur = document.querySelector('.toc a.active');
    if (cur) a.href = a.getAttribute('href').split('#')[0] + cur.getAttribute('href');
  }));

  // ---------- 截圖放大 ----------
  const dlg = document.getElementById('zoom');
  if (dlg) {
    const big = dlg.querySelector('img'), cap = dlg.querySelector('p');
    document.querySelectorAll('figure img').forEach(img => {
      img.tabIndex = 0;
      const open = () => {
        big.src = img.src; big.alt = img.alt;
        const fc = img.closest('figure').querySelector('figcaption'); cap.textContent = fc ? fc.textContent.replace(/\s+/g, ' ').trim() : '';
        try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
      };
      img.addEventListener('click', open);
      img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    dlg.addEventListener('click', () => dlg.close());
  }

  // ---------- 搜尋 ----------
  const CV = JSON.parse(document.getElementById('cvmap')?.textContent || '{}');      // 另一種字體 → 這頁的字體（簡↔繁）
  const SYN = JSON.parse(document.getElementById('synonyms')?.textContent || '{}');
  const conv = t => { let o = ''; for (const ch of t) o += CV[ch] || ch; return o; };
  const norm = t => conv(t.toLowerCase());
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const input = document.getElementById('q'), box = document.getElementById('results'), count = document.getElementById('qcount');
  if (input) {
    const main = document.querySelector('main');
    const skip = el => el.closest('.search') || el.closest('.side') || el.closest('dialog') || el.closest('.wizard');
    const items = []; let h2 = '', h3 = '';
    const clean = el => { const c = el.cloneNode(true); c.querySelectorAll('.anchor, ul, ol').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
    main.querySelectorAll('h1, h2, h3, li, figcaption, p, em.ver').forEach(el => {
      if (skip(el)) return;
      if (el.tagName === 'H1') { h2 = clean(el); h3 = ''; return; }
      if (el.tagName === 'H2') { h2 = clean(el); h3 = ''; }
      else if (el.tagName === 'H3') h3 = clean(el);
      if (el.closest('figcaption') && el.tagName === 'LI') return;
      const text = clean(el);
      if (text) items.push({ el, text, low: norm(text), where: [h2, h3].filter(Boolean).join(' › '), head: /^H[23]$/.test(el.tagName),
                             name: el.tagName === 'LI' && el.querySelector(':scope > b') ? norm(el.querySelector(':scope > b').textContent) : '' });
    });
    const groupsOf = q => q.trim().split(/\s+/).filter(Boolean).map(w => { const k = norm(w); return [k, ...(SYN[k] || []).map(norm)]; });
    function snippet(text, groups) {
      const low = norm(text); let at = -1;
      for (const g of groups) for (const t of g) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
      let s = text, off = 0;
      if (text.length > 90) { off = Math.max(0, at - 30); s = text.slice(off, off + 90); }
      // 用正規化後的位置標記（簡繁不同也能標到）
      const ls = norm(s), marks = [];
      for (const t of [...new Set(groups.flat())].filter(Boolean)) { let i = ls.indexOf(t); while (i >= 0) { marks.push([i, i + t.length]); i = ls.indexOf(t, i + 1); } }
      marks.sort((a, b) => a[0] - b[0]);
      let out = '', p = 0;
      for (const [a, b] of marks) { if (a < p) continue; out += esc(s.slice(p, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>'; p = b; }
      out += esc(s.slice(p));
      return (off ? '…' : '') + out + (off + 90 < text.length ? '…' : '');
    }
    let cur = -1, shown = [];
    function search(q) {
      cur = -1;
      if (!q.trim()) { box.hidden = true; box.innerHTML = ''; count.textContent = UI.hint; return; }
      const groups = groupsOf(q), scored = [];
      for (const it of items) {
        const hay = it.low + ' ' + norm(it.where); let score = 0, ok = true;
        for (const g of groups) {
          const hit = g.find(t => hay.includes(t));
          if (!hit) { ok = false; break; }
          score += it.low.includes(hit) ? 3 : 1;
          if (it.low.startsWith(hit) || it.head) score += 2;
          if (it.name && it.name.includes(hit)) score += 3;
        }
        if (ok) scored.push({ it, score });
      }
      scored.sort((a, b) => b.score - a.score);
      shown = scored.slice(0, 30);
      count.textContent = scored.length ? UI.found(scored.length) : UI.none;
      box.innerHTML = shown.length ? shown.map((r, i) => `<li><a href="#" data-i="${i}"><span class="where">${esc(r.it.where || UI.start)}</span>${snippet(r.it.text, groups)}</a></li>`).join('')
                                   : `<li class="empty">${esc(UI.empty(q))}</li>`;
      box.hidden = false;
    }
    function go(i) {
      const r = shown[i]; if (!r) return;
      const el = r.it.el; const d = el.closest('details'); if (d) d.open = true;
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      box.hidden = true;
    }
    function mark(i) {
      const links = box.querySelectorAll('a'); if (!links.length) return;
      cur = (i + links.length) % links.length;
      links.forEach((a, k) => a.classList.toggle('on', k === cur)); links[cur].scrollIntoView({ block: 'nearest' });
    }
    let t = 0;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => search(input.value), 80); });
    input.addEventListener('focus', () => { if (input.value.trim()) search(input.value); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(cur + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(cur - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(cur < 0 ? 0 : cur); }
      else if (e.key === 'Escape') { input.value = ''; search(''); input.blur(); }
    });
    box.addEventListener('click', e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); go(+a.dataset.i); } });
    document.querySelectorAll('.search .chips button').forEach(b => b.addEventListener('click', () => { input.value = b.textContent; search(input.value); input.focus(); }));
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
    });
    document.addEventListener('click', e => { if (!e.target.closest('.search')) box.hidden = true; });
    count.textContent = UI.hint;
  }

  // ---------- 我遇到問題 ----------
  const wz = document.getElementById('wizard'), tree = JSON.parse(document.getElementById('wizard-data')?.textContent || 'null');
  if (wz && tree) {
    const stack = [];
    const body = wz.querySelector('.wbody');
    function show(node) {
      let h = '';
      if (stack.length > 1) h += `<div class="trail">${stack.slice(1).map(n => esc(n.label)).join(' › ')}</div>`;
      if (node.q) {
        h += `<div class="q">${esc(node.q)}</div><div class="opts">` + node.opts.map((o, i) => `<button type="button" data-i="${i}">${esc(o.label)}</button>`).join('') + '</div>';
      } else {
        h += '<div class="ans"><ol>' + node.steps.map(s => `<li>${s}</li>`).join('') + '</ol></div>';
      }
      if (stack.length > 1) h += `<div class="nav"><button type="button" data-act="back">${UI.back}</button><button type="button" data-act="reset">${UI.restart}</button></div>`;
      body.innerHTML = h;
    }
    body.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'back') { stack.pop(); show(stack[stack.length - 1]); return; }
      if (b.dataset.act === 'reset') { stack.length = 1; show(tree); return; }
      const node = stack[stack.length - 1].opts[+b.dataset.i]; stack.push(node); show(node);
    });
    stack.push(tree); show(tree);
  }
})();
