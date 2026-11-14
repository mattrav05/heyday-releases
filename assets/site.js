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
      lad.innerHTML = list.length ? `<div class="tw"><table class="t"><thead><tr><th>#</th><th>Character</th><th>Class</th><th>Level</th><th>Paragon</th><th>Experience</th><th>Player</th></tr></thead><tbody>` +
        list.map((c, i) => `<tr><td class="rk">${i + 1}</td><td><a class="cn" href="${charUrl(c.character)}">${esc(c.character)}</a>${live.has(c.character) ? '<span class="chip live">playing</span>' : ""}${c.dead ? '<span class="chip dead">dead</span>' : ""}</td>
          <td>${esc(c.class)}</td><td>${c.level}</td><td>${c.paragon ? `<b class="pg">${fmt(c.paragon)}</b>` : `<span class="muted">-</span>`}</td><td class="muted">${fmt(c.experience)}</td><td class="muted">${esc(c.player)}</td></tr>`).join("") + `</tbody></table></div>`
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
    // ---- gear, drawn like the game's inventory panel (2026-11-13, the user: "shows the gear in the slot etc clean and
    // compact but functional and you highlight the stuff"): each slot at its place on the game's paper doll, the
    // inventory grid under it, item art (assets/items/art.json), quality-tinted cells and the game's tooltip on hover/tap.
    const SLOT = { "head": "head", "neck": "neck", "torso": "torso", "right hand": "rhand", "left hand": "lhand", "right ring": "rring", "left ring": "lring",
      "belt": "belt", "feet": "feet", "hands": "hands", "right hand (swap)": "rhand2", "left hand (swap)": "lhand2" };
    const LABEL = { head: "Helm", neck: "Amulet", torso: "Armor", rhand: "Weapon", lhand: "Off-hand", rring: "Ring", lring: "Ring", belt: "Belt", feet: "Boots", hands: "Gloves" };
    const QN = { unique: "Unique", set: "Set", runeword: "Runeword", rare: "Rare", crafted: "Crafted", magic: "Magic", superior: "Superior", normal: "Normal", low: "Low quality" };
    let art = null, cards = [];
    const artFor = g => { if (!art || !g) return ""; const u = art.uniques || {}, st = art.sets || {}, n = g.name || "", bare = n.replace(/\s*\(.*?\)\s*$/, "");
      return (g.quality === "unique" && (u[n] || u[bare])) || (g.quality === "set" && st[n]) || (art.codes || {})[g.code] || ""; };
    const pic = g => { const f = artFor(g); return f ? `<img src="${ROOT}assets/items/${esc(f)}" alt="" draggable="false">` : `<span class="ch-x"></span>`; };
    const sockets = g => g.sockets ? `<span class="socks">${Array.from({ length: g.sockets }, (_, i) => `<i class="${i < (g.socketed || []).length ? "on" : ""}"></i>`).join("")}</span>` : "";
    const cell = (g, cls, style) => { const i = cards.push(g) - 1;
      return `<button class="${cls} q-${esc(g.quality)}${g.ethereal ? " eth" : ""}${g.charm ? " is-charm" : ""}" data-i="${i}"${style ? ` style="${style}"` : ""} aria-label="${esc(g.name)}">${pic(g)}${sockets(g)}${g.quantity ? `<span class="qty">${g.quantity}</span>` : ""}</button>`; };
    const slotHtml = (g, area, extra = "") => g ? cell(g, `gs a-${area}${extra}`, "") :
      `<div class="gs vacant a-${area}${extra}"><span>${LABEL[area.replace(/2$/, "")] || ""}</span></div>`;
    const doll = (list, who) => { const by = {}; (list || []).forEach(g => { const a = SLOT[g.slot]; if (a) by[a] = g; });
      const swap = by.rhand2 || by.lhand2;
      const tabs = side => swap ? `<div class="wtabs a-t${side}"><button class="on" data-w="1">I</button><button data-w="2">II</button></div>` : "";
      return `<div class="doll2" data-who="${who}">${tabs("r")}${tabs("l")}` +
        ["head", "neck", "torso", "rhand", "lhand", "rring", "lring", "belt", "feet", "hands"].map(a => slotHtml(by[a], a, /hand/.test(a) ? " w1" : "")).join("") +
        (swap ? slotHtml(by.rhand2, "rhand2", " w2") + slotHtml(by.lhand2, "lhand2", " w2") : "") + `</div>`; };
    const invHtml = inv => { if (!inv) return ""; const [w, h] = inv.grid || [10, 8];
      return `<div class="inv" style="--w:${w};--h:${h}">${inv.items.map(g => cell(g, "ch", `grid-column:${g.x + 1}/span ${g.w};grid-row:${g.y + 1}/span ${g.h}`)).join("")}</div>`; };
    const gear = c => {
      cards = [];
      const merc = c.merc && c.merc.length, ch = c.charms || { items: [], totals: [] };
      const side = `<div class="gearside">
          <div class="ctot"><div class="ctot-h">Charms <small>${ch.items.length}</small></div>${ch.items.length ? `<ul>${(ch.totals || []).map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="muted">No charms in the inventory.</p>`}
          ${ch.items.length ? `<button class="hl" data-hl="is-charm" aria-pressed="false">Highlight charms</button>` : ""}</div>
          <p class="build-note">Hover or tap an item for its properties. Set bonuses from other pieces aren't counted.</p></div>`;
      return `<div class="mercg gear"><div class="gtabs"><button class="on" data-who="me">Player</button>${merc ? `<button data-who="merc">Mercenary</button>` : ""}</div>
        <div class="gwrap"><div class="gpanel">
          <div class="gview" data-who="me">${doll(c.gear, "me")}${invHtml(c.inventory)}</div>
          ${merc ? `<div class="gview" data-who="merc" hidden>${doll(c.merc, "merc")}</div>` : ""}
        </div>${side}</div><div class="ctip" hidden></div></div>`;
    };
    const draw = async () => {
      const raw = decodeURIComponent(location.hash.slice(1)), live = raw.endsWith("?live"), name = raw.replace(/\?live$/, "");
      if (!name) { sheet.innerHTML = `<div class="empty">Pick a character on the <a class="ln" href="${ROOT}league/">ladder</a>.</div>`; return; }
      sheet.innerHTML = `<div class="empty">Loading ${esc(name)}...</div>`;
      let c; try { c = await get("/public/character/" + encodeURIComponent(name) + (live ? "?live=true" : "")); } catch (e) { sheet.innerHTML = `<div class="empty">${esc(name)} couldn't be loaded (${esc(e.message)}).</div>`; return; }
      document.title = `${c.name} - level ${c.level} ${c.class} | Heyday league`;
      const a = c.attributes || {};
      sheet.innerHTML = `<div class="sheet-head"><h1>${esc(c.name)}</h1>${c.verified ? '<span class="badge-ok">Checked by the league</span>' : '<span class="badge-wait">Live - not checked yet</span>'}</div>
        <p class="lead">Level ${c.level}${c.paragon ? ` · Paragon ${fmt(c.paragon)}` : ""} ${esc(c.class)}${c.hardcore ? " · Hardcore" : ""} · played by ${esc(c.player)}</p>
        <div class="attrs"><div>Strength<b>${a.strength ?? "-"}</b></div><div>Dexterity<b>${a.dexterity ?? "-"}</b></div><div>Vitality<b>${a.vitality ?? "-"}</b></div><div>Energy<b>${a.energy ?? "-"}</b></div>
        <div>Life<b>${fmt(c.life)}</b></div><div>Mana<b>${fmt(c.mana)}</b></div><div>Experience<b>${fmt(c.experience)}</b></div></div>
        ${gear(c)}
        ${build(c)}`;
      wireGear();
    };
    // ---- skill build and charms (2026-11-13, a player: "Can you show people's skill builds / charms on the ladder"; the
    // user: "it would have to look clean and like the game"). Trees on the game's own 6 x 3 layout (skilldesc rows and
    // columns), charms with the gear above.
    const build = c => {
      const s = c.skills; if (!s || !s.trees) return "";
      const tree = t => {
        const pts = t.skills.reduce((n, k) => n + k.points, 0);
        return `<div class="tree"><div class="tree-h"><span>${esc(t.name)}</span><b>${pts}</b></div><div class="tree-g">` +
          t.skills.map(k => `<div class="sk${k.points ? " on" : ""}" style="grid-row:${k.row};grid-column:${k.col}" title="${esc(k.name)} - required level ${k.req}">
            <span class="sk-i">${k.icon ? `<img src="${ROOT}assets/skills/${esc(k.icon)}.webp" alt="" loading="lazy" onerror="this.remove()">` : ""}<span class="sk-p">${k.points}</span></span><span class="sk-n">${esc(k.name)}</span></div>`).join("") + `</div></div>`;
      };
      const other = (s.other || []).length ? `<p class="build-note">Also: ${s.other.map(k => `${esc(k.name)} <b>${k.points}</b>`).join(", ")}</p>` : "";
      return `<div class="mercg"><h2>Skills</h2><p class="build-note">${fmt(s.spent)} points spent${s.unspent ? ` · ${fmt(s.unspent)} unspent` : ""} ·
        points the player put in (+skills from gear not counted)</p><div class="trees">${s.trees.map(tree).join("")}</div>${other}</div>`;
    };
    const tipHtml = g => { const meta = [g.defense ? `Defense: ${fmt(g.defense)}` : "", g.quantity ? `Quantity: ${g.quantity}` : ""].filter(Boolean);
      return `<div class="nm">${esc(g.name)}</div>${g.name !== g.base ? `<div class="bs">${esc(g.base)}</div>` : ""}${meta.map(m => `<div class="w">${esc(m)}</div>`).join("")}
        <ul>${(g.lines || []).map(l => `<li>${esc(l)}</li>`).join("")}</ul>${g.ethereal || g.sockets ? `<div class="p2">${[g.ethereal ? "Ethereal (Cannot be Repaired)" : "", g.sockets ? `Socketed (${(g.socketed || []).length}/${g.sockets})` : ""].filter(Boolean).join(", ")}</div>` : ""}
        ${g.socketed && g.socketed.length ? `<div class="sk2">${g.socketed.map(esc).join(" · ")}</div>` : ""}<div class="ql">${esc(QN[g.quality] || g.quality || "")}${g.ilvl ? ` · item level ${g.ilvl}` : ""}</div>`; };
    const wireGear = () => {
      const tip = $(".ctip", sheet); if (!tip) return;
      const show = b => { const g = cards[+b.dataset.i]; if (!g) return; tip.className = `ctip q-${g.quality}`; tip.innerHTML = tipHtml(g); tip.hidden = false;
        const r = b.getBoundingClientRect(), t = tip.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        let x = r.right + 10, y = r.top + r.height / 2 - t.height / 2;
        if (x + t.width > vw - 8) x = r.left - t.width - 10;
        if (x < 8) { x = Math.max(8, Math.min(r.left + r.width / 2 - t.width / 2, vw - t.width - 8)); y = r.top - t.height - 8; if (y < 8) y = r.bottom + 8; }
        tip.style.left = x + "px"; tip.style.top = Math.max(8, Math.min(y, vh - t.height - 8)) + "px";
        $$("[data-i].sel", sheet).forEach(x => x.classList.remove("sel")); b.classList.add("sel"); };
      const hide = () => { tip.hidden = true; $$("[data-i].sel", sheet).forEach(x => x.classList.remove("sel")); };
      $$("button[data-i]", sheet).forEach(b => { b.addEventListener("mouseenter", () => show(b)); b.addEventListener("focus", () => show(b));
        b.addEventListener("click", e => { e.stopPropagation(); show(b); }); b.addEventListener("mouseleave", hide); b.addEventListener("blur", hide); });
      $$(".gtabs button", sheet).forEach(b => b.addEventListener("click", () => {
        $$(".gtabs button", sheet).forEach(x => x.classList.toggle("on", x === b));
        $$(".gview", sheet).forEach(v => v.hidden = v.dataset.who !== b.dataset.who);
        const sd = $(".gearside", sheet); if (sd) sd.hidden = b.dataset.who !== "me"; hide(); }));   // the charms are the player's
      $$(".wtabs button", sheet).forEach(b => b.addEventListener("click", () => {
        const d = b.closest(".doll2"); d.classList.toggle("swap", b.dataset.w === "2");
        $$(".wtabs button", d).forEach(x => x.classList.toggle("on", x.dataset.w === b.dataset.w)); hide(); }));
      $$(".hl", sheet).forEach(b => b.addEventListener("click", () => { const on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on); $(".gpanel", sheet).classList.toggle("hl-" + b.dataset.hl, on); }));
      if (!sheet.dataset.tipWired) { sheet.dataset.tipWired = 1;   // once per page: draw() runs again on every hash change
        const off = () => { const t = $(".ctip", sheet); if (t) t.hidden = true; $$("[data-i].sel", sheet).forEach(x => x.classList.remove("sel")); };
        document.addEventListener("click", off); window.addEventListener("scroll", off, { passive: true }); }
      const paint = () => $$("button[data-i]", sheet).forEach(b => { const x = $(".ch-x", b), f = artFor(cards[+b.dataset.i]);
        if (f && x) x.outerHTML = `<img src="${ROOT}assets/items/${esc(f)}" alt="" draggable="false">`; });
      if (art) return;
      fetch(`${ROOT}assets/items/art.json`).then(r => r.ok ? r.json() : null).then(a => { if (a) { art = a; paint(); } }).catch(() => {});
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
