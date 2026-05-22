import * as Blockly from 'blockly';
import { defineSQLBlocks, getSqlGenerator, initSqlGenerator } from './blocks';
import {
  initDatabase,
  getTables,
  getTableColumns,
  getTableData,
  importCSV,
  executeQueryWithDiff
} from './db';

// グローバルなBlocklyワークスペース参照
let workspace;

// =========================================================================
// 1. アプリケーション初期化
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // データベース初期化
  initDatabase();

  // Blocklyカスタムブロック定義
  defineSQLBlocks();

  // SQLジェネレータの初期化 (Blocklyがロードされた後に遅延実行)
  initSqlGenerator();

  // ワークスペース注入
  initBlockly();

  // 左ペインのテーブル一覧表示
  renderTableList();

  // アコーディオンガイドの初期化
  setupGuideAccordion();

  // イベントリスナーのセットアップ
  setupEventListeners();
});

// =========================================================================
// 2. Blocklyのセットアップ
// =========================================================================

function initBlockly() {
  // 開始ブロックがハット（丸頭）になるようにカスタムテーマを作成
  const theme = Blockly.Theme.defineTheme('google_minimal', {
    base: Blockly.Themes.Classic,
    startHats: true // 開始ブロックの頭部を Scratch 風の丸型（ハット型）にする設定
  });

  workspace = Blockly.inject('blocklyDiv', {
    toolbox: '<xml><category name="読み込み中..."></category></xml>',
    theme: theme,
    grid: {
      spacing: 20,
      length: 3,
      colour: '#ccc',
      snap: true
    },
    zoom: {
      controls: true,
      wheel: false,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2
    },
    trashcan: true
  });

  // データベーススキーマに合わせてツールボックス（および影ブロック）を同期
  updateToolboxSchema();

  // リアルタイムに生成されるSQLをプレビュー領域に表示するイベント監視
  workspace.addChangeListener((event) => {
    updateWorkspacePlaceholder();
    
    // ドラッグ中やUI操作中の不要な実行を避ける
    if (event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CHANGE ||
        event.type === Blockly.Events.BLOCK_DELETE ||
        event.type === Blockly.Events.BLOCK_CREATE) {
      
      updateSQLPreview();
    }
  });

  // 初期プレースホルダー表示
  updateWorkspacePlaceholder();
}

// データベーススキーマに基づいてツールボックスと影ブロック（Shadow Blocks）を動的ビルド
function updateToolboxSchema() {
  if (!workspace) return;
  
  const tables = getTables();
  const defaultTable1 = tables[0] || 'employees';
  const defaultTable2 = tables[1] || (tables[0] ? tables[0] : 'departments');
  
  const cols1 = getTableColumns(defaultTable1);
  const defaultCol1 = cols1[0] || '*';
  
  const cols2 = getTableColumns(defaultTable2);
  const defaultCol2 = cols2[0] || '*';
  
  // WHERE用のデフォルト比較列 (数値系か、なければ最初のカラム)
  let compareCol = defaultCol1;
  let compareVal = '300000';
  if (defaultTable1 === 'employees') {
    compareCol = 'salary';
  } else if (cols1.includes('age')) {
    compareCol = 'age';
    compareVal = '30';
  }

  const xmlText = `
    <xml id="toolbox" style="display: none">
      <category name="クエリ開始" colour="#1e3a8a">
        <block type="sql_select"></block>
        <block type="sql_insert"></block>
        <block type="sql_update"></block>
        <block type="sql_delete"></block>
      </category>
      
      <category name="句・接続" colour="#475569">
        <block type="sql_from"></block>
        <block type="sql_join"></block>
        <block type="sql_where"></block>
        <block type="sql_group_by"></block>
        <block type="sql_order_by"></block>
        <block type="sql_limit"></block>
      </category>
      
      <category name="列・テーブル" colour="#16a34a">
        <block type="sql_val_column">
          <field name="COLUMN">*</field>
        </block>
        <block type="sql_val_table">
          <field name="TABLE">${defaultTable1}</field>
        </block>
      </category>
      
      <category name="条件・パラメータ" colour="#b45309">
        <block type="sql_val_compare"></block>
        <block type="sql_val_text"></block>
        <block type="sql_val_list"></block>
      </category>
    </xml>
  `;
  
  try {
    workspace.updateToolbox(xmlText);
  } catch (err) {
    console.error("Failed to update toolbox schema dynamically:", err);
  }
}

// リアルタイムSQLプレビューの更新
function updateSQLPreview() {
  const sqlPreviewArea = document.getElementById('sqlCodeArea');
  try {
    // トップレベルブロックのみを走査し、それぞれからSQLを生成して結合
    const topBlocks = workspace.getTopBlocks(true);
    let fullSQL = '';

    topBlocks.forEach(block => {
      // クエリ開始系のブロック（SELECT/INSERT/UPDATE/DELETE）のみからSQL生成を開始
      if (['sql_select', 'sql_insert', 'sql_update', 'sql_delete'].includes(block.type)) {
        const code = getSqlGenerator().blockToCode(block);
        if (code) {
          fullSQL += code + ';\n';
        }
      }
    });

    fullSQL = fullSQL.trim();

    if (fullSQL) {
      sqlPreviewArea.innerHTML = syntaxHighlightSQL(fullSQL);
    } else {
      sqlPreviewArea.innerHTML = '<span class="code-placeholder">ブロックを配置するとここにSQLが自動生成されます。</span>';
    }
  } catch (err) {
    sqlPreviewArea.innerHTML = `<span style="color: #c5221f;">コード生成エラー: ${err.message}</span>`;
  }
}

// SQLの簡易キーワードハイライト (クリーンな色づかい - 重複置換バグを防ぐため1回の走査でトークン置換)
function syntaxHighlightSQL(sqlText) {
  if (!sqlText) return '';
  
  // 文字列、数値、およびSQLキーワードを一度にキャプチャして置換（HTMLタグ内の重複置換を防ぐ）
  const regex = /('[^']*')|(\b\d+\b)|(\b(SELECT|FROM|WHERE|INNER JOIN|LEFT JOIN|ON|GROUP BY|ORDER BY|LIMIT|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|ASC|DESC)\b)/gi;
  
  return sqlText.replace(regex, (match, p1, p2, p3) => {
    if (p1) {
      // 文字列のハイライト
      return `<span style="color: #c26401;">${match}</span>`;
    } else if (p2) {
      // 数値のハイライト
      return `<span style="color: #188038;">${match}</span>`;
    } else if (p3) {
      // キーワードのハイライト
      return `<span style="color: #1a73e8; font-weight: 500;">${match.toUpperCase()}</span>`;
    }
    return match;
  });
}

// =========================================================================
// 3. UI レンダリング (データソース・結果テーブル)
// =========================================================================

// 左ペインのテーブル一覧とカラム構成の描画
function renderTableList() {
  const tableListContainer = document.getElementById('tableList');
  tableListContainer.innerHTML = '';

  const tables = getTables();

  tables.forEach(tableName => {
    const tableItem = document.createElement('div');
    tableItem.className = 'table-item';

    const columns = getTableColumns(tableName);

    // アコーディオンのヘッダー部分
    const header = document.createElement('div');
    header.className = 'table-header';
    header.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 16px;">table_chart</span>
      <span>${tableName}</span>
    `;

    // カラム一覧部分
    const colsList = document.createElement('div');
    colsList.className = 'table-columns-list';
    colsList.style.display = 'none'; // 初期状態は非表示

    columns.forEach(col => {
      const colItem = document.createElement('div');
      colItem.className = 'column-item';
      colItem.innerHTML = `
        <span>${col}</span>
      `;
      colsList.appendChild(colItem);
    });

    // トグル機能
    header.addEventListener('click', () => {
      const isVisible = colsList.style.display === 'flex';
      colsList.style.display = isVisible ? 'none' : 'flex';
      header.classList.toggle('active', !isVisible);
    });

    tableItem.appendChild(header);
    tableItem.appendChild(colsList);
    tableListContainer.appendChild(tableItem);
  });
}

// SQLの実行と結果/差分のレンダリング
function runActiveQuery() {
  const sqlPreviewArea = document.getElementById('sqlCodeArea');
  const sqlText = sqlPreviewArea.innerText.trim();

  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const affectedRowsText = document.getElementById('affectedRowsText');
  const emptyState = document.getElementById('emptyResultState');
  const dynamicView = document.getElementById('dynamicResultView');

  if (!sqlText || sqlText.includes('ブロックを配置すると')) {
    alert('実行可能なSQLがありません。まずはブロックを組み立ててください。');
    return;
  }

  try {
    // データベースクエリを実行してBefore/After差分を取得
    const res = executeQueryWithDiff(sqlText);

    // ステータス表示の更新
    statusDot.className = 'status-dot active';
    statusText.textContent = `${res.queryType} 実行成功`;
    
    // 影響行数の描画
    if (res.queryType !== 'SELECT') {
      const affected = Array.isArray(res.result) ? res.result.length : (res.result || 0);
      affectedRowsText.textContent = `影響を受けた行数: ${affected} 件`;
    } else {
      affectedRowsText.textContent = `取得件数: ${res.result.length} 件`;
    }

    // ビュー表示切り替え
    emptyState.style.display = 'none';
    dynamicView.style.display = 'block';
    dynamicView.innerHTML = '';

    if (res.isDiff) {
      // INSERT / UPDATE / DELETE の場合は Before/After 差分スプリットビューを表示
      renderDiffView(res, dynamicView);
    } else {
      // SELECT の場合は単一の実行結果テーブルをクリーンに表示
      renderSimpleResultView(res.result, dynamicView);
    }

    // 左ペインのテーブル情報とBlocklyの構成も最新状態に同期（データが書き換わるため）
    renderTableList();

  } catch (err) {
    statusDot.className = 'status-dot';
    statusText.textContent = 'エラー';
    affectedRowsText.textContent = '';
    
    emptyState.style.display = 'none';
    dynamicView.style.display = 'block';
    dynamicView.innerHTML = `
      <div style="padding: 20px; border: 1px solid #fce8e6; background-color: #fce8e6; border-radius: 4px; color: #c5221f; font-size: 13px; font-family: var(--font-mono); line-height: 1.6;">
        <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-outlined" style="font-size: 18px;">error</span>
          SQL実行エラー
        </div>
        <div>${err.message}</div>
      </div>
    `;
  }
}

// 🟢🟡🔴 差分表示(Diff UI)のレンダリング
function renderDiffView(res, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'split-view-container';

  // --- 1. Before ビュー (実行前データ) ---
  const beforePane = document.createElement('div');
  beforePane.className = 'split-pane';
  beforePane.innerHTML = `
    <div class="split-pane-header">
      <span class="material-symbols-outlined" style="font-size: 16px;">history</span>
      実行前のデータ (${res.targetTable})
    </div>
    <div class="split-pane-body">
      <table class="data-table" id="beforeTable"></table>
    </div>
  `;
  wrapper.appendChild(beforePane);

  // --- 2. After ビュー (実行後データ) ---
  const afterPane = document.createElement('div');
  afterPane.className = 'split-pane';
  afterPane.innerHTML = `
    <div class="split-pane-header">
      <span class="material-symbols-outlined" style="font-size: 16px;">update</span>
      実行後のデータ状態と差分
    </div>
    <div class="split-pane-body">
      <table class="data-table" id="afterTable"></table>
    </div>
  `;
  wrapper.appendChild(afterPane);

  container.appendChild(wrapper);

  // Before テーブルの描画 (変更前のクリーンな状態)
  const beforeTable = beforePane.querySelector('#beforeTable');
  renderTableHTML(beforeTable, res.columns, res.before);

  // After テーブルの描画 (差分マークアップ付き)
  const afterTable = afterPane.querySelector('#afterTable');
  renderDiffTableHTML(afterTable, res.columns, res.diff, res.keyField);
}

// 通常のテーブル描画ユーティリティ
function renderTableHTML(tableElem, columns, data) {
  let html = '<thead><tr>';
  columns.forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += '</tr></thead><tbody>';

  if (data.length === 0) {
    html += `<tr><td colspan="${columns.length}" style="text-align: center; color: var(--text-muted);">データが空です</td></tr>`;
  } else {
    data.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        const val = row[col] !== undefined && row[col] !== null ? row[col] : '';
        html += `<td>${val}</td>`;
      });
      html += '</tr>';
    });
  }
  html += '</tbody>';
  tableElem.innerHTML = html;
}

// 🟢🟡🔴 差分マークアップ付きのテーブル描画ユーティリティ
function renderDiffTableHTML(tableElem, columns, diffData, keyField) {
  let html = '<thead><tr>';
  columns.forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += '</tr></thead><tbody>';

  if (diffData.length === 0) {
    html += `<tr><td colspan="${columns.length}" style="text-align: center; color: var(--text-muted);">データがありません</td></tr>`;
  } else {
    diffData.forEach(item => {
      let rowClass = '';
      if (item.status === 'inserted') rowClass = 'row-inserted';
      if (item.status === 'deleted') rowClass = 'row-deleted';

      html += `<tr class="${rowClass}">`;
      
      columns.forEach(col => {
        const val = item.data[col] !== undefined && item.data[col] !== null ? item.data[col] : '';
        
        if (item.status === 'updated' && item.changedFields.includes(col)) {
          // 変更のあったセル単体に黄色ハイライトをあて、元の値を打ち消し線付きで下部に小さく表示
          const oldVal = item.originalData[col] !== undefined && item.originalData[col] !== null ? item.originalData[col] : 'NULL';
          html += `
            <td class="cell-updated">
              <div>${val}</div>
              <div class="old-value-badge">${oldVal}</div>
            </td>
          `;
        } else {
          html += `<td>${val}</td>`;
        }
      });
      
      html += '</tr>';
    });
  }
  html += '</tbody>';
  tableElem.innerHTML = html;
}

// SELECT結果などのシンプルな単一テーブル描画
function renderSimpleResultView(data, container) {
  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = `
      <div class="empty-result-state">
        <span class="material-symbols-outlined empty-icon">toc</span>
        <div class="empty-text">実行結果が空、または該当データが存在しません。</div>
      </div>
    `;
    return;
  }

  // カラム名の抽出
  const columns = Object.keys(data[0]);

  const pane = document.createElement('div');
  pane.className = 'split-pane';
  pane.style.height = '100%';
  pane.innerHTML = `
    <div class="split-pane-header">
      <span class="material-symbols-outlined" style="font-size: 16px;">toc</span>
      クエリ実行結果
    </div>
    <div class="split-pane-body">
      <table class="data-table" id="simpleResultTable"></table>
    </div>
  `;

  container.appendChild(pane);

  const tableElem = pane.querySelector('#simpleResultTable');
  renderTableHTML(tableElem, columns, data);
}

// =========================================================================
// 4. イベントリスナーとCSVインポートのセットアップ
// =========================================================================

function setupEventListeners() {
  // SQL実行ボタン
  document.getElementById('runQueryBtn').addEventListener('click', runActiveQuery);

  // データベースリセットボタン
  document.getElementById('resetDbBtn').addEventListener('click', () => {
    if (confirm('データベースのデータを初期状態（サンプルデータ）にリセットしますか？\nインポートされたカスタムCSVは消去されます。')) {
      initDatabase();
      renderTableList();
      updateToolboxSchema(); // ツールボックスを新データベースの状態に同期
      alert('データベースをリセットしました。');
      
      // 結果エリアのリセット
      document.getElementById('emptyResultState').style.display = 'flex';
      document.getElementById('dynamicResultView').style.display = 'none';
      document.getElementById('dynamicResultView').innerHTML = '';
      document.getElementById('statusDot').className = 'status-dot';
      document.getElementById('statusText').textContent = 'クエリ未実行';
      document.getElementById('affectedRowsText').textContent = '';
    }
  });

  // ワークスペースクリアボタン
  document.getElementById('clearWorkspaceBtn').addEventListener('click', () => {
    if (confirm('Blocklyワークスペース上のすべてのブロックを消去しますか？')) {
      workspace.clear();
      updateSQLPreview();
    }
  });

  // --- CSV ドラッグ＆ドロップ ＆ クリック選択 ---
  const dropzone = document.getElementById('csvDropzone');
  const fileInput = document.getElementById('csvFileInput');

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleCSVFile(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  });
}

// CSVファイルの読み込みとAlaSQLへのインポート
function handleCSVFile(file) {
  if (!file.name.endsWith('.csv')) {
    alert('CSV形式（.csv）のファイルのみインポート可能です。');
    return;
  }

  // ファイル名から拡張子を排してテーブル名を決定 (スペースや不正文字 of 不正文字の除去)
  const tableName = file.name.replace(/\.csv$/i, '')
                             .replace(/[^a-zA-Z0-9_]/g, '_')
                             .toLowerCase();

  const reader = new FileReader();
  reader.onload = function(e) {
    const csvText = e.target.result;
    try {
      const info = importCSV(tableName, csvText);
      
      // UIの更新
      renderTableList();
      updateToolboxSchema(); // ツールボックスを新データベースの状態に同期
      
      alert(`テーブル「${info.tableName}」（${info.rowCount} 行、カラム: ${info.columns.join(', ')}）を正常にインポートしました！\n\n値入力ブロック等で直接テーブル名を入力してご利用いただけます。`);
    } catch (err) {
      alert(`CSVインポートに失敗しました:\n${err.message}`);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// クイック組み立てガイド (アコーディオン) のセットアップ
function setupGuideAccordion() {
  const accordion = document.getElementById('guideAccordion');
  const header = document.getElementById('guideHeader');
  
  if (!accordion || !header) return;

  // デフォルトで開いた状態にする
  accordion.classList.add('open');

  header.addEventListener('click', () => {
    accordion.classList.toggle('open');
  });
}

// ワークスペース空の時のプレースホルダー表示制御
function updateWorkspacePlaceholder() {
  const blocklyPane = document.getElementById('blocklyPane');
  if (!blocklyPane || !workspace) return;

  const allBlocks = workspace.getAllBlocks(false);
  if (allBlocks.length === 0) {
    blocklyPane.classList.add('workspace-empty');
  } else {
    blocklyPane.classList.remove('workspace-empty');
  }
}
