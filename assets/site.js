// Heyday - the site's one script (tools/wiki/build_site.py): header search, phone menu, database filters, league pages.
(() => {
  const ROOT = document.body.dataset.root || "./";           // relative path to the site root from this page
  const LEAGUE = "https://129-80-12-33.sslip.io";
  const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => Number(n || 0).toLocaleString("en-US");
  const icon = f => f ? `<img src="${ROOT}assets/items/${esc(f)}" alt="" loading="lazy">` : "";

  // ---- main menu (tools/wiki/build_site.py NAV): desktop menus open on hover / keyboard focus, and on click of the
  // arrow for touch; on phones the ☰ button opens a drawer with the same groups, each folding open on its arrow
  const mb = $(".menu-btn"), nav = $("#nav");
  const closeAll = except => $$(".dd.open").forEach(x => { if (x !== except) { x.classList.remove("open"); $(".dd-b", x)?.setAttribute("aria-expanded", "false"); } });
  if (mb && nav) mb.addEventListener("click", () => {
    const on = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", on); document.body.classList.toggle("nav-open", on);
    if (on) { const cur = $('.dd[data-sec="on"]', nav); if (cur) { cur.classList.add("open"); $(".dd-b", cur)?.setAttribute("aria-expanded", "true"); } }
  });
  $$(".dd-b").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); const d = b.closest(".dd"); const on = !d.classList.contains("open");
    if (!nav.classList.contains("open")) closeAll(d);
    d.classList.toggle("open", on); b.setAttribute("aria-expanded", on);
  }));
  document.addEventListener("click", e => { if (!e.target.closest(".dd") && !nav?.classList.contains("open")) closeAll(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    closeAll(); if (nav?.classList.contains("open")) { nav.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); document.body.classList.remove("nav-open"); }
  });
  // guide: the phone topic picker closes once a topic is picked; "on this page" marks the part you're reading
  const onp = $$(".onpage a");
  if (onp.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) onp.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + x.target.id)); }),
      { rootMargin: "-80px 0px -70% 0px" });
    onp.forEach(a => { const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) io.observe(t); });
  }

  // ---- header search: everything (items, sets, runewords, recipes, skills, guide), "/" to focus
  const box = $("#q"), res = $("#results");
  let idx = null, sel = -1;
  async function load() { if (!idx) idx = await (await fetch(ROOT + "wiki/search.json")).json(); return idx; }
  function show(list) {
    sel = -1;
    res.innerHTML = list.length ? list.map(([n, w, u, ic, q]) => `<a href="${ROOT}${u}">${ic ? icon(ic) : '<span class="noimg"></span>'}<span><span class="nm q-${q || "x"}">${esc(n)}</span><small>${esc(w)}</small></span></a>`).join("")
                                : `<div class="none">Nothing found.</div>`;
    res.classList.add("open");
  }
  if (box) {
    box.addEventListener("input", async () => {
      const t = box.value.trim().toLowerCase();
      if (t.length < 2) { res.classList.remove("open"); return; }
      const all = await load();
      const starts = [], has = [], base = [];   // name first, then the base / kind ("shako" finds Harlequin Crest)
      for (const x of all) { const n = x[0].toLowerCase(); if (n.startsWith(t)) starts.push(x); else if (n.includes(t)) has.push(x); else if (x[1].toLowerCase().includes(t)) base.push(x); if (starts.length > 40) break; }
      show(starts.concat(has, base).slice(0, 12));
    });
    box.addEventListener("keydown", e => {
      const items = $$("a", res);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); }
      else if (e.key === "Enter") { const a = items[sel >= 0 ? sel : 0]; if (a) location.href = a.href; }
      else if (e.key === "Escape") { res.classList.remove("open"); box.blur(); }
    });
    document.addEventListener("click", e => { if (!e.target.closest(".search")) res.classList.remove("open"); });
    document.addEventListener("keydown", e => { if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); box.focus(); } });
  }

  // ---- database: tooltip cards with filters (item finder, uniques, sets, runewords). Every control is optional - a page
  // only has the ones its rows can use (tools/wiki/build_site.py write_db); the filter state lives in the URL hash.
  const db = $("#db");
  if (db) (async () => {
    const data = await (await fetch(db.dataset.src)).json();
    const kind = db.dataset.kind, cnt = $("#f-count"), more = $("#f-more"), panel = $("#f-panel"), advBtn = $("#f-adv"), active = $("#f-active");
    const F = { q: $("#f-q"), qual: $("#f-qual"), slot: $("#f-slot"), type: $("#f-type"), class: $("#f-class"), sort: $("#f-sort"),
                lmin: $("#f-lmin"), lmax: $("#f-lmax"), tier: $("#f-tier"), sock: $("#f-sock"), diff: $("#f-diff"), src: $("#f-src") };
    const hy = $("#f-heyday"), tagBtns = $$("#f-tags .tag"), DIFF = ["Normal", "Nightmare", "Hell", "Endgame"];
    const tagLabel = Object.fromEntries(tagBtns.map(b => [b.dataset.tag, b.textContent]));
    const tags = new Set();
    let shown = 60;
    const list = v => Array.isArray(v) ? v : v ? [v] : [];
    // read the hash: #q=..&slot=..&tags=mf,res
    const p0 = new URLSearchParams(location.hash.slice(1));
    for (const [k, el] of Object.entries(F)) if (el && p0.get(k) !== null) el.value = p0.get(k);
    if (hy && p0.get("heyday")) hy.checked = true;
    (p0.get("tags") || "").split(",").filter(t => tagLabel[t]).forEach(t => tags.add(t));
    const advUsed = () => ["lmin", "lmax", "tier", "sock", "diff", "src"].some(k => F[k]?.value) || hy?.checked || tags.size;
    const openPanel = on => { if (!panel) return; panel.hidden = !on; advBtn?.setAttribute("aria-expanded", on); advBtn?.classList.toggle("on", on); };
    openPanel(!!advUsed());
    advBtn?.addEventListener("click", () => openPanel(panel.hidden));
    const qClass = x => ({ rw: "rw", set: "set", crafted: "crafted" })[x.q || (kind === "runewords" ? "rw" : kind === "sets" ? "set" : "unique")] || "unique";
    const href = x => x.u ? `${ROOT}wiki/${x.u}` : `${esc(x.s)}/`;
    const card = x => {
      const top = (x.w || []).map(l => `<div class="w">${esc(l)}</div>`).join("");
      const rq = x.r ? `<div class="rq">Required Level: ${x.r}</div>` : "";
      const pr = (x.p || []).map(l => `<div class="p">${esc(l)}</div>`).join("");
      const pc = (x.pc || []).map(l => `<div class="pc">${esc(l)}</div>`).join("");
      const rn = x.rn ? `<div class="runes">${esc(x.rn)}</div>` : "";
      const set = x.set ? `<div class="bs">${esc(x.set)}</div>` : "";
      return `<a class="tip q-${qClass(x)}" href="${href(x)}">${x.h && x.q !== "crafted" ? '<span class="badge">Heyday</span>' : ""}
        <div class="art">${icon(x.i)}</div><div class="nm">${esc(x.n)}</div><div class="bs">${esc(x.b)}</div>${set}${rn}${top}${rq}${pr}${pc}</a>`;
    };
    const val = k => F[k] ? F[k].value : "";
    function match(x, words) {
      if (val("qual") && x.q !== val("qual")) return false;
      if (val("slot") && !list(x.sl).includes(val("slot"))) return false;
      if (val("type") && x.t !== val("type")) return false;
      if (val("class") && x.k !== val("class")) return false;
      const lmin = parseInt(val("lmin")), lmax = parseInt(val("lmax"));
      if (!isNaN(lmin) && (x.r || 0) < lmin) return false;
      if (!isNaN(lmax) && (x.r || 0) > lmax) return false;
      if (val("tier") && !list(x.ti).includes(val("tier"))) return false;
      if (val("sock") && String(x.so || "") !== val("sock")) return false;
      if (val("diff") && (!x.dl || DIFF.indexOf(x.dl) > DIFF.indexOf(val("diff")))) return false;   // "Hell and up": drops by Hell
      if (val("diff") === "Endgame" && x.dl !== "Endgame") return false;
      if (val("src") && !list(x.src).includes(val("src"))) return false;
      if (hy && hy.checked && !x.h) return false;
      for (const t of tags) if (!list(x.g).includes(t)) return false;
      return words.every(w => x.f.includes(w));
    }
    function chips() {   // what's filtering right now, each removable
      const out = [];
      const lab = k => F[k].selectedOptions ? F[k].selectedOptions[0].textContent : F[k].value;
      for (const k of ["qual", "slot", "type", "class", "tier", "sock", "diff", "src"]) if (val(k)) out.push([k, lab(k)]);
      if (val("lmin") || val("lmax")) out.push(["lvl", `Level ${val("lmin") || 0}-${val("lmax") || "any"}`]);
      if (hy?.checked) out.push(["heyday", "Heyday only"]);
      for (const t of tags) out.push(["tag:" + t, tagLabel[t]]);
      active.innerHTML = out.length ? out.map(([k, l]) => `<button type="button" class="tag on" data-clear="${esc(k)}">${esc(l)} &times;</button>`).join("") +
        `<button type="button" class="clear" data-clear="all">Clear all</button>` : "";
    }
    function apply(reset) {
      if (reset) shown = 60;
      const words = val("q").toLowerCase().split(/\s+/).filter(Boolean);
      const res = data.filter(x => match(x, words));
      const s = val("sort") || "level", lv = x => x.r || 999;   // no level requirement (quest items, crafted): last
      res.sort(s === "name" ? (a, b) => a.n.localeCompare(b.n) : s === "level-desc" ? (a, b) => (b.r || 0) - (a.r || 0) || a.n.localeCompare(b.n)
             : s === "ilvl" ? (a, b) => (a.il || 999) - (b.il || 999) || a.n.localeCompare(b.n) : (a, b) => lv(a) - lv(b) || a.n.localeCompare(b.n));
      cnt.textContent = `${fmt(res.length)} ${res.length === 1 ? "item" : "items"}`;
      db.innerHTML = res.length ? res.slice(0, shown).map(card).join("") : `<div class="empty">Nothing matches - try fewer filters.</div>`;
      more.style.display = res.length > shown ? "" : "none";
      tagBtns.forEach(b => { const on = tags.has(b.dataset.tag); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      if (active) chips();
      const h = new URLSearchParams();
      for (const k of Object.keys(F)) if (k !== "sort" && val(k)) h.set(k, val(k));
      if (val("sort") && val("sort") !== "level") h.set("sort", val("sort"));
      if (hy?.checked) h.set("heyday", "1");
      if (tags.size) h.set("tags", [...tags].join(","));
      history.replaceState(null, "", h.toString() ? "#" + h : location.pathname);
    }
    for (const el of Object.values(F)) if (el) el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => apply(true));
    hy?.addEventListener("change", () => apply(true));
    tagBtns.forEach(b => b.addEventListener("click", () => { tags.has(b.dataset.tag) ? tags.delete(b.dataset.tag) : tags.add(b.dataset.tag); apply(true); }));
    active?.addEventListener("click", e => {
      const k = e.target.closest("[data-clear]")?.dataset.clear; if (!k) return;
      if (k === "all") { for (const [n, el] of Object.entries(F)) if (el && n !== "sort") el.value = ""; tags.clear(); if (hy) hy.checked = false; }
      else if (k === "lvl") { F.lmin.value = ""; F.lmax.value = ""; }
      else if (k === "heyday") hy.checked = false;
      else if (k.startsWith("tag:")) tags.delete(k.slice(4));
      else F[k].value = "";
      apply(true);
    });
    more.addEventListener("click", () => { shown += 60; apply(false); });
    apply(true);
  })();

  // ---- league
  const get = async p => { const r = await fetch(LEAGUE + p, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
  const down = el => el.innerHTML = `<div class="empty">The league server can't be reached right now. Try again in a minute.</div>`;
  const charUrl = n => `${ROOT}league/character/#${encodeURIComponent(n)}`;

  const lad = $("#ladder");
  if (lad) (async () => {
    const mode = $("#l-mode"), cls = $("#l-class"), lq = $("#l-q"), cnt = $("#l-count"), limit = +(lad.dataset.limit || 0);
    let rows = [], live = new Set();
    try { const [a, b] = await Promise.all([get("/public/ladder"), get("/public/live").catch(() => ({ players: [] }))]); rows = a.characters; live = new Set((b.players || []).map(p => p.character)); }
    catch (e) { return down(lad); }
    const ls = $("#league-stats");   // home: the league in numbers
    if (ls) { const v = [rows.length, live.size, rows.filter(c => c.level >= 125).length]; $$("b", ls).forEach((b, i) => b.textContent = fmt(v[i])); }
    function draw() {
      const hc = mode && mode.value === "hc", w = (lq?.value || "").toLowerCase();
      let list = rows.filter(c => !!c.hardcore === !!hc && (!cls || !cls.value || c.class === cls.value) && (!w || (c.character + " " + c.player).toLowerCase().includes(w)));
      if (cnt) cnt.textContent = `${list.length} characters`;
      if (limit) list = list.slice(0, limit);
      lad.innerHTML = list.length ? `<div class="tw"><table class="t"><thead><tr><th>#</th><th>Character</th><th>Class</th><th>Level</th><th>Experience</th><th>Player</th></tr></thead><tbody>` +
        list.map((c, i) => `<tr><td class="rk">${i + 1}</td><td><a class="cn" href="${charUrl(c.character)}">${esc(c.character)}</a>${live.has(c.character) ? '<span class="chip live">playing</span>' : ""}${c.dead ? '<span class="chip dead">dead</span>' : ""}</td>
          <td>${esc(c.class)}</td><td>${c.level}</td><td class="muted">${fmt(c.experience)}</td><td class="muted">${esc(c.player)}</td></tr>`).join("") + `</tbody></table></div>`
        : `<div class="empty">No characters here yet.</div>`;
    }
    [mode, cls, lq].forEach(el => el && el.addEventListener(el === lq ? "input" : "change", draw));
    draw();
  })();

  // ---- playing now (2026-11-06, the user: "seems to lag a bit and shows chars twice maybe as they transition").
  // Twice: a player's older, never-closed session also resolved to their newest character - one row per character now,
  // its newest session (the server dedupes too). Lag: the page waited up to 20 s after you came back to the tab and
  // rebuilt the whole table each poll; now it refreshes on return, only re-draws what changed and says how fresh it is.
  const liveEl = $("#live");
  if (liveEl) {
    let last = "", stamp = 0, busy = false;
    const ago = s => s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
    const dur = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
    const fresh = $("#live-fresh");
    const tick = () => { if (fresh && stamp) fresh.textContent = `Updated ${ago((Date.now() - stamp) / 1000)}`; };
    const draw = async () => {
      if (busy) return; busy = true;
      let d; try { d = await get("/public/live"); } catch (e) { busy = false; if (!last) down(liveEl); return; }
      busy = false; stamp = Date.now(); tick();
      const by = new Map();
      for (const p of d.players || []) { const o = by.get(p.character); if (!o || p.started > o.started) by.set(p.character, p); }
      const ps = [...by.values()].sort((a, b) => b.level - a.level || a.character.localeCompare(b.character));
      const now = d.now || Date.now() / 1000;
      const html = ps.length ? `<div class="live-grid">` + ps.map(p => {
        const seen = Math.max(0, now - (p.updated || now));
        const lv = p.level_start && p.level_start < p.level ? `${p.level} <small>(+${p.level - p.level_start})</small>` : `${p.level ?? ""}`;
        return `<a class="live-card" href="${charUrl(p.character)}?live">
          <div class="lc-top"><span class="dot on"></span><b>${esc(p.character)}</b>${p.hardcore ? '<span class="chip dead">HC</span>' : ""}<span class="lc-lvl">Level ${lv}</span></div>
          <div class="lc-sub">${esc(p.class)} · ${esc(p.player)}</div>
          <div class="lc-where">${esc(p.area || "Entering a game")}</div>
          <div class="lc-stats"><span><b>${dur(p.minutes || 0)}</b>session</span><span><b>${fmt(p.kills)}</b>kills</span>
            <span><b>${p.xp_per_hour ? fmt(p.xp_per_hour) : "-"}</b>exp / hour</span><span><b>${fmt(p.uniques)} / ${fmt(p.sets)}</b>uniques / sets</span></div>
          ${seen > 150 ? `<div class="lc-note">Last save ${ago(seen)}</div>` : ""}</a>`;
      }).join("") + `</div>`
        : `<div class="empty">Nobody is playing a league session right now. The <a class="ln" href="${ROOT}league/">ladder</a> shows everyone.</div>`;
      if (html !== last) { liveEl.innerHTML = html; last = html; }   // unchanged data: leave the page alone
      const n = $("#live-n"); if (n) n.textContent = ps.length ? `${ps.length} playing` : "";
    };
    draw();
    setInterval(() => { if (!document.hidden) draw(); }, 20000);
    setInterval(tick, 5000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - stamp > 10000) draw(); });
  }

  const sheet = $("#sheet");
  if (sheet) {
    const SLOT = { "head": "head", "neck": "neck", "torso": "torso", "right hand": "rhand", "left hand": "lhand", "right ring": "rring", "left ring": "lring", "belt": "belt", "feet": "feet", "hands": "hands" };
    const LABEL = { head: "Helm", neck: "Amulet", torso: "Armor", rhand: "Weapon", lhand: "Shield / Off-hand", rring: "Ring", lring: "Ring", belt: "Belt", feet: "Boots", hands: "Gloves" };
    const box = (g, area) => {
      if (!g) return `<div class="slot" style="grid-area:${area}"><div class="sl">${LABEL[area]}</div><div class="empty-slot">empty</div></div>`;
      const extra = [g.defense ? `Defense ${g.defense}` : "", g.ethereal ? "Ethereal" : "", g.sockets ? `Sockets ${g.sockets}` : ""].filter(Boolean).join(" · ");
      return `<div class="slot q-${esc(g.quality)}"${area ? ` style="grid-area:${area}"` : ""}><div class="sl">${esc(area ? LABEL[area] : g.slot)}</div>
        <div class="nm">${esc(g.name)}</div>${g.name !== g.base ? `<div class="bs">${esc(g.base)}</div>` : ""}${extra ? `<div class="bs">${esc(extra)}</div>` : ""}
        <ul>${(g.lines || []).map(l => `<li>${esc(l)}</li>`).join("")}</ul>${g.socketed && g.socketed.length ? `<div class="bs">Socketed: ${esc(g.socketed.join(", "))}</div>` : ""}</div>`;
    };
    const draw = async () => {
      const raw = decodeURIComponent(location.hash.slice(1)), live = raw.endsWith("?live"), name = raw.replace(/\?live$/, "");
      if (!name) { sheet.innerHTML = `<div class="empty">Pick a character on the <a class="ln" href="${ROOT}league/">ladder</a>.</div>`; return; }
      sheet.innerHTML = `<div class="empty">Loading ${esc(name)}...</div>`;
      let c; try { c = await get("/public/character/" + encodeURIComponent(name) + (live ? "?live=true" : "")); } catch (e) { sheet.innerHTML = `<div class="empty">${esc(name)} couldn't be loaded (${esc(e.message)}).</div>`; return; }
      document.title = `${c.name} - level ${c.level} ${c.class} | Heyday league`;
      const by = {}; (c.gear || []).forEach(g => { const a = SLOT[g.slot]; if (a) by[a] = g; });
      const a = c.attributes || {};
      sheet.innerHTML = `<div class="sheet-head"><h1>${esc(c.name)}</h1>${c.verified ? '<span class="badge-ok">Checked by the league</span>' : '<span class="badge-wait">Live - not checked yet</span>'}</div>
        <p class="lead">Level ${c.level} ${esc(c.class)}${c.hardcore ? " · Hardcore" : ""} · played by ${esc(c.player)}</p>
        <div class="attrs"><div>Strength<b>${a.strength ?? "-"}</b></div><div>Dexterity<b>${a.dexterity ?? "-"}</b></div><div>Vitality<b>${a.vitality ?? "-"}</b></div><div>Energy<b>${a.energy ?? "-"}</b></div>
        <div>Life<b>${fmt(c.life)}</b></div><div>Mana<b>${fmt(c.mana)}</b></div><div>Experience<b>${fmt(c.experience)}</b></div></div>
        <div class="doll">${Object.keys(LABEL).map(ar => box(by[ar], ar)).join("")}</div>
        ${(c.gear || []).some(g => /swap/.test(g.slot)) ? `<div class="mercg"><h2>Weapon swap</h2><div class="row">${c.gear.filter(g => /swap/.test(g.slot)).map(g => box(g, "")).join("")}</div></div>` : ""}
        ${c.merc && c.merc.length ? `<div class="mercg"><h2>Mercenary</h2><div class="row">${c.merc.map(g => box(g, "")).join("")}</div></div>` : ""}`;
    };
    draw(); window.addEventListener("hashchange", draw);
  }

  // ---- home: live league status
  const pill = $("#live-pill");
  if (pill) get("/public/live").then(d => {
    const n = new Set((d.players || []).map(p => p.character)).size;   // characters, not sessions (see "playing now")
    pill.innerHTML = `<span class="dot${n ? " on" : ""}"></span>${n ? `League live - ${n} playing now` : "League open - nobody playing this minute"} · <a class="ln" href="${ROOT}league/">ladder</a>`;
  }).catch(() => {});
})();
