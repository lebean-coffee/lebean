/* =========================================================
   LE BEAN — one script for the whole site
   ========================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Shop settings (edit these) ---------- */
  var SHOP = {
    // Opening hours in Manila time. 0 = Sunday ... 6 = Saturday.
    // Each day is a list of [open, close] ranges in 24h time (24 = midnight / 11:59pm).
    hours: {
      0: [[0, 15]],              // Sunday 12am – 3pm
      1: [[7, 19], [21, 24]],    // Monday 7am – 7pm, 9pm – 11:59pm
      2: [[0, 24]],              // Tuesday – Saturday: open 24 hours
      3: [[0, 24]],
      4: [[0, 24]],
      5: [[0, 24]],
      6: [[0, 24]]
    }
  };

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
          var ok = !pick || (d.getAttribute("data-pick") || "") === pick;
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
  var fCurrent = document.querySelector(".filters-current b");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      if (fCurrent) fCurrent.textContent = chip.firstChild.textContent.replace(/^[★♥]\s*/, "").trim();
    });
  });

  // Deep links: menu.html?pick=signature (from the home page) or menu.html#rice_meal_selections
  (function () {
    if (!chips.length) return;
    var m = /[?&]pick=([a-z]+)/.exec(window.location.search);
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
