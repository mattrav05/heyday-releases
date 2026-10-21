// Heyday - the site's one script (tools/wiki/build_site.py): header search, phone menu, database filters, league pages.
(() => {
  const ROOT = document.body.dataset.root || "./";           // relative path to the site root from this page
  const LEAGUE = "https://129-80-12-33.sslip.io";
  const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => Number(n || 0).toLocaleString("en-US");
  const icon = f => f ? `<img src="${ROOT}assets/items/${esc(f)}" alt="" loading="lazy">` : "";

  // ---- phone menu
  const mb = $(".menu-btn"); if (mb) mb.addEventListener("click", () => $(".nav").classList.toggle("open"));

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

  // ---- database: tooltip cards with filters (uniques, sets, runewords)
  const db = $("#db");
  if (db) (async () => {
    const data = await (await fetch(db.dataset.src)).json();
    const kind = db.dataset.kind, q = $("#f-q"), ty = $("#f-type"), cl = $("#f-class"), so = $("#f-sort"), hy = $("#f-heyday"), cnt = $("#f-count"), more = $("#f-more");
    let shown = 60;
    const read = () => new URLSearchParams(location.hash.slice(1));
    const p0 = read(); if (q && p0.get("q")) q.value = p0.get("q"); if (ty && p0.get("type")) ty.value = p0.get("type"); if (cl && p0.get("class")) cl.value = p0.get("class");
    const card = x => {
      const top = (x.w || []).map(l => `<div class="w">${esc(l)}</div>`).join("");
      const rq = x.r ? `<div class="rq">Required Level: ${x.r}</div>` : "";
      const pr = (x.p || []).map(l => `<div class="p">${esc(l)}</div>`).join("");
      const pc = (x.pc || []).map(l => `<div class="pc">${esc(l)}</div>`).join("");
      const rn = x.rn ? `<div class="runes">${esc(x.rn)}</div>` : "";
      return `<a class="tip q-${kind === "runewords" ? "rw" : kind === "sets" ? "set" : "unique"}" href="${esc(x.s)}/">${x.h ? '<span class="badge">Heyday</span>' : ""}
        <div class="art">${icon(x.i)}</div><div class="nm">${esc(x.n)}</div><div class="bs">${esc(x.b)}</div>${rn}${top}${rq}${pr}${pc}</a>`;
    };
    function apply(reset) {
      if (reset) shown = 60;
      const words = (q?.value || "").toLowerCase().split(/\s+/).filter(Boolean);
      let list = data.filter(x => (!ty || !ty.value || x.t === ty.value) && (!cl || !cl.value || x.k === cl.value) && (!hy || !hy.checked || x.h) &&
        words.every(w => x.f.includes(w)));
      const s = so ? so.value : "level";
      const lv = x => x.r || 999;   // no level requirement (quest items): last
      list.sort(s === "name" ? (a, b) => a.n.localeCompare(b.n) : s === "level-desc" ? (a, b) => b.r - a.r || a.n.localeCompare(b.n) : (a, b) => lv(a) - lv(b) || a.n.localeCompare(b.n));
      cnt.textContent = `${fmt(list.length)} ${list.length === 1 ? "item" : "items"}`;
      db.innerHTML = list.length ? list.slice(0, shown).map(card).join("") : `<div class="empty">Nothing matches - try fewer filters.</div>`;
      more.style.display = list.length > shown ? "" : "none";
      const h = new URLSearchParams(); if (q?.value) h.set("q", q.value); if (ty?.value) h.set("type", ty.value); if (cl?.value) h.set("class", cl.value);
      history.replaceState(null, "", h.toString() ? "#" + h : location.pathname);
    }
    [q, ty, cl, so, hy].forEach(el => el && el.addEventListener(el === q ? "input" : "change", () => apply(true)));
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

  const liveEl = $("#live");
  if (liveEl) {
    const draw = async () => {
      let d; try { d = await get("/public/live"); } catch (e) { return down(liveEl); }
      const ps = d.players || [];
      liveEl.innerHTML = ps.length ? `<div class="tw"><table class="t"><thead><tr><th>Character</th><th>Class</th><th>Level</th><th>Where</th><th>Player</th></tr></thead><tbody>` +
        ps.map(p => `<tr><td><a class="cn" href="${charUrl(p.character)}?live">${esc(p.character)}</a><span class="chip live">playing</span></td><td>${esc(p.class)}</td><td>${p.level ?? ""}</td><td class="muted">${esc(p.area || "")}</td><td class="muted">${esc(p.player)}</td></tr>`).join("") + `</tbody></table></div>`
        : `<div class="empty">Nobody is playing a league session right now. The <a class="ln" href="${ROOT}league/">ladder</a> shows everyone.</div>`;
    };
    draw(); setInterval(() => !document.hidden && draw(), 20000);
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
    const n = (d.players || []).length;
    pill.innerHTML = `<span class="dot${n ? " on" : ""}"></span>${n ? `League live - ${n} playing now` : "League open - nobody playing this minute"} · <a class="ln" href="${ROOT}league/">ladder</a>`;
  }).catch(() => {});
})();
