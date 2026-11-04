/* =========================================================
   LE BEAN — one script for the whole site
   ========================================================= */
(function () {
  "use strict";


  /* =========================================================
     SITE SETTINGS — content comes from config.js (edit it with admin.html)
     ========================================================= */
  var DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var WEEK = [1, 2, 3, 4, 5, 6, 0]; // display order: Monday first
  var BAG_SVG = '<svg class="grab-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8h13l-1 12.5h-11L5.5 8Z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/></svg>';

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Only allow normal web links and relative paths (never "javascript:" etc.)
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "";
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }
  function slugId(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-"); }
  function toHour(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
    return m ? Math.min(24, parseInt(m[1], 10) + parseInt(m[2], 10) / 60) : NaN;
  }
  function timeLabel(t) {
    var h = toHour(t);
    if (h >= 24) return "11:59pm";
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    var hr = hh % 12 === 0 ? 12 : hh % 12;
    return hr + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + (hh >= 12 ? "pm" : "am");
  }
  function dayRanges(cfg, d) {
    var list = (cfg.hours && cfg.hours[DAY_KEYS[d]]) || [];
    return list.filter(function (r) { return r && toHour(r[0]) < toHour(r[1]); });
  }
  function isAllDay(ranges) { return ranges.length === 1 && toHour(ranges[0][0]) === 0 && toHour(ranges[0][1]) >= 24; }
  // Group consecutive days (Mon → Sun) that share the same hours
  function hourGroups(cfg) {
    var groups = [];
    WEEK.forEach(function (d) {
      var r = dayRanges(cfg, d), key = JSON.stringify(r), last = groups[groups.length - 1];
      if (last && last.key === key) last.days.push(d);
      else groups.push({ key: key, days: [d], ranges: r });
    });
    return groups;
  }
  function hoursTableHTML(cfg) {
    return hourGroups(cfg).map(function (g) {
      var label = g.days.length === 1 ? DAY_NAMES[g.days[0]] : DAY_ABBR[g.days[0]] + " – " + DAY_ABBR[g.days[g.days.length - 1]];
      var val = !g.ranges.length ? "Closed" : isAllDay(g.ranges) ? "Open 24 hours" :
        g.ranges.map(function (r) { return timeLabel(r[0]) + " – " + timeLabel(r[1]); }).join("<br>");
      return "<tr><td>" + label + "</td><td>" + val + "</td></tr>";
    }).join("");
  }
  function hoursSentence(cfg) {
    var parts = hourGroups(cfg).map(function (g) {
      var label = g.days.length === 1 ? DAY_NAMES[g.days[0]] : DAY_NAMES[g.days[0]] + " to " + DAY_NAMES[g.days[g.days.length - 1]];
      var val = !g.ranges.length ? "closed" : isAllDay(g.ranges) ? "24 hours" :
        g.ranges.map(function (r) { return timeLabel(r[0]) + " – " + timeLabel(r[1]); }).join(" and ");
      return label + " " + val;
    });
    var text = parts.length < 3 ? parts.join(" and ") : parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
    return text + ".";
  }

  function visibleSections(cfg) {
    return (cfg.menu || []).map(function (sec) {
      return { id: slugId(sec.id), title: sec.title || "", items: (sec.items || []).filter(function (it) { return it && !it.hidden && it.name; }) };
    }).filter(function (sec) { return sec.items.length; });
  }
  function itemIndex(sections) {
    var idx = {};
    sections.forEach(function (sec) { sec.items.forEach(function (it) { idx[it.id] = { item: it, section: sec }; }); });
    return idx;
  }
  function activePicks(cfg, idx) {
    return (cfg.picks || []).map(function (p) {
      return { id: slugId(p.id), p: p, items: (p.items || []).filter(function (id) { return idx[id]; }) };
    }).filter(function (p) { return p.items.length; });
  }
  function picksOf(id, picks) { return picks.filter(function (p) { return p.items.indexOf(id) >= 0; }); }
  function stickerHTML(id, picks) {
    var mine = picksOf(id, picks);
    return mine.length ? '<span class="tag tag--' + mine[0].id + '">' + esc(mine[0].p.sticker || mine[0].p.tab) + "</span>" : "";
  }
  function grabBtnHTML(cfg, label, extra) {
    return '<a class="btn-grab' + (extra || "") + '" href="' + esc(safeUrl(cfg.links && cfg.links.grab)) +
      '" target="_blank" rel="noopener" data-href="grab">' + BAG_SVG + "<span>" + esc(label) + "</span></a>";
  }
  // ---- Tiny QR code maker (byte mode, error correction level M, versions 1-10), used for the "Order on Grab" QR code
  var QR = (function () {
    var EXP = [], LOG = [];
    (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } })();
    function mul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
    // version: [ec codewords per block, [blocks, data codewords], ...]
    var M = { 1: [10, [1, 16]], 2: [16, [1, 28]], 3: [26, [1, 44]], 4: [18, [2, 32]], 5: [24, [2, 43]], 6: [16, [4, 27]],
      7: [18, [4, 31]], 8: [22, [2, 38], [2, 39]], 9: [22, [3, 36], [2, 37]], 10: [26, [4, 43], [1, 44]] };
    var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
    function rsRem(data, deg) {
      var gen = [1];
      for (var i = 0; i < deg; i++) {
        var next = [];
        for (var j = 0; j <= gen.length; j++) next[j] = (j < gen.length ? gen[j] : 0) ^ (j > 0 ? mul(gen[j - 1], EXP[i]) : 0);
        gen = next;
      }
      var res = []; for (var k = 0; k < deg; k++) res.push(0);
      data.forEach(function (b) {
        var f = b ^ res.shift(); res.push(0);
        for (var j = 0; j < deg; j++) res[j] ^= mul(gen[j + 1], f);
      });
      return res;
    }
    function utf8(s) { var out = [], e = unescape(encodeURIComponent(s)); for (var i = 0; i < e.length; i++) out.push(e.charCodeAt(i)); return out; }
    function make(text) {
      var bytes = utf8(text), ver = 0, info, dataCount;
      for (var v = 1; v <= 10; v++) {
        info = M[v]; dataCount = 0;
        for (var g = 1; g < info.length; g++) dataCount += info[g][0] * info[g][1];
        if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= dataCount * 8) { ver = v; break; }
      }
      if (!ver) return null;
      // data bits
      var bits = [];
      function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
      put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
      bytes.forEach(function (b) { put(b, 8); });
      put(0, Math.min(4, dataCount * 8 - bits.length));
      while (bits.length % 8) bits.push(0);
      var data = [];
      for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
      for (var pad = 0; data.length < dataCount; pad++) data.push(pad % 2 ? 0x11 : 0xEC);
      // blocks, error correction, interleaving
      var blocks = [], ecs = [], pos = 0, ecLen = info[0];
      for (var g2 = 1; g2 < info.length; g2++) for (var n = 0; n < info[g2][0]; n++) {
        var blk = data.slice(pos, pos + info[g2][1]); pos += info[g2][1];
        blocks.push(blk); ecs.push(rsRem(blk, ecLen));
      }
      var words = [], maxLen = blocks[blocks.length - 1].length;
      for (var c = 0; c < maxLen; c++) blocks.forEach(function (bk) { if (c < bk.length) words.push(bk[c]); });
      for (var e = 0; e < ecLen; e++) ecs.forEach(function (ek) { words.push(ek[e]); });
      // matrix
      var size = ver * 4 + 17, mod = [], fn = [];
      for (var y = 0; y < size; y++) { mod.push([]); fn.push([]); for (var x = 0; x < size; x++) { mod[y].push(false); fn[y].push(false); } }
      function set(x, y, dark) { mod[y][x] = !!dark; fn[y][x] = true; }
      for (var t = 0; t < size; t++) { set(6, t, t % 2 === 0); set(t, 6, t % 2 === 0); }
      [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (p) {
        for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
          var xx = p[0] + dx, yy = p[1] + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
        }
      });
      var al = ALIGN[ver], last = al.length - 1;
      for (var ai = 0; ai < al.length; ai++) for (var aj = 0; aj < al.length; aj++) {
        if ((ai === 0 && aj === 0) || (ai === 0 && aj === last) || (ai === last && aj === 0)) continue;
        for (var ady = -2; ady <= 2; ady++) for (var adx = -2; adx <= 2; adx++) set(al[ai] + adx, al[aj] + ady, Math.max(Math.abs(adx), Math.abs(ady)) !== 1);
      }
      function format(mask) {
        var d = mask, r = d; // level M = 00
        for (var i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        var fb = ((d << 10) | r) ^ 0x5412, bit = function (i) { return (fb >>> i) & 1; };
        for (var i2 = 0; i2 <= 5; i2++) set(8, i2, bit(i2));
        set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
        for (var i3 = 9; i3 < 15; i3++) set(14 - i3, 8, bit(i3));
        for (var i4 = 0; i4 < 8; i4++) set(size - 1 - i4, 8, bit(i4));
        for (var i5 = 8; i5 < 15; i5++) set(8, size - 15 + i5, bit(i5));
        set(8, size - 8, true);
      }
      format(0);
      if (ver >= 7) {
        var vr = ver;
        for (var vi = 0; vi < 12; vi++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1f25);
        var vb = (ver << 12) | vr;
        for (var k = 0; k < 18; k++) { var on = (vb >>> k) & 1, a = size - 11 + k % 3, bb = Math.floor(k / 3); set(a, bb, on); set(bb, a, on); }
      }
      var bi = 0;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) for (var jj = 0; jj < 2; jj++) {
          var cx = right - jj, up = ((right + 1) & 2) === 0, cy = up ? size - 1 - vert : vert;
          if (!fn[cy][cx] && bi < words.length * 8) { mod[cy][cx] = ((words[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
        }
      }
      var MASKS = [
        function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
        function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
        function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
        function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }];
      function applyMask(m) { for (var y2 = 0; y2 < size; y2++) for (var x2 = 0; x2 < size; x2++) if (!fn[y2][x2] && MASKS[m](x2, y2)) mod[y2][x2] = !mod[y2][x2]; }
      function penalty() {
        var p = 0, dark = 0;
        function lines(get) {
          for (var a = 0; a < size; a++) {
            var run = 1, seq = "";
            for (var b = 0; b < size; b++) {
              var v2 = get(a, b); seq += v2 ? "1" : "0";
              if (b > 0) { if (v2 === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
            }
            seq = "0000" + seq + "0000";
            var re = /(?=(10111010000|00001011101))/g;
            while (re.exec(seq)) { p += 40; re.lastIndex++; }
          }
        }
        lines(function (a, b) { return mod[a][b]; });
        lines(function (a, b) { return mod[b][a]; });
        for (var y3 = 0; y3 < size; y3++) for (var x3 = 0; x3 < size; x3++) {
          if (mod[y3][x3]) dark++;
          if (y3 < size - 1 && x3 < size - 1) { var c0 = mod[y3][x3]; if (c0 === mod[y3][x3 + 1] && c0 === mod[y3 + 1][x3] && c0 === mod[y3 + 1][x3 + 1]) p += 3; }
        }
        var total = size * size;
        return p + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      }
      var best = 0, bestP = Infinity;
      for (var mk = 0; mk < 8; mk++) {
        applyMask(mk); format(mk);
        var pen = penalty();
        if (pen < bestP) { bestP = pen; best = mk; }
        applyMask(mk);
      }
      applyMask(best); format(best);
      return mod;
    }
    function svg(text, color) {
      var m = make(text);
      if (!m) return "";
      var n = m.length, q = 4, d = "";
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + (x + q) + " " + (y + q) + "h1v1h-1z";
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * q) + " " + (n + 2 * q) + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
        '<rect width="100%" height="100%" fill="#fff"/><path fill="' + (color || "#2a1a04") + '" d="' + d + '"/></svg>';
    }
    return { make: make, svg: svg };
  })();

  // The editor's preview maps file paths to files that aren't uploaded yet; on the live site this does nothing
  function asset(u) { return u && typeof window.__LEBEAN_ASSET === "function" ? window.__LEBEAN_ASSET(u) : u; }
  function soldOutHTML(it) { return it.soldOut ? '<span class="soldout-tag">Sold out today</span>' : ""; }
  function imgHTML(it) {
    return '<img src="' + esc(asset(safeUrl(it.image))) + '" alt="' + esc(it.name) + '" loading="lazy" width="300" height="300">';
  }


  /* ---------- Page wording: simple formatting marks → HTML (always escaped first) ----------
     *handwritten*  ((circled))  __underlined__  **bold**  [link text](address)
     {count} = number of menu items   {hours} = opening hours sentence   {ratings} = number of Grab ratings   new line = line break
     Link addresses may use {grab} {facebook} {instagram} {tiktok} {messenger} {maps}. */
  function grabCount(cfg) {
    var n = cfg.grabRating ? parseInt(cfg.grabRating.count, 10) : NaN;
    return n >= 0 ? n.toLocaleString("en-US") : "";
  }
  function fmtText(src, ctx) {
    var keep = [];
    function hold(html) { keep.push(html); return "\u0000" + (keep.length - 1) + "\u0000"; }
    var s = String(src == null ? "" : src);
    s = s.replace(/\{count\}/g, function () { return hold('<span data-bind="count">' + ctx.total + "</span>"); });
    s = s.replace(/\{hours\}/g, function () { return hold(esc(ctx.hours)); });
    s = s.replace(/\{ratings\}/g, function () { return hold(esc(ctx.ratings || "")); });
    s = esc(s);
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (m, text, url) {
      url = url.replace(/&amp;/g, "&").replace(/\{(\w+)\}/g, function (t, k) { return ctx.links[k] != null ? ctx.links[k] : t; });
      var u = safeUrl(url);
      if (!u) return text;
      var ext = /^https?:/i.test(u);
      return hold('<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">") + text + hold("</a>");
    });
    s = s.replace(/\*\*([^\n]+?)\*\*/g, "<b>$1</b>")
         .replace(/\(\(([^\n]+?)\)\)/g, '<span class="oval">$1</span>')
         .replace(/__([^\n]+?)__/g, '<span class="scribble-u">$1</span>')
         .replace(/\*([^\n*]+?)\*/g, '<span class="hand">$1</span>')
         .replace(/\r?\n/g, "<br>");
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return keep[+i]; });
  }
  function copyValue(copy, key) {
    var parts = String(key).split("."), v = copy;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }

  function applyConfig(cfg) {
    var links = cfg.links || {};
    var sections = visibleSections(cfg);
    var idx = itemIndex(sections);
    var picks = activePicks(cfg, idx);
    var total = sections.reduce(function (n, s) { return n + s.items.length; }, 0);
    function each(sel, fn) { document.querySelectorAll(sel).forEach(fn); }


    // Page wording (headlines, paragraphs, lists, FAQ) — only replaced when config.js has a value
    var copy = cfg.copy;
    if (copy) {
      var ctx = {
        total: total,
        links: links,
        hours: cfg.hours ? hoursSentence(cfg) + (cfg.hoursNote ? " " + cfg.hoursNote : "") : "",
        ratings: grabCount(cfg)
      };
      each("[data-copy]", function (el) {
        var v = copyValue(copy, el.getAttribute("data-copy"));
        if (typeof v !== "string") return;
        el.innerHTML = fmtText(v, ctx);
        el.hidden = !v.trim();
      });
      each("[data-copy-list]", function (el) {
        var list = copyValue(copy, el.getAttribute("data-copy-list"));
        if (!Array.isArray(list)) return;
        list = list.filter(function (t) { return typeof t === "string" && t.trim(); });
        el.innerHTML = list.map(function (t) { return "<li>" + fmtText(t, ctx) + "</li>"; }).join("");
        el.hidden = !list.length;
      });
      each('[data-render="faq"]', function (el) {
        var list = copyValue(copy, "order.faq");
        if (!Array.isArray(list)) return;
        el.innerHTML = list.filter(function (f) { return f && (f.q || "").trim(); }).map(function (f, i) {
          return "<details" + (i ? "" : " open") + "><summary>" + fmtText(f.q, ctx) + "</summary><p>" + fmtText(f.a, ctx) + "</p></details>";
        }).join("");
      });
    }

    // Links (Grab, socials, Messenger, Maps)
    each("[data-href]", function (a) {
      var u = safeUrl(links[a.getAttribute("data-href")]);
      if (u) a.setAttribute("href", u);
    });
    each("[data-fb-page]", function (el) { if (safeUrl(links.facebook)) el.setAttribute("data-fb-page", safeUrl(links.facebook)); });

    // Simple text values
    var values = {
      count: total,
      "handles.facebook": cfg.handles && cfg.handles.facebook,
      "handles.instagram": cfg.handles && cfg.handles.instagram,
      "handles.tiktok": cfg.handles && cfg.handles.tiktok
    };
    each("[data-bind]", function (el) {
      var v = values[el.getAttribute("data-bind")];
      if (v != null && v !== "") el.textContent = v;
    });

    // Address
    var ad = cfg.address || {};
    var line1 = [ad.street, ad.area].filter(Boolean).join(", ");
    var line2 = [ad.city, ad.country].filter(Boolean).join(", ");
    each('[data-render="address"]', function (el) {
      el.innerHTML = [line1, line2].filter(Boolean).map(esc).join("<br>");
    });

    // Opening hours
    if (cfg.hours) {
      each('[data-render="hours"]', function (el) { el.innerHTML = hoursTableHTML(cfg); });
      each('[data-render="hours-text"]', function (el) {
        el.textContent = hoursSentence(cfg) + (cfg.hoursNote ? " " + cfg.hoursNote : "");
      });
    }

    // Scrolling drink names
    if (cfg.marquee) {
      each('[data-render="marquee"]', function (el) {
        el.innerHTML = cfg.marquee.filter(Boolean).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
      });
    }

    // Home: picks tabs + panels
    each('[data-render="pick-tabs"]', function (el) {
      el.innerHTML = picks.map(function (k, i) {
        return '<button class="pick-tab" role="tab" id="tab-' + k.id + '" aria-controls="panel-' + k.id +
          '" aria-selected="' + (i ? "false" : "true") + '" tabindex="' + (i ? -1 : 0) + '"><span aria-hidden="true">' +
          esc(k.p.icon) + "</span>" + esc(k.p.tab) + " <small>" + k.items.length + "</small></button>";
      }).join("");
    });
    each('[data-render="pick-panels"]', function (el) {
      el.innerHTML = picks.map(function (k, i) {
        var n = k.items.length, span = n % 4 ? 4 - n % 4 : 4;
        var cards = k.items.map(function (id, d) {
          var it = idx[id].item;
          return '<article class="card reveal' + (it.soldOut ? " is-soldout" : "") + '" data-delay="' + d + '"><div class="dish-img">' + stickerHTML(id, picks) + imgHTML(it) + soldOutHTML(it) +
            '</div><div class="card-body"><h3>' + esc(it.name) + '</h3><span class="cat">' + esc(idx[id].section.title) + "</span>" +
            (it.description ? '<p class="card-desc">' + esc(it.description) + "</p>" : "") + "</div>" +
            grabBtnHTML(cfg, "Order via Grab", " btn-grab--block") + "</article>";
        }).join("");
        var note = '<div class="pick-note' + (span > 1 ? " span-" + span + (span >= 2 ? " pick-note--wide" : "") : "") + ' reveal">' +
          '<div><span class="hand">' + esc(k.p.noteTitle) + "</span><p>" + esc(k.p.noteText) + "</p></div>" +
          '<a class="btn btn--cream" href="menu.html?pick=' + k.id + '">View on menu <span class="arrow">→</span></a></div>';
        return '<div class="pick-panel cards" role="tabpanel" id="panel-' + k.id + '" aria-labelledby="tab-' + k.id + '"' +
          (i ? " hidden" : "") + ">" + cards + note + "</div>";
      }).join("");
    });

    // Menu page: filter chips + sections
    each('[data-render="menu-chips"]', function (el) {
      var html = '<button class="chip is-active" data-filter="all" data-label="All" aria-pressed="true">All<sup>' + total + "</sup></button>";
      picks.forEach(function (k) {
        html += '<button class="chip" data-filter="pick:' + k.id + '" data-label="' + esc(k.p.tab) + '" aria-pressed="false">' +
          esc(k.p.icon) + " " + esc(k.p.tab) + "<sup>" + k.items.length + "</sup></button>";
      });
      sections.forEach(function (sec) {
        html += '<button class="chip" data-filter="' + sec.id + '" data-label="' + esc(sec.title) + '" aria-pressed="false">' +
          esc(sec.title) + "<sup>" + sec.items.length + "</sup></button>";
      });
      el.innerHTML = html;
    });
    each('[data-render="menu-sections"]', function (el) {
      el.innerHTML = sections.map(function (sec, n) {
        var num = n + 1 < 10 ? "0" + (n + 1) : String(n + 1);
        var dishes = sec.items.map(function (it) {
          var mine = picksOf(it.id, picks).map(function (k) { return k.id; }).join(" ");
          return '<article class="dish' + (it.soldOut ? " is-soldout" : "") + '"' + (mine ? ' data-pick="' + mine + '"' : "") + '><div class="dish-img">' +
            stickerHTML(it.id, picks) + imgHTML(it) + soldOutHTML(it) + '</div><div class="dish-body"><h3>' + esc(it.name) + "</h3>" +
            (it.description ? '<p class="dish-desc">' + esc(it.description) + "</p>" : "") + "</div>" +
            grabBtnHTML(cfg, "Order via Grab", " btn-grab--block") + "</article>";
        }).join("");
        return '<section class="menu-section" id="' + sec.id + '" data-cat="' + sec.id + '" aria-labelledby="h-' + sec.id + '">' +
          '<div class="menu-section-head"><span class="idx">(' + num + ')</span><h2 id="h-' + sec.id + '">' + esc(sec.title) +
          '</h2><span class="count">' + sec.items.length + " items</span></div>" +
          '<div class="dish-grid">' + dishes + "</div></section>";
      }).join("");
    });

    // Home page spotlight: one featured item (new or seasonal), switched on in the editor
    var spot = cfg.spotlight || {};
    each("[data-spotlight]", function (sec) {
      var hit = spot.enabled && spot.item ? idx[spot.item] : null;
      sec.hidden = !hit;
      if (!hit) return;
      var it = hit.item, sctx = ctx || { total: total, links: cfg.links || {}, hours: "", ratings: "" };
      var q = function (s) { return sec.querySelector(s); };
      q("[data-spot-img]").innerHTML = imgHTML(it) + soldOutHTML(it);
      q("[data-spot-badge]").textContent = spot.badge || "";
      q("[data-spot-badge]").hidden = !spot.badge;
      q("[data-spot-cat]").textContent = hit.section.title;
      q("[data-spot-title]").innerHTML = fmtText(spot.title || it.name, sctx);
      var txt = spot.text || it.description || "";
      q("[data-spot-text]").innerHTML = fmtText(txt, sctx);
      q("[data-spot-text]").hidden = !txt;
      q("[data-spot-button]").textContent = spot.button || "Order on Grab";
    });

    // QR codes (Contact page): drawn from the current link, so they follow the editor's settings
    each("[data-qr]", function (el) {
      var url = safeUrl(cfg.links && cfg.links[el.getAttribute("data-qr")]);
      if (url) el.innerHTML = QR.svg(url);
    });

    // Videos: each video spot plays the file chosen in config.js; its cover image has the same name with .webp
    var vids = cfg.videos || {};
    each("video[data-video]", function (v) {
      var src = safeUrl(vids[v.getAttribute("data-video")]);
      if (!src) return;
      var poster = asset(src.replace(/\.[a-z0-9]+$/i, ".webp"));
      src = asset(src);
      if (v.getAttribute("poster") !== poster) v.setAttribute("poster", poster);
      var source = v.querySelector("source");
      if (source && source.getAttribute("src") !== src) {
        source.setAttribute("src", src);
        if (v.load && !window.__LEBEAN_PRERENDER) v.load();
      }
    });

    // Grab rating (Reviews & FAQ page): the number, and stars whose gold part follows it (4.8 fills 96%)
    var score = cfg.grabRating ? parseFloat(cfg.grabRating.score) : NaN;
    if (score > 0) score = Math.min(5, score);
    each("[data-grab-score]", function (el) { if (score > 0) el.textContent = score.toFixed(1); });
    each("[data-rating-stars]", function (el) {
      if (!(score > 0)) return;
      var fill = el.querySelector(".rating-stars-fill");
      if (fill) fill.style.width = (score / 5 * 100) + "%";
      el.setAttribute("aria-label", score.toFixed(1) + " out of 5 stars");
    });

    // Customer reviews (Reviews & FAQ page) — the section stays hidden until there is at least one
    each('[data-render="reviews"]', function (el) {
      var list = (cfg.reviews || []).filter(function (r) { return r && String(r.text || "").trim(); });
      el.innerHTML = list.map(function (r) {
        var n = Math.max(0, Math.min(5, parseInt(r.rating, 10) || 0));
        var stars = n ? '<div class="review-stars" role="img" aria-label="' + n + ' out of 5 stars">' +
          "★★★★★".slice(0, n) + '<span class="off">' + "★★★★★".slice(0, 5 - n) + "</span></div>" : "";
        var who = esc(r.name || "A happy customer");
        var src = r.source ? '<span class="review-src">' + esc(r.source) + "</span>" : "";
        return '<figure class="review reveal">' + stars + "<blockquote>" + esc(r.text) + "</blockquote>" +
          "<figcaption><b>" + who + "</b>" + src + "</figcaption></figure>";
      }).join("");
      var sec = el.closest("[data-reviews-section]");
      if (sec) sec.hidden = !list.length;
    });

    // Announcement bar (optional)
    var an = cfg.announcement || {};
    each('[data-render="announcement"]', function (el) {
      if (an.enabled && an.text) {
        var link = an.linkText && safeUrl(an.linkUrl) ?
          ' <a href="' + esc(safeUrl(an.linkUrl)) + '">' + esc(an.linkText) + " →</a>" : "";
        el.innerHTML = '<div class="container"><p>' + esc(an.text) + link + "</p></div>";
        el.hidden = false;
      } else {
        el.innerHTML = "";
        el.hidden = true;
      }
    });

    // Menu structured data for Google (menu page only): sections, items, descriptions, photos
    if (document.querySelector('[data-render="menu-sections"]')) {
      var canon = document.querySelector('link[rel="canonical"]');
      var abs = function (path) { try { return canon ? new URL(path, canon.href).href : ""; } catch (e) { return ""; } };
      var menuLd = {
        "@context": "https://schema.org", "@type": "Menu", name: "Le Bean menu",
        hasMenuSection: sections.map(function (sec) {
          return { "@type": "MenuSection", name: sec.title, hasMenuItem: sec.items.map(function (it) {
            var mi = { "@type": "MenuItem", name: it.name };
            if (it.description) mi.description = it.description;
            var img = abs(safeUrl(it.image)); if (img) mi.image = img;
            return mi;
          }) };
        })
      };
      if (canon) menuLd.url = canon.href;
      var ml = document.getElementById("ld-menu");
      if (!ml) { ml = document.createElement("script"); ml.type = "application/ld+json"; ml.id = "ld-menu"; document.head.appendChild(ml); }
      ml.textContent = "\n" + JSON.stringify(menuLd, null, 2) + "\n";
    }

    // Google business details (structured data)
    var ld = document.getElementById("ld-business");
    if (ld) {
      try {
        var data = JSON.parse(ld.textContent);
        data.address = data.address || { "@type": "PostalAddress" };
        if (ad.street || ad.area) data.address.streetAddress = [ad.street, ad.area].filter(Boolean).join(", ");
        if (ad.city) data.address.addressLocality = ad.city;
        if (ad.region) data.address.addressRegion = ad.region;
        if (cfg.hours) {
          var specs = [];
          WEEK.forEach(function (d) {
            dayRanges(cfg, d).forEach(function (r) {
              var opens = r[0], closes = toHour(r[1]) >= 24 ? "23:59" : r[1];
              var found = specs.filter(function (s) { return s.opens === opens && s.closes === closes; })[0];
              if (found) found.days.push(DAY_NAMES[d]);
              else specs.push({ opens: opens, closes: closes, days: [DAY_NAMES[d]] });
            });
          });
          data.openingHoursSpecification = specs.map(function (s) {
            return { "@type": "OpeningHoursSpecification", dayOfWeek: s.days.length === 1 ? s.days[0] : s.days, opens: s.opens, closes: s.closes };
          });
        }
        var same = ["facebook", "instagram", "tiktok", "grab"].map(function (k) { return safeUrl(links[k]); }).filter(Boolean);
        if (same.length) data.sameAs = same;
        if (safeUrl(links.grab) && data.potentialAction) data.potentialAction.target = safeUrl(links.grab);
        ld.textContent = "\n" + JSON.stringify(data, null, 2) + "\n  ";
      } catch (e) {}
    }
  }

  // Preview from admin.html: the draft settings travel in the preview frame's window.name
  var PREVIEW = /[?&]preview\b/.test(location.search) && String(window.name).indexOf("lebean-preview:") === 0;
  var CFG = null;
  if (PREVIEW) { try { CFG = JSON.parse(String(window.name).slice(15)); } catch (e) { CFG = null; } }
  if (!CFG) CFG = window.LEBEAN_CONFIG || null;
  if (CFG) {
    try { applyConfig(CFG); } catch (e) { if (window.console) console.error("Le Bean: could not apply config.js", e); }
  }
  // The build step only needs the content rendered; stop before adding interactivity
  if (window.__LEBEAN_PRERENDER) return;

  // "Download QR code" button: saves a print-ready PNG of the Grab QR code
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-qr-download]") : null;
    if (!btn) return;
    var links = (CFG && CFG.links) || {}, url = safeUrl(links[btn.getAttribute("data-qr-download")]);
    var m = url && QR.make(url);
    if (!m) return;
    var n = m.length, cell = Math.floor(1000 / (n + 8)), pad = cell * 4, size = cell * n + pad * 2, foot = Math.round(size * 0.16);
    var cv = document.createElement("canvas"); cv.width = size; cv.height = size + foot;
    var g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#2a1a04";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) g.fillRect(pad + x * cell, pad + y * cell, cell, cell);
    g.textAlign = "center"; g.font = "700 " + Math.round(foot * 0.36) + "px system-ui, sans-serif";
    g.fillText(btn.getAttribute("data-qr-label") || "Scan to order on GrabFood", size / 2, size + foot * 0.35);
    cv.toBlob(function (b) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "le-bean-grab-qr.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, "image/png");
  });
  if (PREVIEW) {
    var badge = document.createElement("div");
    badge.className = "preview-badge";
    badge.textContent = "Preview · not saved yet";
    document.body.appendChild(badge);
    // keep preview mode when clicking between pages
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute("href");
      var m = /^([a-z0-9_-]+\.html)(\?[^#]*)?(#.*)?$/i.exec(h);
      if (m) a.setAttribute("href", m[1] + (m[2] ? m[2] + "&preview" : "?preview") + (m[3] || ""));
    });
  }

  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Opening hours for the open/closed badge (from config.js) ---------- */
  // 0 = Sunday ... 6 = Saturday; each day is a list of [open, close] ranges in hours (24 = midnight).
  var SHOP = { hours: { 0: [[0, 15]], 1: [[7, 19], [21, 24]], 2: [[0, 24]], 3: [[0, 24]], 4: [[0, 24]], 5: [[0, 24]], 6: [[0, 24]] } };
  if (CFG && CFG.hours) {
    SHOP.hours = {};
    for (var di = 0; di < 7; di++) {
      SHOP.hours[di] = dayRanges(CFG, di).map(function (r) { return [toHour(r[0]), toHour(r[1])]; });
    }
  }

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  function closeNav() {
    document.body.classList.remove("nav-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", closeNav);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 880) closeNav();
    });
  }

  /* ---------- Hand-drawn ovals around words ---------- */
  document.querySelectorAll(".oval").forEach(function (el) {
    el.insertAdjacentHTML(
      "beforeend",
      '<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<path pathLength="1" d="M20 60 C 10 24, 118 6, 176 26 C 206 38, 198 80, 122 90 C 62 97, 8 86, 14 54 C 18 36, 60 16, 106 14" />' +
      "</svg>"
    );
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal, .oval");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Videos: play only while on screen ---------- */
  var videos = document.querySelectorAll("video[data-autoplay]");
  videos.forEach(function (v) {
    v.muted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
  });
  if (!reduceMotion && "IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { vo.observe(v); });
  }

  /* ---------- Marquee: duplicate content for a seamless loop ---------- */
  document.querySelectorAll(".marquee-track").forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  /* ---------- Home: picks tabs ---------- */
  var tabs = document.querySelectorAll(".pick-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    });
    tab.addEventListener("keydown", function (e) {
      var list = Array.prototype.slice.call(tabs);
      var i = list.indexOf(tab);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var next = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
        next.focus();
        next.click();
      }
    });
  });

  /* ---------- Menu filters ---------- */
  var chips = document.querySelectorAll(".chip[data-filter]");
  var sections = document.querySelectorAll(".menu-section[data-cat]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var cat = chip.getAttribute("data-filter");
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var pick = cat.indexOf("pick:") === 0 ? cat.slice(5) : null;
      sections.forEach(function (s) {
        var visible = 0;
        s.querySelectorAll(".dish").forEach(function (d) {
          var ok = !pick || (" " + (d.getAttribute("data-pick") || "") + " ").indexOf(" " + pick + " ") >= 0;
          d.hidden = !ok;
          if (ok) visible++;
        });
        var show = pick ? visible > 0 : (cat === "all" || s.getAttribute("data-cat") === cat);
        s.classList.toggle("is-hidden", !show);
        s.classList.remove("is-shown");
        if (show) { void s.offsetWidth; s.classList.add("is-shown"); }
      });
      chip.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
      var bar = document.querySelector(".filters-bar");
      if (bar) {
        var start = bar.parentElement.getBoundingClientRect().top + window.pageYOffset;
        if (window.pageYOffset > start) {
          window.scrollTo({ top: start, behavior: reduceMotion ? "auto" : "smooth" });
        }
      }
    });
  });

  // Show / hide the filter pills (remembered for this visitor when storage is available)
  var fBar = document.querySelector(".filters-bar");
  var fToggle = document.querySelector(".filters-toggle");
  function setFilters(open) {
    if (!fBar || !fToggle) return;
    fBar.classList.toggle("is-collapsed", !open);
    fToggle.setAttribute("aria-expanded", open ? "true" : "false");
    fToggle.querySelector(".ft-label").textContent = open ? "Hide filters" : "Show filters";
    try { localStorage.setItem("lebean-filters", open ? "open" : "closed"); } catch (e) {}
  }
  if (fToggle) {
    var saved = null;
    try { saved = localStorage.getItem("lebean-filters"); } catch (e) {}
    if (saved === "closed") setFilters(false);
    fToggle.addEventListener("click", function () {
      setFilters(fBar.classList.contains("is-collapsed"));
    });
  }
  /* ---------- Menu: "More" for descriptions longer than 3 lines ---------- */
  var descs = document.querySelectorAll(".dish-desc");
  descs.forEach(function (d) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "desc-more"; b.textContent = "More"; b.hidden = true;
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () {
      var open = d.classList.toggle("is-open");
      b.textContent = open ? "Less" : "More";
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
    d.insertAdjacentElement("afterend", b);
  });
  function updateMore() {
    descs.forEach(function (d) {
      if (d.classList.contains("is-open") || !d.offsetParent) return;
      d.nextElementSibling.hidden = d.scrollHeight <= d.clientHeight + 2;
    });
  }
  updateMore();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateMore);
  var moreT;
  window.addEventListener("resize", function () { clearTimeout(moreT); moreT = setTimeout(updateMore, 150); });

  var fCurrent = document.querySelector(".filters-current b");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      setTimeout(updateMore, 30);
      if (fCurrent) fCurrent.textContent = chip.getAttribute("data-label") || chip.firstChild.textContent.replace(/^[★♥]\s*/, "").trim();
    });
  });

  // Deep links: menu.html?pick=signature (from the home page) or menu.html#rice_meal_selections
  (function () {
    if (!chips.length) return;
    var m = /[?&]pick=([a-z0-9_-]+)/.exec(window.location.search);
    var key = m ? "pick:" + m[1] : (window.location.hash || "").slice(1);
    if (!key) return;
    var target = document.querySelector('.chip[data-filter="' + key + '"]');
    if (target) target.click();
  })();

  /* ---------- Open / closed status (Manila time) ---------- */
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function manilaNow() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 8 * 3600000);
  }
  function isOpenAt(day, hour) {
    return (SHOP.hours[day] || []).some(function (r) { return hour >= r[0] && hour < r[1]; });
  }
  function fmt(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (hh === 0 && mm === 0) return "12am";
    var suffix = hh >= 12 ? "pm" : "am";
    var hr = hh % 12 === 0 ? 12 : hh % 12;
    return hr + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + suffix;
  }
  // Walk forward in 15-minute steps to find when the open/closed state next changes.
  function nextChange(day, hour, open) {
    for (var step = 1; step <= 7 * 96; step++) {
      var t = hour + step * 0.25;
      var d = (day + Math.floor(t / 24)) % 7;
      var h = t % 24;
      if (isOpenAt(d, h) !== open) return { offset: Math.floor(t / 24), day: d, hour: h };
    }
    return null;
  }
  function when(c) {
    if (c.offset === 0) return fmt(c.hour);
    if (c.offset === 1) return fmt(c.hour) + " tomorrow";
    return DAYS[c.day] + " " + fmt(c.hour);
  }
  function updateStatus() {
    var d = manilaNow();
    var day = d.getDay();
    var hour = d.getHours() + d.getMinutes() / 60;
    var open = isOpenAt(day, hour);
    var c = nextChange(day, Math.floor(hour * 4) / 4, open);
    var text;
    if (!c) text = open ? "Open now" : "Closed";
    else if (open) text = "Open now · until " + when(c);
    else text = "Closed · opens " + when(c);
    document.querySelectorAll(".open-status").forEach(function (el) {
      el.textContent = text;
      el.classList.toggle("is-open", open);
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- Contact: preselect topic from the link (contact.html?topic=event) ---------- */
  (function () {
    var m = /[?&]topic=([a-z-]+)/.exec(window.location.search);
    var sel = document.getElementById("topic");
    if (m && sel) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === m[1]) { sel.selectedIndex = i; break; }
      }
    }
  })();

  /* ---------- Contact form (static demo: no server yet) ---------- */
  var form = document.querySelector(".form[data-demo]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var name = form.querySelector("#name");
      var who = form.querySelector(".form-success [data-name]");
      if (name && who) who.textContent = name.value.trim().split(" ")[0] || "friend";
      form.classList.add("is-sent");
    });
    var again = form.querySelector("[data-reset]");
    if (again) {
      again.addEventListener("click", function () {
        form.reset();
        form.classList.remove("is-sent");
      });
    }
  }

  /* ---------- Facebook page feed: load once, sized to its container (max 500px) ---------- */
  document.querySelectorAll(".fb-embed[data-fb-page]").forEach(function (box) {
    var frame = box.querySelector("iframe");
    if (!frame) return;
    var w = Math.max(180, Math.min(500, Math.floor(box.clientWidth)));
    var h = 640;
    frame.width = w;
    frame.height = h;
    // hide_cover=true: the page name shows as dark text on white instead of
    // white text over the cover photo (which breaks if the cover is cropped or blocked)
    frame.src = "https://www.facebook.com/plugins/page.php?href=" +
      encodeURIComponent(box.getAttribute("data-fb-page")) +
      "&tabs=timeline&width=" + w + "&height=" + h +
      "&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false";
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
