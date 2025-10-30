/*********************************************************
 * グローバル状態
 *********************************************************/
let questionList = [];       // 読み込んだ既存問題 (data.csv)
const questionMap = {};     // key: question_id → 問題オブジェクト
const loadedFileNames = []; // 読み込んだファイル名の表示用

let historyList = [];        // 出題履歴 (history.csv)
let newQuestions = [];       // 新規・改訂で追加された問題 (new.csv 出力用)

let currentDetailId = null;  // 一覧で現在選んでいる問題ID
let currentEditId = null;    // 編集対象となっている元問題ID
let currentMode = "new";     // "new" | "edit" | "revise"

// マスタ
let templates = [];
let speciesList = [];
let keywordsList = [];
let domainsList = [];
let appConfig = {};

/*********************************************************
 * 初期化
 *********************************************************/
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadStaticData();
  initFormBehavior();
  initIO();
  initSearchBehavior();
  // 閉じるボタンの追加
  const closeBtn = document.getElementById("closeDetailBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("detailArea").classList.add("hidden");
    });
  }
});

/*********************************************************
 * タブ切り替え
 *********************************************************/
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // タブの見た目切り替え
      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(sec => sec.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");

      // ▼ 追加：統計タブなら統計を更新
      if (btn.dataset.tab === "tab-stats" && typeof renderStatsView === "function") {
        renderStatsView();
      }
    });
  });
}

/*********************************************************
 * マスタデータ読み込み
 *********************************************************/
async function loadStaticData() {
  async function loadJSON(url) {
    try {
      const res = await fetch(`./data/${url}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn("Failed to load", url, e);
      return null;
    }
  }

  const [tpl, kw, dm, sp, cfg] = await Promise.all([
    loadJSON("templates.json"),
    loadJSON("keywords.json"),
    loadJSON("domains.json"),
    loadJSON("species.json"),
    loadJSON("config.json")
  ]);

  templates = Array.isArray(tpl) ? tpl : [];
  keywordsList = Array.isArray(kw) ? kw : [];
  if (dm && Array.isArray(dm.domains)) {
    domainsList = dm.domains;
  } else {
    domainsList = [];
  }
  speciesList = Array.isArray(sp) ? sp : [];
  appConfig = cfg || {};

  if (appConfig.appName) {
    document.title = appConfig.appName;
  }

  populateTemplateSelect();
  populateSpeciesSelects();
  populateDomainSelects();
  initKeywordSuggest();
}

/*********************************************************
 * ドメイン（領域）セレクトに反映
 *********************************************************/
function populateDomainSelects() {
  const domain1 = document.getElementById("domain1");
  const domain2 = document.getElementById("domain2");
  const domainFilter = document.getElementById("domainFilter");

  resetSelectKeepFirst(domain1);
  resetSelectKeepFirst(domain2);
  resetSelectKeepFirst(domainFilter);

  domainsList.forEach(d => {
    const opt1 = document.createElement("option");
    opt1.value = d;
    opt1.textContent = d;
    domain1.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = d;
    opt2.textContent = d;
    domain2.appendChild(opt2);

    const optF = document.createElement("option");
    optF.value = d;
    optF.textContent = d;
    domainFilter.appendChild(optF);
  });
}

function resetSelectKeepFirst(sel) {
  if (!sel) return;
  const first = sel.querySelector("option");
  sel.innerHTML = "";
  if (first) sel.appendChild(first);
}

/*********************************************************
 * テンプレート（定型文）セレクト
 *********************************************************/
function populateTemplateSelect() {
  const tmplSel = document.getElementById("templateSelect");
  if (!tmplSel) return;
  tmplSel.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());

  templates.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    opt.dataset.insertText = t.insertText;
    opt.dataset.answerMode = t.answerMode;
    tmplSel.appendChild(opt);
  });
}

/*********************************************************
 * 学名セレクト
 *********************************************************/
function populateSpeciesSelects() {
  const selects = document.querySelectorAll(".speciesSelect");
  selects.forEach(sel => {
    // 先頭以外クリア
    sel.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());
    speciesList.forEach(sp => {
      const opt = document.createElement("option");
      opt.innerHTML = sp;
      opt.value = sp;
      sel.appendChild(opt);
    });

    sel.addEventListener("change", e => {
      const htmlToInsert = e.target.value;
      const targetId = e.target.getAttribute("data-target");
      if (htmlToInsert && targetId) {
        const targetEl = document.getElementById(targetId);
        insertHTMLAtCursor(targetEl, htmlToInsert);
      }
      sel.value = "";
    });
  });
}

/*********************************************************
 * キーワードサジェスト
 *********************************************************/
function initKeywordSuggest() {
  const kwInput = document.getElementById("keywordInput");
  const kwBox = document.getElementById("keywordSuggest");
  if (!kwInput || !kwBox) return;

  kwInput.addEventListener("input", () => {
    const text = kwInput.value.toLowerCase().trim();
    kwBox.innerHTML = "";
    if (!text) return;
    const candidates = keywordsList
      .filter(k => k.toLowerCase().includes(text))
      .slice(0, 10);
    candidates.forEach(k => {
      const div = document.createElement("div");
      div.className = "suggest-item";
      div.textContent = k;
      div.addEventListener("click", () => {
        addKeywordToInput(k);
      });
      kwBox.appendChild(div);
    });
  });
}

function addKeywordToInput(word) {
  const kwInput = document.getElementById("keywordInput");
  const kwBox = document.getElementById("keywordSuggest");
  const cur = kwInput.value.trim();
  if (!cur) {
    kwInput.value = word;
  } else {
    const parts = cur.split(",").map(s => s.trim()).filter(Boolean);
    if (!parts.includes(word)) {
      parts.push(word);
      kwInput.value = parts.join(", ");
    }
  }
  kwBox.innerHTML = "";
}

/*********************************************************
 * 入出力（CSV読み込み、エクスポート）
 *********************************************************/
function initIO() {
  const csvInput = document.getElementById("csvInput");
  const histInput = document.getElementById("historyFile");
  const dlNewBtn = document.getElementById("downloadNewBtn");
  const dlUpdBtn = document.getElementById("downloadUpdateBtn");

  if (csvInput) {
    csvInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      readCSV(file, "question");
    });
  }

  if (histInput) {
    histInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      readCSV(file, "history");
    });
  }

  if (dlNewBtn) {
    dlNewBtn.addEventListener("click", () => {
      if (!newQuestions.length) {
        alert("新規・改訂済みの保存内容がありません");
        return;
      }
      exportCSV(newQuestions, "new.csv");
    });
  }

  if (dlUpdBtn) {
    dlUpdBtn.addEventListener("click", () => {
      if (!questionList.length) {
        alert("問題データがありません");
        return;
      }
      exportCSV(questionList, "new_update.csv");
    });
  }
}

/*********************************************************
 * CSV パース / エクスポート
 *********************************************************/
function readCSV(file, type) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const rows = parseCSV(text);
    if (!rows.length) return;

    const header = rows[0];
    const dataRows = rows.slice(1);

    if (type === "question") {
      // 1行ずつマージしていく
      dataRows.forEach(r => {
        const raw = rowToObj(r, header);

        // 列名のゆらぎ吸収（ここで標準形にそろえる）
        const normalized = {
          question_id: raw.question_id || raw.ID || raw["問題ID"] || "",
          case_id: raw.case_id || raw["症例ID"] || "",
          case_text: raw.case_text || raw["症例文"] || "",
          title: raw.title || raw["タイトル"] || "",
          department: raw.department || raw["教室"] || "",
          author: raw.author || raw["作問者"] || "",
          language: raw.language || raw["言語"] || "",
          difficulty: raw.difficulty || raw["難易度"] || "",
          domain1: raw.domain1 || raw["領域1"] || "",
          domain2: raw.domain2 || raw["領域2"] || "",
          active: raw.active || raw["active"] || raw["状態"] || "",
          tag: raw.tag || raw["タグ"] || "",
          question_text: raw.question_text || raw["問題文"] || "",
          choice_a: raw.choice_a || raw["選択肢1"] || "",
          choice_b: raw.choice_b || raw["選択肢2"] || "",
          choice_c: raw.choice_c || raw["選択肢3"] || "",
          choice_d: raw.choice_d || raw["選択肢4"] || "",
          choice_e: raw.choice_e || raw["選択肢5"] || "",
          correct: raw.correct || raw["正解"] || "",
          keywords: raw.keywords || raw["キーワード"] || "",
          image_file: raw.image_file || raw["画像"] || "",
          comment: raw.comment || raw["自由コメント"] || "",
          explanation: raw.explanation || raw["解説"] || "",
          created_at: raw.created_at || raw["作成日時"] || "",
          updated_at: raw.updated_at || raw["最終更新日時"] || "",
          revision_note: raw.revision_note || raw["修正メモ"] || ""
        };

        const id = normalized.question_id;
        if (!id) {
          // IDがない行はスキップ
          return;
        }

        // すでに同じIDがあるか
        if (questionMap[id]) {
          const current = questionMap[id];
          // 空でない項目だけ上書き（後勝ち）
          Object.keys(normalized).forEach(key => {
            const val = normalized[key];
            if (val !== "" && val != null) {
              current[key] = val;
            }
          });
          // どのファイルから来たか残す
          current._source = file.name || current._source || "";
        } else {
          // 新規IDならそのまま入れる
          normalized._source = file.name || "";
          questionMap[id] = normalized;
        }
      });

      // 表示用リストに変換
      questionList = Object.values(questionMap);

      renderTable(questionList);
      if (typeof renderStatsView === "function") {
        renderStatsView();
      }
    }

    else if (type === "history") {
      historyList = dataRows.map(r => rowToObj(r, header));

      // ▼ 追加：履歴読み込み後も統計再描画しておく（必要なら）
      if (typeof renderStatsView === "function") {
        renderStatsView();
      }
    }

    alert(
      type === "question"
        ? (file.name ? `${file.name} を読み込みました` : "問題データを読み込みました")
        : "履歴データを読み込みました"
    );
  };
  reader.readAsText(file, "utf-8");
}

// 単純なCSVパーサ（引用対応）
function parseCSV(text) {
  const rows = [];
  let cur = [];
  let val = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];

    if (c === '"' && inQuotes && next === '"') {
      val += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      cur.push(val);
      val = "";
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (val !== "" || cur.length > 0) {
        cur.push(val);
        rows.push(cur);
        cur = [];
        val = "";
      }
    } else {
      val += c;
    }
  }
  if (val !== "" || cur.length > 0) {
    cur.push(val);
    rows.push(cur);
  }
  return rows;
}

function rowToObj(row, header) {
  const obj = {};
  header.forEach((key, idx) => {
    obj[key.trim()] = (row[idx] || "").trim();
  });
  return obj;
}

function exportCSV(dataArray, filename) {
  if (!dataArray.length) {
    alert("出力対象がありません");
    return;
  }
  const headers = Object.keys(dataArray[0]);
  const lines = [headers.join(",")];
  dataArray.forEach(item => {
    const row = headers.map(h => csvEscape(item[h] ?? ""));
    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  alert(filename + " を出力しました");
}

function csvEscape(val) {
  const str = String(val);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/*********************************************************
 * 検索・一覧・詳細
 *********************************************************/
function initSearchBehavior() {
  const searchBtn = document.getElementById("searchBtn");
  const clearBtn = document.getElementById("clearFilterBtn");
  const tbody = document.querySelector("#questionTable tbody");
  const editBtn = document.getElementById("editBtn");
  const dupBtn = document.getElementById("duplicateBtn");

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      renderFilteredTable();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      setValRaw("searchInput", "");
      setValRaw("domainFilter", "");
      setValRaw("langFilter", "");
      setValRaw("difficultyFilter", "");
      setValRaw("activeFilter", "");
      renderFilteredTable();
    });
  }

  if (tbody) {
    tbody.addEventListener("click", e => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const qid = tr.dataset.qid;
      showDetail(qid);
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      if (!currentDetailId) {
        alert("詳細表示中の問題がありません");
        return;
      }
      loadForEdit(currentDetailId, "edit");
    });
  }

  if (dupBtn) {
    dupBtn.addEventListener("click", () => {
      if (!currentDetailId) {
        alert("詳細表示中の問題がありません");
        return;
      }
      loadForEdit(currentDetailId, "revise");
    });
  }
}

function renderFilteredTable() {
  const kw = getValRaw("searchInput").toLowerCase();
  const dFilter = getValRaw("domainFilter");
  const lang = getValRaw("langFilter");
  const diff = getValRaw("difficultyFilter");
  const actv = getValRaw("activeFilter");

  const filtered = questionList.filter(q => {
    if (kw) {
      const blob = [
        q.title || "",
        q.question_text || "",
        q.keywords || "",
        q.case_text || ""
      ].join(" ").toLowerCase();
      if (!blob.includes(kw)) return false;
    }
    if (dFilter && q.domain1 !== dFilter && q.domain2 !== dFilter) return false;
    if (lang && q.language !== lang) return false;
    if (diff && q.difficulty !== diff) return false;
    if (actv && q.active !== actv) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(list) {
  const tbody = document.querySelector("#questionTable tbody");
  tbody.innerHTML = "";

  list.forEach(q => {
    const tr = document.createElement("tr");
    tr.dataset.qid = q.question_id || "";

    // 領域1/2のまとめ
    const domainCombo = [q.domain1 || "", q.domain2 || ""]
      .filter(Boolean)
      .join(" / ");

    // 問題文は長いので先頭50-60文字だけ抜粋（HTMLタグは落とす）
    const strippedQuestion = (q.question_text || "")
      .replace(/<[^>]+>/g, "")           // タグ除去
      .replace(/\s+/g, " ")              // 改行等まとめ
      .trim()
      .slice(0, 60);

    tr.innerHTML = `
      <td>${escapeHTML(q.question_id)}</td>
      <td>${escapeHTML(q.case_id || "")}</td>
      <td>${escapeHTML(q.title || "")}</td>
      <td>${escapeHTML(domainCombo)}</td>
      <td>${escapeHTML(q.department || "")}</td>
      <td>${escapeHTML(q.difficulty || "")}</td>
      <td>${escapeHTML(q.language || "")}</td>
      <td>${escapeHTML(q.active || "")}</td>
      <td>${escapeHTML(strippedQuestion)}</td>
    `;
    tbody.appendChild(tr);
  });
}


/*********************************************************
 * 詳細表示: 連問 / 履歴 / 出題履歴の可視化
 *********************************************************/
function showDetail(qid) {
  const q = questionList.find(x => x.question_id === qid);
  if (!q) return;
  currentDetailId = qid;

  // ===== 単問・連問・関連ID =====
  let caseIdLabel = "";
  let relationLabel = "";
  let relatedIdsLabel = "";

  const cid = q.case_id || ""; // 空は症例なし
  if (!cid) {
    caseIdLabel = "非該当";
    relationLabel = "単問（症例なし）";
    relatedIdsLabel = q.question_id;
  } else {
    const sameCaseGroup = questionList
      .filter(item => (item.case_id || "") === cid)
      .map(item => item.question_id);

    caseIdLabel = cid;

    if (sameCaseGroup.length === 1) {
      relationLabel = "単問（症例あり）";
      relatedIdsLabel = sameCaseGroup[0];
    } else {
      relationLabel = "連問";
      relatedIdsLabel = sameCaseGroup.join("、");
    }
  }

  // ===== 改訂履歴 (R1/R2...) =====
  const baseId = q.question_id.replace(/R\d+$/,"");
  const revisionGroup = questionList
    .filter(item => {
      const b = (item.question_id || "").replace(/R\d+$/,"");
      return b === baseId;
    })
    .map(item => {
      return `${item.question_id}${item.active ? ` (active:${item.active})` : ""}`;
    });

  const revisionLabel = revisionGroup.join("、");

  // ===== 出題履歴(history.csv) =====
  const hist = historyList
    .filter(h => h.question_id === qid)
    .map(h => {
      return [
        h.exam_name || "",
        h.exam_date || "",
        h.question_number || "",
        h.correct_rate || ""
      ].join(" / ");
    })
    .join("\n");

  // ===== 画像表示 =====
  const imgHtml = q.image_file
    ? `<div><strong>画像:</strong><br><img src="./data/images/${escapeHTML(q.image_file)}" style="max-width:200px;max-height:200px;border:1px solid #ccc;border-radius:4px;"></div>`
    : `<div><strong>画像:</strong>（なし）</div>`;

  const detailDiv = document.getElementById("questionDetail");
  detailDiv.innerHTML = `
    <div><strong>ID:</strong> ${escapeHTML(q.question_id)}</div>
    <div><strong>症例ID:</strong> ${escapeHTML(caseIdLabel)}</div>
    <div><strong>単問・連問:</strong> ${escapeHTML(relationLabel)}（${escapeHTML(relatedIdsLabel)}）</div>
    <div><strong>履歴:</strong> ${escapeHTML(revisionLabel || "(なし)")}</div>

    <hr>

    <div><strong>タイトル:</strong> ${escapeHTML(q.title)}</div>
    <div><strong>教室 / 作問者:</strong> ${escapeHTML(q.department)} / ${escapeHTML(q.author)}</div>
    <div><strong>難易度 / 言語 / active:</strong> Lv${escapeHTML(q.difficulty)} / ${escapeHTML(q.language)} / ${escapeHTML(q.active)}</div>
    <div><strong>領域1 / 領域2:</strong> ${escapeHTML(q.domain1)} / ${escapeHTML(q.domain2)}</div>
    <div><strong>タグ:</strong> ${escapeHTML(q.tag || "")}</div>

    <hr>

    <div><strong>症例本文:</strong><br>${q.case_text || ""}</div>
    <div><strong>問題文:</strong><br>${q.question_text || ""}</div>

    <div><strong>選択肢:</strong><br>
      <div><b>a.</b> ${q.choice_a || ""}</div>
      <div><b>b.</b> ${q.choice_b || ""}</div>
      <div><b>c.</b> ${q.choice_c || ""}</div>
      <div><b>d.</b> ${q.choice_d || ""}</div>
      <div><b>e.</b> ${q.choice_e || ""}</div>
    </div>

    <div><strong>正解:</strong> ${escapeHTML(q.correct || "")}</div>
    <div><strong>キーワード:</strong> ${escapeHTML(q.keywords || "")}</div>
    ${imgHtml}

    <hr>

    <div><strong>自由コメント（教員用）:</strong><br>${q.comment || ""}</div>
    <div><strong>解説（学生向け）:</strong><br>${q.explanation || ""}</div>

    <hr>

    <div><strong>作成日時:</strong> ${escapeHTML(q.created_at || "")}</div>
    <div><strong>最終更新日時:</strong> ${escapeHTML(q.updated_at || "")}</div>
    <div><strong>修正メモ:</strong> ${escapeHTML(q.revision_note || "")}</div>

    <hr>

    <div><strong>出題履歴:</strong><pre>${escapeHTML(hist || "(なし)")}</pre></div>
  `;

  document.getElementById("detailArea").classList.remove("hidden");
  // 詳細エリアを自動スクロール表示
  const detailArea = document.getElementById("detailArea");
  detailArea.classList.remove("hidden");
  window.scrollTo({ top: detailArea.offsetTop - 50, behavior: "smooth" });
}

/*********************************************************
 * 作問フォームのイベントと動作
 *********************************************************/
function initFormBehavior() {
  // モード選択（new / edit / revise）
  document.querySelectorAll('input[name="editMode"]').forEach(radio => {
    radio.addEventListener("change", () => {
      currentMode = radio.value; // "new" | "edit" | "revise"

      if (currentMode === "new") {
        currentEditId = null;
        // 完全に新規扱い
        setFormLocked(false);
        autoSetTimestamps(true);
      } else if (currentMode === "edit") {
        // 編集時は loadForEdit() でfillされる想定
        setFormLocked(true);
      } else if (currentMode === "revise") {
        // reviseは原則「新しいIDで保存する」のでロックは基本解除
        setFormLocked(false);
        autoSetTimestamps(true);
      }
    });
  });

  // ロック解除ボタン
  const unlockBtn = document.getElementById("unlockBtn");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", () => {
      if (!confirm("過去問を直接書き換えます。推奨されません。本当にロックを解除しますか？")) {
        return;
      }
      setFormLocked(false);
    });
  }

  // リッチテキストボタン(B/I/U)
  document.addEventListener("click", e => {
    if (!e.target.classList.contains("rt-btn")) return;
    const cmd = e.target.dataset.cmd;
    const targetId = e.target.dataset.target;
    if (!cmd || !targetId) return;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    targetEl.focus();
    document.execCommand(cmd, false, null);
  });

  // 定型文挿入
  const insertTplBtn = document.getElementById("insertTemplateBtn");
  if (insertTplBtn) {
    insertTplBtn.addEventListener("click", () => {
      const sel = document.getElementById("templateSelect");
      const targetId = sel.getAttribute("data-target");
      const ed = document.getElementById(targetId);
      if (!ed) return;
      const opt = sel.options[sel.selectedIndex];
      const htmlToInsert = opt.dataset.insertText || "";
      if (htmlToInsert) {
        insertHTMLAtCursor(ed, htmlToInsert);
      }
      sel.value = "";
    });
  }

  // 画像プレビュー
  const imgInput = document.getElementById("imageFile");
  if (imgInput) {
    imgInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById("imagePreview");
      preview.innerHTML = "";
      if (file) {
        const url = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "200px";
        img.style.maxHeight = "200px";
        img.style.border = "1px solid #ccc";
        img.style.borderRadius = "4px";
        preview.appendChild(img);
        // CSVにはファイル名だけ保存
        preview.dataset.filename = file.name;
      } else {
        delete preview.dataset.filename;
      }
    });
  }

  // 保存（新規・更新）ボタン
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (currentMode === "edit") {
        updateExistingQuestionWithLockRules();
      } else {
        saveNewOrRevisedQuestionWithIdCheck();
      }
    });
  }

  // 「新しい問題としてリセット」ボタン
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      forceNewModeReset();
    });
  }

  // 初期タイムスタンプはnew扱いで
  autoSetTimestamps(true);
}

/*********************************************************
 * HTML挿入とサニタイズ
 *********************************************************/
function insertHTMLAtCursor(targetEl, htmlString) {
  if (!targetEl) return;
  targetEl.focus();
  // ここでidを拾って渡す
  const fieldId = targetEl.id;
  const safe = sanitizeHTML(htmlString, fieldId);
  document.execCommand("insertHTML", false, safe);
}

// 許可タグのみ (b,strong,i,em,u)
// ===== sanitizeHTML を差し替え =====
function sanitizeHTML(html, fieldId) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT, null);
  const toStripAttrs = [];
  const toUnwrap = [];

  // フィールドごとに許可タグを切り替える
  let allowed = [];
  if (["commentField", "explanationField"].includes(fieldId)) {
    allowed = ["b", "strong", "i", "em", "u"];  // ← 教員コメント・学生解説のみ装飾OK
  } else {
    allowed = [];  // ← それ以外は装飾禁止（完全プレーンテキスト）
  }

  while (walker.nextNode()) {
    const el = walker.currentNode;
    const tag = el.tagName.toLowerCase();
    if (!allowed.includes(tag)) {
      toUnwrap.push(el);
    } else {
      for (let i = el.attributes.length - 1; i >= 0; i--) {
        toStripAttrs.push({ node: el, name: el.attributes[i].name });
      }
    }
  }

  toStripAttrs.forEach(({ node, name }) => node.removeAttribute(name));
  toUnwrap.forEach(node => {
    const parent = node.parentNode;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  });

  return tmp.innerHTML;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

/*********************************************************
 * タイムスタンプ
 *********************************************************/
function nowISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function autoSetTimestamps(isNew) {
  const createdAt = document.getElementById("createdAt");
  const updatedAt = document.getElementById("updatedAt");
  if (isNew && createdAt) {
    createdAt.value = nowISO();
  }
  if (updatedAt) {
    updatedAt.value = nowISO();
  }
}

/*********************************************************
 * 保存ロジック
 *********************************************************/

/* new / revise 用：重複IDは保存拒否 */
function saveNewOrRevisedQuestionWithIdCheck() {
  const qid = getValRaw("questionId");
  if (!qid) {
    alert("問題IDは必須です");
    return;
  }

  // ID衝突禁止
  const already = questionList.some(q => q.question_id === qid);
  if (already) {
    alert("この問題IDは既に存在します。複製・改訂の場合は末尾にR1など新しいIDを付けてください。");
    return;
  }

  // タイムスタンプ更新
  autoSetTimestamps(!currentEditId);

  const obj = collectFormAsObject();

  // questionListにもpush
  questionList.push(obj);

  // newQuestionsにもpush（new.csv用）
  newQuestions.push(obj);

  renderFilteredTable();
  alert("保存しました（新規または改訂版として登録）");
}

/* edit 用：同一IDへの上書き。ただしロック解除済みのみ */
function updateExistingQuestionWithLockRules() {
  if (!currentEditId) {
    alert("編集中の問題がありません");
    return;
  }
  const target = questionList.find(x => x.question_id === currentEditId);
  if (!target) {
    alert("対象が見つかりません");
    return;
  }

  // ロック中は更新できない
  const formLocked = document.getElementById("questionForm").classList.contains("locked");
  if (formLocked) {
    alert("ロック中のため更新できません。ロック解除後のみ、既存問題を直接更新できます。");
    return;
  }

  // soft領域だけ反映する
  autoSetTimestamps(false);

  target.choice_a = sanitizeHTML(document.getElementById("choiceA").innerHTML.trim());
  target.choice_b = sanitizeHTML(document.getElementById("choiceB").innerHTML.trim());
  target.choice_c = sanitizeHTML(document.getElementById("choiceC").innerHTML.trim());
  target.choice_d = sanitizeHTML(document.getElementById("choiceD").innerHTML.trim());
  target.choice_e = sanitizeHTML(document.getElementById("choiceE").innerHTML.trim());

  target.correct = Array.from(document.querySelectorAll(".correct:checked"))
    .map(c => c.value)
    .join(",");

  target.keywords = getValRaw("keywordInput");

  target.comment = sanitizeHTML(getValRaw("commentField"), "commentField");
  target.explanation = sanitizeHTML(getValRaw("explanationField"), "explanationField");
  target.revision_note = getValRaw("revisionNote");

  // 更新日時だけ更新
  target.updated_at = nowISO();

  renderFilteredTable();
  alert("既存問題を更新しました（new_update.csvに出力してください）");
}

/*********************************************************
 * 編集フォームへのロード (edit / revise)
 *********************************************************/
function loadForEdit(qid, mode) {
  const target = questionList.find(q => q.question_id === qid);
  if (!target) {
    alert("該当IDの問題が見つかりません");
    return;
  }

  currentDetailId = qid;
  currentEditId = qid;
  currentMode = mode || "edit";

  // ラジオ同期
  const radio = document.querySelector(`input[name="editMode"][value="${currentMode}"]`);
  if (radio) radio.checked = true;

  fillForm(target);

  if (currentMode === "edit") {
    // edit: 元問題を直接扱う → hardロックONが基本
    setFormLocked(true);
  } else if (currentMode === "revise") {
    // revise: 複製して新しいIDで保存する → hardロック解除
    setFormLocked(false);
    // revise = 新規扱いなのでタイムスタンプを新規に
    autoSetTimestamps(true);
  }

  // 作問タブに切り替え
  document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(sec => sec.classList.remove("active"));
  document.querySelector('.tab-button[data-tab="tab-create"]').classList.add("active");
  document.getElementById("tab-create").classList.add("active");
}

/*********************************************************
 * フォームにデータを入れる
 *********************************************************/
function fillForm(q) {
  // メタ
  setValRaw("questionId", q.question_id);
  setValRaw("caseId", q.case_id || "");
  setValRaw("author", q.author || "");
  setValRaw("department", q.department || "");
  setValRaw("title", q.title || "");
  setValRaw("language", q.language || "ja");
  setValRaw("difficulty", q.difficulty || "3");
  setValRaw("domain1", q.domain1 || "");
  setValRaw("domain2", q.domain2 || "");
  setValRaw("active", q.active || "true");
  setValRaw("tag", q.tag || "");

  // 症例本文
  setValRaw("caseText", q.case_text || "");

  // 問題文
  const qt = document.getElementById("questionText");
  if (qt) qt.innerHTML = q.question_text || "";

  // 選択肢
  document.getElementById("choiceA").innerHTML = q.choice_a || "";
  document.getElementById("choiceB").innerHTML = q.choice_b || "";
  document.getElementById("choiceC").innerHTML = q.choice_c || "";
  document.getElementById("choiceD").innerHTML = q.choice_d || "";
  document.getElementById("choiceE").innerHTML = q.choice_e || "";

  // 正解
  const ansArr = (q.correct || "").split(",").map(s => s.trim()).filter(Boolean);
  document.querySelectorAll(".correct").forEach(box => {
    box.checked = ansArr.includes(box.value);
  });

  // キーワード
  setValRaw("keywordInput", q.keywords || "");

  // 画像プレビュー
  const preview = document.getElementById("imagePreview");
  const imgInput = document.getElementById("imageFile");
  if (preview) {
    preview.innerHTML = "";
    delete preview.dataset.filename;
    if (q.image_file) {
      const img = document.createElement("img");
      img.src = `./data/images/${q.image_file}`;
      img.style.maxWidth = "200px";
      img.style.maxHeight = "200px";
      img.style.border = "1px solid #ccc";
      img.style.borderRadius = "4px";
      preview.appendChild(img);
      preview.dataset.filename = q.image_file;
    }
  }
  if (imgInput) imgInput.value = "";

  // コメント・解説・修正メモ
  setValRaw("commentField", q.comment || "");
  setValRaw("explanationField", q.explanation || "");
  setValRaw("revisionNote", q.revision_note || "");

  // タイムスタンプ
  setValRaw("createdAt", q.created_at || "");
  setValRaw("updatedAt", q.updated_at || nowISO());
}

/*********************************************************
 * ロック制御
 *********************************************************/
function setFormLocked(locked) {
  const form = document.getElementById("questionForm");
  if (!form) return;

  if (!locked) {
    form.classList.remove("locked");
    form.querySelectorAll("[data-lock]").forEach(el => {
      // hard/soft問わず編集可能に
      if (el.classList.contains("rich-editor")) {
        el.setAttribute("contenteditable", "true");
      } else {
        el.disabled = false;
      }
      el.style.pointerEvents = "";
      el.classList.remove("locked-field");
    });
    return;
  }

  // locked=true: hardだけ触れない / softは触れる
  form.classList.add("locked");
  form.querySelectorAll("[data-lock]").forEach(el => {
    const mode = el.getAttribute("data-lock"); // "hard" | "soft"
    if (mode === "hard") {
      if (el.classList.contains("rich-editor")) {
        el.setAttribute("contenteditable", "false");
      } else {
        el.disabled = true;
      }
      el.style.pointerEvents = "none";
      el.classList.add("locked-field");
    } else {
      // soft
      if (el.classList.contains("rich-editor")) {
        el.setAttribute("contenteditable", "true");
      } else {
        el.disabled = false;
      }
      el.style.pointerEvents = "";
      el.classList.remove("locked-field");
    }
  });
}

/*********************************************************
 * フォーム → オブジェクト化
 *********************************************************/
function collectFormAsObject() {
  // 正解
  const correctAns = Array.from(document.querySelectorAll(".correct:checked"))
    .map(c => c.value)
    .join(",");

  // 画像ファイル名（プレビューに保持）
  const preview = document.getElementById("imagePreview");
  const imageFilename = preview?.dataset?.filename || "";

  return {
    question_id: getValRaw("questionId"),
    case_id: getValRaw("caseId"), // 症例なし単問は空欄でOK
    case_text: getValRaw("caseText"),

    title: getValRaw("title"),
    department: getValRaw("department"),
    author: getValRaw("author"),
    language: getValRaw("language"),
    difficulty: getValRaw("difficulty"),
    domain1: getValRaw("domain1"),
    domain2: getValRaw("domain2"),
    active: getValRaw("active"),
    tag: getValRaw("tag"),

    question_text: sanitizeHTML(document.getElementById("questionText").innerHTML.trim()),
    choice_a: sanitizeHTML(document.getElementById("choiceA").innerHTML.trim()),
    choice_b: sanitizeHTML(document.getElementById("choiceB").innerHTML.trim()),
    choice_c: sanitizeHTML(document.getElementById("choiceC").innerHTML.trim()),
    choice_d: sanitizeHTML(document.getElementById("choiceD").innerHTML.trim()),
    choice_e: sanitizeHTML(document.getElementById("choiceE").innerHTML.trim()),
    correct: correctAns,
    keywords: getValRaw("keywordInput"),

    image_file: imageFilename,
    comment: sanitizeHTML(getValRaw("commentField"), "commentField"),
    explanation: sanitizeHTML(getValRaw("explanationField"), "explanationField"),

    created_at: getValRaw("createdAt") || nowISO(),
    updated_at: getValRaw("updatedAt") || nowISO(),
    revision_note: getValRaw("revisionNote")
  };
}

/*********************************************************
 * 完全リセット（新規作問モードに戻す）
 *********************************************************/
function forceNewModeReset() {
  clearForm();

  // モードをnewに戻す
  currentMode = "new";
  currentEditId = null;
  const newRadio = document.querySelector('input[name="editMode"][value="new"]');
  if (newRadio) newRadio.checked = true;

  // ロック解除状態で新規作成
  setFormLocked(false);

  // タイムスタンプを新規として再セット
  autoSetTimestamps(true);
}

/* 既存のclearFormを強化して完全初期化 */
function clearForm() {
  // フォーム内のinput/select/textareaをリセット
  const form = document.getElementById("questionForm");
  if (form) form.reset();

  // リッチエディタ
  ["questionText","choiceA","choiceB","choiceC","choiceD","choiceE"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  // 正解チェック全部オフ
  document.querySelectorAll(".correct").forEach(cb => cb.checked = false);

  // 画像プレビュー消去
  const preview = document.getElementById("imagePreview");
  if (preview) {
    preview.innerHTML = "";
    delete preview.dataset.filename;
  }

  // タイムスタンプ系
  setValRaw("createdAt", "");
  setValRaw("updatedAt", "");

  // コメント等
  setValRaw("commentField", "");
  setValRaw("explanationField", "");
  setValRaw("revisionNote", "");

  // ID, caseId, etc.
  setValRaw("questionId", "");
  setValRaw("caseId", "");
}

/*********************************************************
 * ユーティリティ
 *********************************************************/
function getValRaw(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.classList && el.classList.contains("rich-editor")) {
    return el.innerHTML.trim();
  }
  return el.value.trim();
}
function setValRaw(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.classList && el.classList.contains("rich-editor")) {
    el.innerHTML = value || "";
  } else {
    el.value = value || "";
  }
}
