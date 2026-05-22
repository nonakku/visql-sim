import alasql from 'alasql';
import Papa from 'papaparse';
import { initialDepartments, initialEmployees } from './samples';

// データベースの初期化
export function initDatabase() {
  // テーブルの削除と再作成
  alasql('DROP TABLE IF EXISTS employees');
  alasql('DROP TABLE IF EXISTS departments');

  // カラムの型を明確に定義してテーブルを作成
  alasql('CREATE TABLE departments (dept_id STRING, dept_name STRING, location STRING)');
  alasql('CREATE TABLE employees (emp_id INT, name STRING, role STRING, salary INT, dept_id STRING)');

  // 初期データの投入
  initialDepartments.forEach(dept => {
    alasql('INSERT INTO departments VALUES (?, ?, ?)', [dept.dept_id, dept.dept_name, dept.location]);
  });
  
  initialEmployees.forEach(emp => {
    alasql('INSERT INTO employees VALUES (?, ?, ?, ?, ?)', [emp.emp_id, emp.name, emp.role, emp.salary, emp.dept_id]);
  });
}

// データベースからすべてのテーブル名を取得する
export function getTables() {
  return Object.keys(alasql.tables);
}

// テーブルのスキーマ（カラム名一覧）を取得する
export function getTableColumns(tableName) {
  if (!alasql.tables[tableName]) return [];
  const columns = alasql.tables[tableName].columns;
  if (columns && columns.length > 0) {
    return columns.map(col => col.columnid);
  }
  // カラム定義が動的オブジェクトの場合は、データを1件取得してキー名から推測
  const sample = alasql(`SELECT * FROM ${tableName} LIMIT 1`);
  if (sample && sample.length > 0) {
    return Object.keys(sample[0]);
  }
  return [];
}

// テーブルの全データを取得する
export function getTableData(tableName) {
  if (!alasql.tables[tableName]) return [];
  return alasql(`SELECT * FROM ${tableName}`);
}

// CSVデータをパースしてAlaSQLにインポートする
export function importCSV(tableName, csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  const data = result.data;
  if (data.length === 0) {
    throw new Error('CSVファイルにデータが含まれていません。');
  }

  // カラム名抽出
  const columns = Object.keys(data[0]);
  
  // 既存テーブルがあれば削除
  alasql(`DROP TABLE IF EXISTS ${tableName}`);
  
  // カラム定義を文字列で結合してテーブル作成 (動的に適したデータ型を推測する簡易ロジック)
  const columnDefs = columns.map(col => {
    const val = data[0][col];
    if (typeof val === 'number') {
      return `${col} INT`;
    }
    return `${col} STRING`;
  }).join(', ');

  alasql(`CREATE TABLE ${tableName} (${columnDefs})`);

  // データ挿入
  data.forEach(row => {
    const values = columns.map(col => row[col]);
    const placeholders = columns.map(() => '?').join(', ');
    alasql(`INSERT INTO ${tableName} VALUES (${placeholders})`, values);
  });

  return {
    tableName,
    rowCount: data.length,
    columns
  };
}

// SQLを実行し、Before/Afterの差分（Diff）を検出する
export function executeQueryWithDiff(sqlText) {
  const sqlClean = sqlText.trim().replace(/\s+/g, ' ');
  let queryType = 'SELECT';
  let targetTable = '';

  // クエリの種類と対象テーブルの判別
  if (/^INSERT\s+INTO\s+(\w+)/i.test(sqlClean)) {
    queryType = 'INSERT';
    targetTable = sqlClean.match(/^INSERT\s+INTO\s+(\w+)/i)[1];
  } else if (/^UPDATE\s+(\w+)/i.test(sqlClean)) {
    queryType = 'UPDATE';
    targetTable = sqlClean.match(/^UPDATE\s+(\w+)/i)[1];
  } else if (/^DELETE\s+FROM\s+(\w+)/i.test(sqlClean)) {
    queryType = 'DELETE';
    targetTable = sqlClean.match(/^DELETE\s+FROM\s+(\w+)/i)[1];
  } else if (/^SELECT\s+/i.test(sqlClean)) {
    queryType = 'SELECT';
    const fromMatch = sqlClean.match(/FROM\s+(\w+)/i);
    if (fromMatch) targetTable = fromMatch[1];
  }

  // SELECT クエリ、または対象テーブルが特定できない・存在しない場合は差分なしで標準実行
  if (queryType === 'SELECT' || !targetTable || !alasql.tables[targetTable]) {
    const result = alasql(sqlText);
    return {
      queryType,
      targetTable,
      isDiff: false,
      result
    };
  }

  // 1. 実行前のデータスナップショットを退避
  const beforeData = JSON.parse(JSON.stringify(getTableData(targetTable)));
  const columns = getTableColumns(targetTable);
  const keyField = columns[0]; // 第一カラムを主キーとみなして差分比較を行う

  // 2. クエリの実行
  const rawResult = alasql(sqlText);

  // 3. 実行後のデータスナップショットを取得
  const afterData = JSON.parse(JSON.stringify(getTableData(targetTable)));

  // 4. 差分検出 (Diff) ロジック
  const beforeMap = new Map(beforeData.map(row => [row[keyField], row]));
  const afterMap = new Map(afterData.map(row => [row[keyField], row]));

  const diffResult = [];

  // before と after から一意の主キーリストを順序維持しつつ作成
  const allKeys = Array.from(new Set([
    ...beforeData.map(row => row[keyField]),
    ...afterData.map(row => row[keyField])
  ]));

  allKeys.forEach(key => {
    const beforeRow = beforeMap.get(key);
    const afterRow = afterMap.get(key);

    if (beforeRow && !afterRow) {
      // 削除された行 (DELETE)
      diffResult.push({
        status: 'deleted',
        key,
        data: beforeRow,
        originalData: beforeRow,
        changedFields: []
      });
    } else if (!beforeRow && afterRow) {
      // 追加された行 (INSERT)
      diffResult.push({
        status: 'inserted',
        key,
        data: afterRow,
        originalData: null,
        changedFields: []
      });
    } else if (beforeRow && afterRow) {
      // 変更があったかチェック
      const changedFields = [];
      columns.forEach(col => {
        // nullやundefinedの厳密比較に対応
        const bVal = beforeRow[col];
        const aVal = afterRow[col];
        if (bVal !== aVal) {
          changedFields.push(col);
        }
      });

      if (changedFields.length > 0) {
        // 更新された行 (UPDATE)
        diffResult.push({
          status: 'updated',
          key,
          data: afterRow,
          originalData: beforeRow,
          changedFields
        });
      } else {
        // 変更なし (UNCHANGED)
        diffResult.push({
          status: 'unchanged',
          key,
          data: afterRow,
          originalData: beforeRow,
          changedFields: []
        });
      }
    }
  });

  return {
    queryType,
    targetTable,
    isDiff: true,
    result: rawResult,
    before: beforeData,
    after: afterData,
    diff: diffResult,
    columns,
    keyField
  };
}
