import * as Blockly from 'blockly';
import { getTables, getTableColumns } from './db';

// 日本語ハイブリッド自己説明ブロックラベル用の日本語マッピング辞書
const COLUMN_JAPANESE_MAP = {
  '*': 'すべての列 (*)',
  'emp_id': 'emp_id (社員ID)',
  'name': 'name (氏名)',
  'role': 'role (役職)',
  'salary': 'salary (給与)',
  'dept_id': 'dept_id (部門ID)',
  'employees.dept_id': 'employees.dept_id (部門ID)',
  'departments.dept_id': 'departments.dept_id (部門ID)',
  'dept_name': 'dept_name (部門名)',
  'location': 'location (勤務地)',
  'AVG(salary)': '[集計] 平均給与 AVG(salary)',
  'SUM(salary)': '[集計] 合計給与 SUM(salary)',
  'COUNT(*)': '[集計] 人数 COUNT(*)'
};

const TABLE_JAPANESE_MAP = {
  'employees': 'employees (社員)',
  'departments': 'departments (部門)'
};

// SQLブロック用のカスタムテーマカラー (Google仕様の洗練されたマテリアルトーン)
const COL_SELECT = '#1e3a8a';  // ロイヤルインディゴネイビー (クエリ開始・DML)
const COL_TABLE = '#475569';   // スレートブルーグレー (スキーマ・静的構造体)
const COL_WHERE = '#b45309';   // アンバーゴールド/オーク (フィルタ・評価)
const COL_CONTROL = '#0f766e'; // ディープコバルトティール (整理・ソート・制限)
const COL_VALUE = '#16a34a';   // ソフトセージグリーン (パラメータ・値・データピース)

// =========================================================================
// 1. カスタムブロックの定義
// =========================================================================

export function defineSQLBlocks() {
  // --- SELECT ブロック (クエリ開始 - ハット型) ---
  Blockly.Blocks['sql_select'] = {
    init: function() {
      this.appendValueInput('COLUMNS')
          .setCheck(['SQL_COLUMN', 'SQL_AGGREGATE'])
          .appendField('SELECT')
          .appendField('【表示する列】');
      this.setNextStatement(true, 'FROM_SECTION'); // SELECTの直後はFROMしか来られない
      this.setColour(COL_SELECT);
      this.setTooltip('取得する列（カラム）を指定します。* を指定するとすべての列を取得します。');
    }
  };

  // --- FROM ブロック (テーブル指定 - 接続) ---
  Blockly.Blocks['sql_from'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_TABLE')
          .appendField('FROM')
          .appendField('【取得元のテーブル】');
      this.setPreviousStatement(true, 'FROM_SECTION');
      this.setNextStatement(true, ['JOIN_SECTION', 'WHERE_SECTION', 'GROUP_SECTION', 'ORDER_SECTION', 'LIMIT_SECTION']);
      this.setColour(COL_TABLE);
      this.setTooltip('取得元のテーブルを指定します。');
    }
  };

  // --- JOIN ブロック (テーブル結合) ---
  Blockly.Blocks['sql_join'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_TABLE')
          .appendField('【結合】')
          .appendField(new Blockly.FieldDropdown([
            ['INNER JOIN', 'INNER JOIN'],
            ['LEFT JOIN', 'LEFT JOIN']
          ]), 'JOIN_TYPE')
          .appendField('【結合テーブル】');
      this.appendValueInput('LEFT_KEY')
          .setCheck('SQL_COLUMN')
          .appendField('ON 【左のキー列】');
      this.appendValueInput('RIGHT_KEY')
          .setCheck('SQL_COLUMN')
          .appendField('= 【右のキー列】');
      this.setPreviousStatement(true, 'JOIN_SECTION');
      this.setNextStatement(true, ['JOIN_SECTION', 'WHERE_SECTION', 'GROUP_SECTION', 'ORDER_SECTION', 'LIMIT_SECTION']);
      this.setColour(COL_TABLE);
      this.setTooltip('別のテーブルを結合条件（ON キー1 = キー2）に基づいて結合します。');
      this.setInputsInline(true); // 横一列に並める
    }
  };


  // --- WHERE ブロック (条件抽出) ---
  Blockly.Blocks['sql_where'] = {
    init: function() {
      this.appendValueInput('CONDITION')
          .setCheck('SQL_CONDITION')
          .appendField('WHERE')
          .appendField('【絞り込む条件式】');
      this.setPreviousStatement(true, 'WHERE_SECTION');
      this.setNextStatement(true, ['GROUP_SECTION', 'ORDER_SECTION', 'LIMIT_SECTION']);
      this.setColour(COL_WHERE);
      this.setTooltip('データを絞り込むための条件を指定します。');
    }
  };

  // --- GROUP BY ブロック (グループ集計) ---
  Blockly.Blocks['sql_group_by'] = {
    init: function() {
      this.appendValueInput('COLUMN')
          .setCheck('SQL_COLUMN')
          .appendField('GROUP BY')
          .appendField('【グループ化する列】');
      this.setPreviousStatement(true, 'GROUP_SECTION');
      this.setNextStatement(true, ['ORDER_SECTION', 'LIMIT_SECTION']);
      this.setColour(COL_CONTROL);
      this.setTooltip('指定した列でデータをグループ化します。');
    }
  };

  // --- ORDER BY ブロック (ソート) ---
  Blockly.Blocks['sql_order_by'] = {
    init: function() {
      this.appendValueInput('COLUMN')
          .setCheck('SQL_COLUMN')
          .appendField('ORDER BY')
          .appendField('【並べ替える列】');
      this.appendDummyInput()
          .appendField('【順序】')
          .appendField(new Blockly.FieldDropdown([
            ['昇順 (ASC)', 'ASC'],
            ['降順 (DESC)', 'DESC']
          ]), 'DIR');
      this.setPreviousStatement(true, 'ORDER_SECTION');
      this.setNextStatement(true, 'LIMIT_SECTION');
      this.setColour(COL_CONTROL);
      this.setTooltip('指定した列に基づいてデータを並べ替えます。');
      this.setInputsInline(true);
    }
  };

  // --- LIMIT ブロック (件数制限) ---
  Blockly.Blocks['sql_limit'] = {
    init: function() {
      this.appendDummyInput()
          .appendField('LIMIT')
          .appendField('【件数制限】')
          .appendField(new Blockly.FieldNumber(5, 0, 100, 1), 'LIMIT_NUM');
      this.setPreviousStatement(true, 'LIMIT_SECTION');
      this.setColour(COL_CONTROL);
      this.setTooltip('取得する最大行数を指定します。');
    }
  };

  // --- INSERT ブロック (データ追加 - ハット型) ---
  Blockly.Blocks['sql_insert'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_TABLE')
          .appendField('INSERT INTO')
          .appendField('【追加先テーブル】');
      this.appendDummyInput()
          .appendField('VALUES (');
      this.appendValueInput('VALUES')
          .setCheck('SQL_LIST')
          .appendField('【追加する値】');
      this.appendDummyInput()
          .appendField(')');
      this.setColour(COL_SELECT);
      this.setTooltip('テーブルに新しいレコードを追加します。カンマ区切りで値を並べます。');
      this.setInputsInline(true);
    }
  };

  // --- UPDATE ブロック (データ更新 - ハット型) ---
  Blockly.Blocks['sql_update'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_TABLE')
          .appendField('UPDATE')
          .appendField('【更新するテーブル】');
      this.appendValueInput('COLUMN')
          .setCheck('SQL_COLUMN')
          .appendField('SET')
          .appendField('【更新する列】');
      this.appendValueInput('VALUE')
          .setCheck(['SQL_COLUMN', 'SQL_TEXT'])
          .appendField('= 【新しい値】');
      this.setNextStatement(true, 'WHERE_SECTION');
      this.setColour(COL_SELECT);
      this.setTooltip('テーブル内の既存データを更新します。WHERE句と組み合わせて更新対象を限定します。');
      this.setInputsInline(true);
    }
  };


  // --- DELETE ブロック (データ削除 - ハット型) ---
  Blockly.Blocks['sql_delete'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_TABLE')
          .appendField('DELETE FROM')
          .appendField('【削除するテーブル】');
      this.setNextStatement(true, 'WHERE_SECTION');
      this.setColour(COL_SELECT);
      this.setTooltip('テーブルからデータを削除します。WHERE句と組み合わせて削除対象を限定します。');
    }
  };

  // =========================================================================
  // 値（パラメータ）ブロック群 (Value Blocks - 横はめ込み)
  // =========================================================================

  // --- カラム名指定用ブロック ---
  Blockly.Blocks['sql_val_column'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown(function() {
            const options = [['すべての列 (*)', '*']];
            try {
              const tables = getTables();
              const allCols = new Set();
              tables.forEach(t => {
                const cols = getTableColumns(t);
                cols.forEach(c => {
                  allCols.add(c);
                  allCols.add(`${t}.${c}`);
                });
              });
              
              // 常に集計関数も選択肢に追加
              ['AVG(salary)', 'SUM(salary)', 'COUNT(*)'].forEach(f => allCols.add(f));

              allCols.forEach(col => {
                if (col === '*') return;
                
                // マッピング辞書から日本語ラベルを取得。なければ英語名のまま
                let label = COLUMN_JAPANESE_MAP[col];
                if (!label) {
                  const parts = col.split('.');
                  if (parts.length === 2) {
                    const colName = parts[1];
                    const colLabel = COLUMN_JAPANESE_MAP[colName];
                    if (colLabel) {
                      const match = colLabel.match(/\(([^)]+)\)/);
                      if (match) {
                        label = `${col} (${match[1]})`;
                      }
                    }
                  }
                }
                if (!label) {
                  label = col;
                }
                options.push([label, col]);
              });
            } catch (e) {
              console.error(e);
            }
            if (options.length === 1) {
              options.push(['emp_id (社員ID)', 'emp_id']);
              options.push(['name (氏名)', 'name']);
              options.push(['role (役職)', 'role']);
              options.push(['salary (給与)', 'salary']);
              options.push(['dept_id (部門ID)', 'dept_id']);
            }
            return options;
          }), 'COLUMN');
      this.setOutput(true, 'SQL_COLUMN');
      this.setColour(COL_VALUE);
      this.setTooltip('クエリで指定する列名を選択します。');
    }
  };

  // --- テーブル名指定用ブロック ---
  Blockly.Blocks['sql_val_table'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown(function() {
            try {
              const tables = getTables();
              if (tables && tables.length > 0) {
                return tables.map(t => {
                  const label = TABLE_JAPANESE_MAP[t] || t;
                  return [label, t];
                });
              }
            } catch (e) {
              console.error(e);
            }
            return [['employees (社員)', 'employees']];
          }), 'TABLE');
      this.setOutput(true, 'SQL_TABLE');
      this.setColour(COL_TABLE);
      this.setTooltip('クエリの対象とするテーブル名を選択します。');
    }
  };

  // --- 比較条件ブロック (WHERE句用) ---
  Blockly.Blocks['sql_val_compare'] = {
    init: function() {
      this.appendValueInput('LEFT')
          .setCheck('SQL_COLUMN')
          .appendField('【比較する列】');
      this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([
            ['=', '='],
            ['>', '>'],
            ['>=', '>='],
            ['<', '<'],
            ['<=', '<='],
            ['と一致する (LIKE)', 'LIKE']
          ]), 'OP');
      this.appendValueInput('RIGHT')
          .setCheck(['SQL_COLUMN', 'SQL_TEXT'])
          .appendField('【比較する値】');
      this.setOutput(true, 'SQL_CONDITION');
      this.setColour(COL_WHERE);
      this.setTooltip('左辺と右辺を比較する条件を作成します。');
      this.setInputsInline(true);
    }
  };

  // --- 文字列/数値の入力ブロック ---
  Blockly.Blocks['sql_val_text'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("'")
          .appendField(new Blockly.FieldTextInput('値'), 'TEXT')
          .appendField("'");
      this.setOutput(true, 'SQL_TEXT');
      this.setColour(COL_VALUE);
      this.setTooltip('SQL文中の文字列または数値を指定します。');
    }
  };

  // --- 複数値の連結ブロック (INSERT VALUES用など) ---
  Blockly.Blocks['sql_val_list'] = {
    init: function() {
      this.appendValueInput('VAL1')
          .setCheck(['SQL_COLUMN', 'SQL_TEXT']);
      this.appendValueInput('VAL2')
          .setCheck(['SQL_COLUMN', 'SQL_TEXT'])
          .appendField(',');
      this.appendValueInput('VAL3')
          .setCheck(['SQL_COLUMN', 'SQL_TEXT'])
          .appendField(',');
      this.setOutput(true, 'SQL_LIST');
      this.setColour(COL_VALUE);
      this.setTooltip('複数の値をカンマ区切りで結合します。');
      this.setInputsInline(true);
    }
  };
}

// =========================================================================
// 2. SQL文字列生成ジェネレータの定義
// =========================================================================

// Blockly標準のジェネレータクラスからSQL生成器を作成
let sqlGenerator = null;

/**
 * SQLジェネレータのインスタンスを安全に取得します。
 * 未初期化の場合は自動で初期化処理を走らせます。
 */
export function getSqlGenerator() {
  if (!sqlGenerator) {
    initSqlGenerator();
  }
  return sqlGenerator;
}

/**
 * SQLジェネレータを明示的に初期化します。
 * Blocklyライブラリが完全に読み込まれた後に呼び出される必要があります。
 */
export function initSqlGenerator() {
  if (sqlGenerator) return; // 二重初期化防止

  sqlGenerator = new Blockly.Generator('SQL');

  // スクリプト生成に必要な初期設定
  sqlGenerator.scrub_ = function(block, code, opt_thisOnly) {
    const nextBlock = block.getNextBlock();
    let nextCode = '';
    if (nextBlock && !opt_thisOnly) {
      nextCode = '\n' + sqlGenerator.blockToCode(nextBlock);
    }
    return code + nextCode;
  };

  // 各ブロックに対するジェネレータ関数の割り当て
  sqlGenerator.forBlock['sql_select'] = function(block) {
    const cols = sqlGenerator.valueToCode(block, 'COLUMNS', 0) || '*';
    return `SELECT ${cols}`;
  };

  sqlGenerator.forBlock['sql_from'] = function(block) {
    const table = sqlGenerator.valueToCode(block, 'TABLE', 0) || 'employees';
    return `FROM ${table}`;
  };

  sqlGenerator.forBlock['sql_join'] = function(block) {
    const joinType = block.getFieldValue('JOIN_TYPE');
    const table = sqlGenerator.valueToCode(block, 'TABLE', 0) || 'departments';
    const leftKey = sqlGenerator.valueToCode(block, 'LEFT_KEY', 0) || 'employees.dept_id';
    const rightKey = sqlGenerator.valueToCode(block, 'RIGHT_KEY', 0) || 'departments.dept_id';
    return `${joinType} ${table} ON ${leftKey} = ${rightKey}`;
  };

  sqlGenerator.forBlock['sql_where'] = function(block) {
    const condition = sqlGenerator.valueToCode(block, 'CONDITION', 0) || '1 = 1';
    return `WHERE ${condition}`;
  };

  sqlGenerator.forBlock['sql_group_by'] = function(block) {
    const col = sqlGenerator.valueToCode(block, 'COLUMN', 0) || 'role';
    return `GROUP BY ${col}`;
  };

  sqlGenerator.forBlock['sql_order_by'] = function(block) {
    const col = sqlGenerator.valueToCode(block, 'COLUMN', 0) || 'salary';
    const dir = block.getFieldValue('DIR');
    return `ORDER BY ${col} ${dir}`;
  };

  sqlGenerator.forBlock['sql_limit'] = function(block) {
    const limitNum = block.getFieldValue('LIMIT_NUM');
    return `LIMIT ${limitNum}`;
  };

  sqlGenerator.forBlock['sql_insert'] = function(block) {
    const table = sqlGenerator.valueToCode(block, 'TABLE', 0) || 'employees';
    const values = sqlGenerator.valueToCode(block, 'VALUES', 0) || '107, \'新メンバー\', \'スタッフ\', 250000, \'D01\'';
    return `INSERT INTO ${table} VALUES (${values})`;
  };

  sqlGenerator.forBlock['sql_update'] = function(block) {
    const table = sqlGenerator.valueToCode(block, 'TABLE', 0) || 'employees';
    const col = sqlGenerator.valueToCode(block, 'COLUMN', 0) || 'salary';
    const val = sqlGenerator.valueToCode(block, 'VALUE', 0) || '380000';
    return `UPDATE ${table} SET ${col} = ${val}`;
  };

  sqlGenerator.forBlock['sql_delete'] = function(block) {
    const table = sqlGenerator.valueToCode(block, 'TABLE', 0) || 'employees';
    return `DELETE FROM ${table}`;
  };

  // 値ブロック用のジェネレータ定義 (戻り値は [コード, 優先順位] の配列)
  sqlGenerator.forBlock['sql_val_column'] = function(block) {
    const col = block.getFieldValue('COLUMN');
    return [col, 0];
  };

  sqlGenerator.forBlock['sql_val_table'] = function(block) {
    const table = block.getFieldValue('TABLE');
    return [table, 0];
  };

  sqlGenerator.forBlock['sql_val_compare'] = function(block) {
    const left = sqlGenerator.valueToCode(block, 'LEFT', 0) || 'salary';
    const op = block.getFieldValue('OP');
    let right = sqlGenerator.valueToCode(block, 'RIGHT', 0) || '300000';
    
    // LIKE演算子の場合、%ワイルドカードを適用しやすいよう補正するか、そのまま渡す
    if (op === 'LIKE' && !right.includes('%')) {
      // 引用符の中にある文字列の場合、自動でワイルドカードを包む
      if (right.startsWith("'") && right.endsWith("'")) {
        const val = right.slice(1, -1);
        right = `'%${val}%'`;
      }
    }
    
    return [`${left} ${op} ${right}`, 0];
  };

  sqlGenerator.forBlock['sql_val_text'] = function(block) {
    const text = block.getFieldValue('TEXT');
    // 数値だけで構成されている場合はクォートなし、文字列ならシングルクォートで囲う
    if (/^\d+$/.test(text)) {
      return [text, 0];
    }
    return [`'${text}'`, 0];
  };

  sqlGenerator.forBlock['sql_val_list'] = function(block) {
    const val1 = sqlGenerator.valueToCode(block, 'VAL1', 0) || 'NULL';
    const val2 = sqlGenerator.valueToCode(block, 'VAL2', 0) || 'NULL';
    const val3 = sqlGenerator.valueToCode(block, 'VAL3', 0) || 'NULL';
    
    const list = [val1, val2, val3].filter(v => v !== '').join(', ');
    return [list, 0];
  };
}
