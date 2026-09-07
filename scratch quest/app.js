/* =========================================================
   SCRATCH QUEST  -  アプリ本体
   ---------------------------------------------------------
   ここは「しくみ」の部分です。
   教材の中身を変えたいときは js/data-basic.js と
   js/data-advance.js を編集してください。
   ========================================================= */

(function () {
  "use strict";

  const SAVE_KEY = "scratch-quest-v1";
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------------------------------------------------
     セーブデータ
     --------------------------------------------------------- */
  const defaultState = () => ({
    name: "",
    course: "basic",
    progress: { basic: {}, advance: {} },
    awards:   { basic: [], advance: [] },
    special:  [],
    opts: { unlockAll: false, hideAnswer: false, scratchUrl: "" }
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      /* 保存できない環境でも、そのセッション中は動きます */
    }
  }

  /* ---------------------------------------------------------
     便利な関数
     --------------------------------------------------------- */
  const course     = (id) => COURSES.find((c) => c.id === (id || state.course));
  const chapters   = (id) => course(id).chapters;
  const scratchUrl = () => state.opts.scratchUrl || course().scratchUrl;

  function chState(ci, courseId) {
    const cid = courseId || state.course;
    const p = state.progress[cid];
    if (!p[ci]) {
      p[ci] = { missions: [], challenge: false, cleared: false };
    }
    const need = chapters(cid)[ci].missions.length;
    while (p[ci].missions.length < need) p[ci].missions.push(false);
    return p[ci];
  }

  function isCleared(ci, courseId) {
    const st = chState(ci, courseId);
    return st.missions.length > 0 && st.missions.every(Boolean);
  }

  function isUnlocked(ci, courseId) {
    if (state.opts.unlockAll) return true;
    if (ci === 0) return true;
    return isCleared(ci - 1, courseId);
  }

  function clearedCount(courseId) {
    const cid = courseId || state.course;
    return chapters(cid).reduce((n, _, i) => n + (isCleared(i, cid) ? 1 : 0), 0);
  }

  function currentChapter(courseId) {
    const cid = courseId || state.course;
    const list = chapters(cid);
    for (let i = 0; i < list.length; i++) if (!isCleared(i, cid)) return i;
    return list.length - 1;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* ---------------------------------------------------------
     画面の切りかえ
     --------------------------------------------------------- */
  let view = "title";
  let openChapter = 0;
  let openMission = 0;

  function go(name) {
    view = name;
    $$(".view").forEach((v) => v.classList.remove("is-active"));
    const el = $("#view-" + name);
    if (el) el.classList.add("is-active");
    $("#topbar").hidden = (name === "title" || name === "course");
    window.scrollTo(0, 0);

    if (name === "course")   renderCourses();
    if (name === "map")      renderMap();
    if (name === "chapter")  renderChapter();
    if (name === "mission")  renderMission();
    if (name === "awards")   renderAwards();
    if (name === "profile")  renderProfile();
    if (name === "settings") renderSettings();
  }

  function setCourse(id) {
    state.course = id;
    document.documentElement.dataset.theme = id;
    save();
  }

  /* ---------------------------------------------------------
     コース選択
     --------------------------------------------------------- */
  function renderCourses() {
    $("#course-grid").innerHTML = COURSES.map((c) => {
      const done = clearedCount(c.id);
      const badge = c.id === "basic" ? "📘" : "📕";
      return `
        <button class="course-card frame--corner" data-course="${c.id}">
          <span class="course-card__badge">${badge}</span>
          <span class="course-card__name">${esc(c.name)}</span>
          <span class="course-card__book">${esc(c.bookTitle)} ── ${esc(c.tagline)}</span>
          <span class="course-card__desc">${esc(c.description)}</span>
          <span class="course-card__meta">全${c.chapters.length}章 ／ クリア ${done}章</span>
        </button>`;
    }).join("");

    $$("#course-grid .course-card").forEach((b) => {
      b.addEventListener("click", () => {
        setCourse(b.dataset.course);
        go("map");
      });
      b.addEventListener("mouseenter", () => {
        document.documentElement.dataset.theme = b.dataset.course;
      });
    });
  }

  /* ---------------------------------------------------------
     年間マップ
     --------------------------------------------------------- */
  function renderMap() {
    const c = course();
    const list = c.chapters;
    const cur = currentChapter();
    const done = clearedCount();

    $("#map-title").textContent = c.bookTitle;
    $("#map-sub").textContent = c.name + " ／ " + c.tagline;
    $("#map-progress-label").textContent =
      (state.name ? state.name + " の" : "") + "すすみぐあい";
    $("#map-progress-count").textContent = done + " / " + list.length + " 章クリア";
    $("#map-progress-fill").style.width = (done / list.length * 100) + "%";

    // 4つずつの行に分けて、へびのように並べる
    const rows = [];
    for (let i = 0; i < list.length; i += 4) rows.push(list.slice(i, i + 4).map((ch, j) => i + j));

    $("#map").innerHTML = rows.map((row) => `
      <div class="map-row">
        ${row.map((ci) => {
          const ch = list[ci];
          const unlocked = isUnlocked(ci);
          const cleared = isCleared(ci);
          const cls = ["node"];
          if (!unlocked) cls.push("is-locked");
          if (cleared) cls.push("is-clear");
          else if (ci === cur && unlocked) cls.push("is-current");
          const st = cleared ? "CLEAR!" : (unlocked ? "ひらく" : "🔒 ロック");
          return `
            <button class="${cls.join(" ")}" data-ch="${ci}" ${unlocked ? "" : "disabled"}>
              <span class="node__month">${esc(ch.month)}</span>
              <span class="node__icon">${cleared ? "🏆" : ch.icon}</span>
              <span class="node__title">第${ci + 1}章 ${esc(ch.title)}</span>
              <span class="node__state">${st}</span>
            </button>`;
        }).join("")}
      </div>`).join("");

    $$("#map .node").forEach((n) => {
      n.addEventListener("click", () => {
        if (n.disabled) return;
        openChapter = Number(n.dataset.ch);
        // 一度でも手をつけた章は、お話を飛ばしてミッションから始める
        const seen = chState(openChapter).missions.some(Boolean) || isCleared(openChapter);
        storyStep = seen ? chapters()[openChapter].story.length - 1 : 0;
        bodyOpen = seen;
        go("chapter");
      });
    });
  }

  /* ---------------------------------------------------------
     章の画面
     --------------------------------------------------------- */
  let storyStep = 0;
  let bodyOpen = false;

  function renderChapter() {
    const ch = chapters()[openChapter];

    $("#chapter-hero").innerHTML = `
      <span class="chapter-hero__eyebrow">${esc(ch.month)} ／ 第${openChapter + 1}章</span>
      <h2 class="chapter-hero__title"><span class="ic">${ch.icon}</span>${esc(ch.title)}</h2>
      <p class="chapter-hero__world">${esc(ch.world)}</p>`;

    renderStory();

    $("#learn-list").innerHTML = ch.learn.map((l) => `
      <div class="learn-item">
        <span class="learn-item__block">${esc(l.block)}</span>
        <span class="learn-item__why">${esc(l.why)}</span>
      </div>`).join("");

    renderMissionList();

    const st = chState(openChapter);
    $("#challenge").innerHTML = `
      <span class="challenge__label">CHALLENGE</span>
      <p style="margin:0 0 1em">${esc(ch.challenge)}</p>
      <button class="btn ${st.challenge ? "" : "btn--main"}" id="challenge-btn">
        ${st.challenge ? "✓ チャレンジ達成ずみ" : "チャレンジできた！"}
      </button>`;
    $("#challenge-btn").addEventListener("click", () => {
      const s = chState(openChapter);
      s.challenge = !s.challenge;
      save();
      renderChapter();
    });
  }

  function renderStory() {
    const ch = chapters()[openChapter];
    const shown = ch.story.slice(0, storyStep + 1);
    const last = storyStep >= ch.story.length - 1;

    $("#story").innerHTML = `
      <div class="story__text">
        ${shown.map((p, i) => `<p class="${i === storyStep ? "is-new" : ""}">${esc(p)}</p>`).join("")}
      </div>
      <div class="story__foot">
        <span class="story__count">${storyStep + 1} / ${ch.story.length}</span>
        <button class="btn ${last ? "btn--main" : ""}" id="story-next">
          ${last ? "ミッションへすすむ" : "つぎへ ▶"}
        </button>
      </div>`;

    $("#story-next").addEventListener("click", () => {
      if (storyStep < ch.story.length - 1) {
        storyStep++;
        renderStory();
      } else {
        bodyOpen = true;
        renderStory();
        $("#chapter-body").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    $("#chapter-body").hidden = !bodyOpen;
  }

  function renderMissionList() {
    const ch = chapters()[openChapter];
    const st = chState(openChapter);

    $("#mission-list").innerHTML = ch.missions.map((m, i) => `
      <button class="mission-row ${st.missions[i] ? "is-done" : ""}" data-m="${i}">
        <span class="mission-row__no">${String(i + 1).padStart(2, "0")}</span>
        <span>
          <span class="mission-row__title">${esc(m.title)}</span><br>
          <span class="mission-row__goal">${esc(m.goal)}</span>
        </span>
        <span class="mission-row__check">${st.missions[i] ? "✓" : "○"}</span>
      </button>`).join("");

    $$("#mission-list .mission-row").forEach((b) => {
      b.addEventListener("click", () => {
        openMission = Number(b.dataset.m);
        hintStep = 0;
        showAnswer = false;
        go("mission");
      });
    });

    // クリアずみの表示
    const zone = $("#chapter-clear-zone");
    if (isCleared(openChapter)) {
      const a = ch.award;
      zone.innerHTML = `
        <div class="frame frame--corner panel-block" style="text-align:center">
          <div style="font-size:3rem;line-height:1.2">${a.icon}</div>
          <h3 style="margin:.3em 0">${esc(a.name)} 獲得ずみ</h3>
          <p style="margin:0">${esc(a.text)}</p>
        </div>`;
    } else {
      zone.innerHTML = "";
    }
  }

  /* ---------------------------------------------------------
     ミッション詳細
     --------------------------------------------------------- */
  let hintStep = 0;      // 何個ヒントを見たか
  let showAnswer = false;

  function renderMission() {
    const ch = chapters()[openChapter];
    const m = ch.missions[openMission];
    const st = chState(openChapter);

    $("#mission-head").innerHTML = `
      <span class="mission-head__no">MISSION ${String(openMission + 1).padStart(2, "0")}</span>
      <h2 class="mission-head__title">${esc(m.title)}</h2>
      <p class="mission-head__goal">${esc(m.goal)}</p>`;

    // ヒント
    let html = "";
    for (let i = 0; i < hintStep; i++) {
      html += `
        <div class="hint-card">
          <span class="hint-card__label">HINT ${i + 1}</span>
          ${esc(m.hints[i])}
        </div>`;
    }
    if (showAnswer) {
      html += `
        <div class="hint-card hint-card--answer">
          <span class="hint-card__label">${state.course === "advance" ? "考えかた" : "こたえ"}</span>
          ${esc(m.answer)}
        </div>`;
    }
    $("#hint-zone").innerHTML = html;

    // ヒントのボタン
    const acts = [];
    if (hintStep < m.hints.length) {
      acts.push(`<button class="btn" id="hint-more">ヒントを見る（${hintStep + 1}/${m.hints.length}）</button>`);
    }
    if (hintStep >= m.hints.length && !showAnswer && !state.opts.hideAnswer) {
      acts.push(`<button class="btn" id="hint-answer">${state.course === "advance" ? "考えかたを見る" : "こたえを見る"}</button>`);
    }
    $("#hint-actions").innerHTML = acts.join("");

    if ($("#hint-more")) $("#hint-more").addEventListener("click", () => { hintStep++; renderMission(); });
    if ($("#hint-answer")) $("#hint-answer").addEventListener("click", () => { showAnswer = true; renderMission(); });

    // 下のボタン
    const done = st.missions[openMission];
    $("#mission-foot").innerHTML = `
      <button class="btn ${done ? "" : "btn--main"}" id="mission-done">
        ${done ? "✓ クリアずみ（取り消す）" : "できた！"}
      </button>
      <a class="btn" href="${esc(scratchUrl())}" target="_blank" rel="noopener">Scratchで作る ↗</a>
      ${openMission < ch.missions.length - 1
        ? `<button class="btn btn--ghost" id="mission-next">つぎのミッション →</button>` : ""}`;

    $("#mission-done").addEventListener("click", onMissionDone);
    if ($("#mission-next")) {
      $("#mission-next").addEventListener("click", () => {
        openMission++;
        hintStep = 0;
        showAnswer = false;
        renderMission();
        window.scrollTo({ top: 0 });
      });
    }
  }

  function onMissionDone() {
    const st = chState(openChapter);
    const wasCleared = isCleared(openChapter);
    st.missions[openMission] = !st.missions[openMission];
    save();

    if (!wasCleared && isCleared(openChapter)) {
      celebrate();
    } else {
      renderMission();
    }
  }

  /* ---------------------------------------------------------
     クリア演出 → 授賞演出
     --------------------------------------------------------- */
  function celebrate() {
    showOverlay({
      banner: "🎉 QUEST CLEAR!",
      icon: chapters()[openChapter].icon,
      name: "第" + (openChapter + 1) + "章 " + chapters()[openChapter].title,
      text: "すべてのミッションを クリアした！",
      onClose: giveAward
    });
  }

  function giveAward() {
    const ch = chapters()[openChapter];
    const got = state.awards[state.course];
    if (!got.includes(openChapter)) {
      got.push(openChapter);
      save();
    }
    sparkle();
    showOverlay({
      banner: "AWARD GET!",
      icon: ch.award.icon,
      name: ch.award.name,
      text: ch.award.text,
      onClose: () => go("map")
    });
  }

  let overlayClose = null;

  function showOverlay(o) {
    $("#ov-banner").textContent = o.banner;
    $("#ov-icon").textContent = o.icon;
    $("#ov-name").textContent = o.name;
    $("#ov-text").textContent = o.text;
    $("#overlay").classList.add("is-open");
    overlayClose = o.onClose || null;
    $("#ov-close").focus();
  }

  $("#ov-close").addEventListener("click", () => {
    $("#overlay").classList.remove("is-open");
    const fn = overlayClose;
    overlayClose = null;
    if (fn) fn();
  });

  function sparkle() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = $("#sparks");
    const colors = ["#f2c14e", "#86a9ff", "#6ddba0", "#ff8db4"];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.style.left = Math.random() * 100 + "vw";
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      s.style.animationDelay = (Math.random() * 0.6) + "s";
      box.appendChild(s);
      setTimeout(() => s.remove(), 4200);
    }
  }

  /* ---------------------------------------------------------
     トロフィー
     --------------------------------------------------------- */
  function renderAwards() {
    const c = course();
    const got = state.awards[c.id];
    $("#awards-sub").textContent = c.name + " ／ " + got.length + " / " + c.chapters.length + " 個";

    $("#award-grid").innerHTML = c.chapters.map((ch, i) => {
      const has = got.includes(i);
      return `
        <div class="award-cell ${has ? "is-got" : "is-locked"}">
          <span class="award-cell__icon">${has ? ch.award.icon : ""}</span>
          <span class="award-cell__name">${has ? esc(ch.award.name) : "第" + (i + 1) + "章"}</span>
          <span class="award-cell__text">${has ? esc(ch.award.text) : "まだ ひらいていない"}</span>
        </div>`;
    }).join("");

    $("#special-grid").innerHTML = SPECIAL_AWARDS.map((a) => {
      const n = state.special.filter((s) => s.id === a.id).length;
      return `
        <div class="award-cell ${n ? "is-got" : "is-locked"}">
          <span class="award-cell__icon">${n ? a.icon : ""}</span>
          <span class="award-cell__name">${esc(a.name)}${n > 1 ? " ×" + n : ""}</span>
          <span class="award-cell__text">${n ? esc(a.text) : "まだ もらっていない"}</span>
        </div>`;
    }).join("");
  }

  /* ---------------------------------------------------------
     プロフィール
     --------------------------------------------------------- */
  function renderProfile() {
    const c = course();
    $("#profile-sub").textContent = "いまのコース：" + c.name;
    $("#player-name").value = state.name;

    const totalMissions = COURSES.reduce((n, co) =>
      n + co.chapters.reduce((m, ch, i) =>
        m + chState(i, co.id).missions.filter(Boolean).length, 0), 0);
    const totalChallenge = COURSES.reduce((n, co) =>
      n + co.chapters.reduce((m, ch, i) => m + (chState(i, co.id).challenge ? 1 : 0), 0), 0);
    const totalAwards = state.awards.basic.length + state.awards.advance.length + state.special.length;

    const stats = [
      ["クリアした章", clearedCount("basic") + clearedCount("advance")],
      ["ミッション", totalMissions],
      ["チャレンジ", totalChallenge],
      ["トロフィー", totalAwards]
    ];
    $("#stat-grid").innerHTML = stats.map((s) => `
      <div class="stat"><div class="stat__num">${s[1]}</div><div class="stat__label">${s[0]}</div></div>
    `).join("");

    const rows = [];
    COURSES.forEach((co) => {
      co.chapters.forEach((ch, i) => {
        if (isCleared(i, co.id)) rows.push(`${co.name}　${ch.icon}　第${i + 1}章 ${esc(ch.title)}`);
      });
    });
    $("#cleared-list").innerHTML = rows.length
      ? rows.map((r) => `<div style="padding:.35em 0;border-bottom:1px dashed var(--frame)">${r}</div>`).join("")
      : `<p style="margin:0;color:var(--ink-dim)">まだクリアした章はありません。マップから第1章をひらいてみよう。</p>`;

    $("#special-select").innerHTML = SPECIAL_AWARDS
      .map((a) => `<option value="${a.id}">${a.icon}　${esc(a.name)}</option>`).join("");
  }

  $("#player-name").addEventListener("input", (e) => {
    state.name = e.target.value;
    save();
  });

  $("#special-give").addEventListener("click", () => {
    const id = $("#special-select").value;
    const a = SPECIAL_AWARDS.find((x) => x.id === id);
    state.special.push({ id: id, date: new Date().toISOString().slice(0, 10) });
    save();
    sparkle();
    showOverlay({
      banner: "AWARD GET!",
      icon: a.icon,
      name: a.name,
      text: a.text,
      onClose: () => renderProfile()
    });
  });

  /* ---------------------------------------------------------
     設定
     --------------------------------------------------------- */
  function renderSettings() {
    $("#opt-unlock").checked = state.opts.unlockAll;
    $("#opt-hideanswer").checked = state.opts.hideAnswer;
    $("#opt-scratch").value = state.opts.scratchUrl;
  }

  $("#opt-unlock").addEventListener("change", (e) => {
    state.opts.unlockAll = e.target.checked; save();
  });
  $("#opt-hideanswer").addEventListener("change", (e) => {
    state.opts.hideAnswer = e.target.checked; save();
  });
  $("#opt-scratch").addEventListener("input", (e) => {
    state.opts.scratchUrl = e.target.value.trim(); save();
  });

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scratch-quest-" + (state.name || "record") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("#import-btn").addEventListener("click", () => $("#import-file").click());

  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        state = Object.assign(defaultState(), JSON.parse(r.result));
        save();
        setCourse(state.course);
        go("map");
      } catch (err) {
        alert("このファイルは読みこめませんでした。書きだしたJSONファイルをえらんでください。");
      }
    };
    r.readAsText(file);
    e.target.value = "";
  });

  $("#reset-btn").addEventListener("click", () => {
    if (!confirm("すべての記録を消します。もとにもどせません。よろしいですか？")) return;
    state = defaultState();
    save();
    setCourse("basic");
    go("title");
  });

  /* ---------------------------------------------------------
     起動
     --------------------------------------------------------- */
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  $("#mission-back").addEventListener("click", () => go("chapter"));

  setCourse(state.course);
  const totalDone = clearedCount("basic") + clearedCount("advance");
  $("#title-foot").textContent = totalDone
    ? (state.name ? state.name + " ── " : "") + "これまでに " + totalDone + " 章クリア"
    : "";

  go("title");
})();
