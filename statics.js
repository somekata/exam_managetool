// statics.js

// タブ切り替え時に、"統計"タブがアクティブになったら集計を更新する
document.addEventListener("DOMContentLoaded", () => {
  const statsTabButton = document.querySelector('.tab-button[data-tab="tab-stats"]');
  if (statsTabButton) {
    statsTabButton.addEventListener("click", renderStatsView);
  }
});

function renderStatsView() {
  const data = window.questionList || [];

  // 全体件数
  const totalEl = document.getElementById("stat-total");
  if (totalEl) {
    totalEl.textContent = `総問題数: ${data.length} 問`;
  }

  // 言語×難易度
  const langTableBody = document.querySelector("#cross-lang tbody");
  if (langTableBody) {
    const pivotLang = buildPivot(data, q => q.language || "(不明)");
    langTableBody.innerHTML = pivotToRowsHtml(pivotLang);
  }

  // 作問者×難易度
  const authorTableBody = document.querySelector("#cross-author tbody");
  if (authorTableBody) {
    const pivotAuthor = buildPivot(data, q => q.author || "(不明)");
    authorTableBody.innerHTML = pivotToRowsHtml(pivotAuthor);
  }

  // 領域×難易度（domain1 と domain2 の両方を別カウントとして展開）
  const domainTableBody = document.querySelector("#cross-domain tbody");
  if (domainTableBody) {
    const exploded = [];
    data.forEach(q => {
      if (q.domain1) {
        exploded.push({ ...q, _domain: q.domain1 });
      }
      if (q.domain2) {
        exploded.push({ ...q, _domain: q.domain2 });
      }
      // domain1もdomain2もない場合はカウントしない
    });
    const pivotDomain = buildPivot(exploded, q => q._domain || "(不明)");
    domainTableBody.innerHTML = pivotToRowsHtml(pivotDomain);
  }
}

// pivot を作る: groupKeyFn がカテゴリ名(例: 言語, 作問者, 領域)
function buildPivot(list, groupKeyFn) {
  const result = {};

  list.forEach(q => {
    const g = groupKeyFn(q) || "(不明)";

    // 難易度を "1"-"5" に正規化
    let d = q.difficulty || "";
    d = String(d).trim();
    d = d.replace(/^Lv/i, ""); // "Lv2" -> "2"

    if (!result[g]) {
      result[g] = { "1":0, "2":0, "3":0, "4":0, "5":0, total:0 };
    }

    if (["1","2","3","4","5"].includes(d)) {
      result[g][d] += 1;
    }
    result[g].total += 1;
  });

  const grand = { "1":0, "2":0, "3":0, "4":0, "5":0, total:0 };
  Object.values(result).forEach(row => {
    grand["1"] += row["1"];
    grand["2"] += row["2"];
    grand["3"] += row["3"];
    grand["4"] += row["4"];
    grand["5"] += row["5"];
    grand.total += row.total;
  });
  result["合計"] = grand;

  return result;
}

// pivotオブジェクト → <tr>群のHTML
function pivotToRowsHtml(pivotObj) {
  // 表示は group名の昇順。ただし最後に「合計」を置きたいので分離
  const keys = Object.keys(pivotObj).filter(k => k !== "合計").sort();
  keys.push("合計");

  return keys.map(g => {
    const row = pivotObj[g];
    return `
      <tr>
        <td>${escapeHTML(g)}</td>
        <td>${row["1"] || 0}</td>
        <td>${row["2"] || 0}</td>
        <td>${row["3"] || 0}</td>
        <td>${row["4"] || 0}</td>
        <td>${row["5"] || 0}</td>
        <td>${row.total || 0}</td>
      </tr>
    `;
  }).join("");
}

// 集計テーブルを埋める共通関数
function fillStatTable(tableId, mapObj, options={}) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;

  const rows = Object.keys(mapObj).map(key => {
    return { key, count: mapObj[key] };
  });

  // オプション: 難易度はLv1, Lv2...の順に並べたいので数値ソート可能
  if (options.sortNumericKey) {
    rows.sort((a,b) => {
      const na = parseInt(a.key,10);
      const nb = parseInt(b.key,10);
      if (isNaN(na) || isNaN(nb)) return (""+a.key).localeCompare(""+b.key);
      return na - nb;
    });
  } else {
    rows.sort((a,b) => (""+a.key).localeCompare(""+b.key));
  }

  tbody.innerHTML = rows.map(r => {
    const label = options.prefix ? `${options.prefix}${r.key}` : r.key;
    return `<tr><td>${escapeHTML(label)}</td><td>${escapeHTML(String(r.count))}</td></tr>`;
  }).join("");
}

// escapeHTML は script.js と同じロジックをこちらにも複製しておく
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
