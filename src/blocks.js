import * as Blockly from 'blockly';

// SQLブロック用のカスタムテーマカラー
const COL_SELECT = '#1a73e8'; // Google Blue (主要な検索クエリ操作)
const COL_TABLE = '#5f6368';  // ダークグレー (テーブルや静的スキーマ要素)
const COL_WHERE = '#e37400';  // オレンジ (条件判定)
const COL_DML = '#c26401';    // 暗いオレンジ (INSERT/UPDATE/DELETE データ操作)
const COL_VALUE = '#188038';  // グリーン (パラメータ・定数・関数)

// =========================================================================
// 1. カスタムブロックの定義
// =========================================================================

export function defineSQLBlocks() {
  // --- SELECT ブロック (クエリ開始 - ハット型) ---
  Blockly.Blocks['sql_select'] = {
    init: function() {
      this.appendValueInput('COLUMNS')
          .setCheck('SQL_VALUE')
          .appendField('SELECT');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_SELECT);
      this.setTooltip('取得する列（カラム）を指定します。* を指定するとすべての列を取得します。');
    }
  };

  // --- FROM ブロック (テーブル指定 - 接続) ---
  Blockly.Blocks['sql_from'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_VALUE')
          .appendField('FROM');
      this.setPreviousStatement(true, 'SQL_STATEMENT');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_TABLE);
      this.setTooltip('取得元のテーブルを指定します。');
    }
  };

  // --- JOIN ブロック (テーブル結合) ---
  Blockly.Blocks['sql_join'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_VALUE')
          .appendField(new Blockly.FieldDropdown([
            ['INNER JOIN', 'INNER JOIN'],
            ['LEFT JOIN', 'LEFT JOIN']
          ]), 'JOIN_TYPE');
      this.appendValueInput('LEFT_KEY')
          .setCheck('SQL_VALUE')
          .appendField('ON');
      this.appendValueInput('RIGHT_KEY')
          .setCheck('SQL_VALUE')
          .appendField('=');
      this.setPreviousStatement(true, 'SQL_STATEMENT');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_TABLE);
      this.setTooltip('別のテーブルを結合条件（ON キー1 = キー2）に基づいて結合します。');
      this.setInputsInline(true); // 横一列に並べる
    }
  };

  // --- WHERE ブロック (条件抽出) ---
  Blockly.Blocks['sql_where'] = {
    init: function() {
      this.appendValueInput('CONDITION')
          .setCheck('SQL_VALUE')
          .appendField('WHERE');
      this.setPreviousStatement(true, 'SQL_STATEMENT');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_WHERE);
      this.setTooltip('データを絞り込むための条件を指定します。');
    }
  };

  // --- GROUP BY ブロック (グループ集計) ---
  Blockly.Blocks['sql_group_by'] = {
    init: function() {
      this.appendValueInput('COLUMN')
          .setCheck('SQL_VALUE')
          .appendField('GROUP BY');
      this.setPreviousStatement(true, 'SQL_STATEMENT');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_SELECT);
      this.setTooltip('指定した列でデータをグループ化します。');
    }
  };

  // --- ORDER BY ブロック (ソート) ---
  Blockly.Blocks['sql_order_by'] = {
    init: function() {
      this.appendValueInput('COLUMN')
          .setCheck('SQL_VALUE')
          .appendField('ORDER BY');
      this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([
            ['昇順 (ASC)', 'ASC'],
            ['降順 (DESC)', 'DESC']
          ]), 'DIR');
      this.setPreviousStatement(true, 'SQL_STATEMENT');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_SELECT);
      this.setTooltip('指定した列に基づいてデータを並べ替えます。');
      this.setInputsInline(true);
    }
  };

  // --- LIMIT ブロック (件数制限) ---
  Blockly.Blocks['sql_limit'] = {
    init: function() {
      this.appendDummyInput()
          .appendField('LIMIT')
          .appendField(new Blockly.FieldNumber(5, 0, 100, 1), 'LIMIT_NUM');
      this.setPreviousStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_SELECT);
      this.setTooltip('取得する最大行数を指定します。');
    }
  };

  // --- INSERT ブロック (データ追加 - ハット型) ---
  Blockly.Blocks['sql_insert'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_VALUE')
          .appendField('INSERT INTO');
      this.appendDummyInput()
          .appendField('VALUES (');
      this.appendValueInput('VALUES')
          .setCheck('SQL_VALUE');
      this.appendDummyInput()
          .appendField(')');
      this.setColour(COL_DML);
      this.setTooltip('テーブルに新しいレコードを追加します。カンマ区切りで値を並べます。');
      this.setInputsInline(true);
    }
  };

  // --- UPDATE ブロック (データ更新 - ハット型) ---
  Blockly.Blocks['sql_update'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_VALUE')
          .appendField('UPDATE');
      this.appendValueInput('COLUMN')
          .setCheck('SQL_VALUE')
          .appendField('SET');
      this.appendValueInput('VALUE')
          .setCheck('SQL_VALUE')
          .appendField('=');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_DML);
      this.setTooltip('テーブル内の既存データを更新します。WHERE句と組み合わせて更新対象を限定します。');
      this.setInputsInline(true);
    }
  };

  // --- DELETE ブロック (データ削除 - ハット型) ---
  Blockly.Blocks['sql_delete'] = {
    init: function() {
      this.appendValueInput('TABLE')
          .setCheck('SQL_VALUE')
          .appendField('DELETE FROM');
      this.setNextStatement(true, 'SQL_STATEMENT');
      this.setColour(COL_DML);
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
          .appendField(new Blockly.FieldDropdown([
            ['すべての列 (*)', '*'],
            ['emp_id (社員ID)', 'emp_id'],
            ['name (氏名)', 'name'],
            ['role (役職)', 'role'],
            ['salary (給与)', 'salary'],
            ['dept_id (部門ID)', 'employees.dept_id'],
            ['dept_name (部門名)', 'dept_name'],
            ['location (勤務地)', 'location'],
            ['[集計] 平均給与 AVG(salary)', 'AVG(salary)'],
            ['[集計] 合計給与 SUM(salary)', 'SUM(salary)'],
            ['[集計] 人数 COUNT(*)', 'COUNT(*)']
          ]), 'COLUMN');
      this.setOutput(true, 'SQL_VALUE');
      this.setColour(COL_VALUE);
      this.setTooltip('クエリで指定する列名（または集計関数）を選択します。');
    }
  };

  // --- テーブル名指定用ブロック ---
  Blockly.Blocks['sql_val_table'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([
            ['employees (社員)', 'employees'],
            ['departments (部門)', 'departments']
          ]), 'TABLE');
      this.setOutput(true, 'SQL_VALUE');
      this.setColour(COL_TABLE);
      this.setTooltip('クエリの対象とするテーブル名を選択します。');
    }
  };

  // --- 比較条件ブロック (WHERE句用) ---
  Blockly.Blocks['sql_val_compare'] = {
    init: function() {
      this.appendValueInput('LEFT')
          .setCheck('SQL_VALUE');
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
          .setCheck('SQL_VALUE');
      this.setOutput(true, 'SQL_VALUE');
      this.setColour(COL_WHERE);
      this.setTooltip('左辺と右辺を比較する条件を作成します。文字の一致には LIKE を使います。');
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
      this.setOutput(true, 'SQL_VALUE');
      this.setColour(COL_VALUE);
      this.setTooltip('SQL文中の文字列または数値を指定します。自動的に引用符で囲まれます。');
    }
  };

  // --- 複数値の連結ブロック (INSERT VALUES用など) ---
  Blockly.Blocks['sql_val_list'] = {
    init: function() {
      this.appendValueInput('VAL1')
          .setCheck('SQL_VALUE');
      this.appendValueInput('VAL2')
          .setCheck('SQL_VALUE')
          .appendField(',');
      this.appendValueInput('VAL3')
          .setCheck('SQL_VALUE')
          .appendField(',');
      this.setOutput(true, 'SQL_VALUE');
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
