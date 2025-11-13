// HTML要素の取得
const excelDataInput = document.getElementById('excel-data-input');
const generateBtn = document.getElementById('generate-btn');
const generateCsvBtn = document.getElementById('generate-csv-btn');
const outputSection = document.getElementById('output-section');
const csvOutputSection = document.getElementById('csv-output-section');
const latexOutput = document.getElementById('latex-output');
const csvOutput = document.getElementById('csv-output');
const downloadCsvBtn = document.getElementById('download-csv-btn');
const significantFiguresSelect = document.getElementById('significant-figures');
/**
 * @param {string} inputData - 貼り付けられたテキストデータ
 * @returns {Array<Array<string>>} 解析されたデータ配列
 */
function parseExcelData(inputData) {
  try {
    // 改行で分割
    const lines = inputData.split('\n');
    const data = [];
    let maxCols = 0;
    
    // 最初のパスで有効な行のみを処理し、最大列数を取得
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim(); // trimで前後の空白を削除
      if (line) {
        let row;
        if (line.indexOf('\t') !== -1) { // タブ区切り(indexOf:\tが見つからなかったとき-1を返す→1でない場合は処理実行)
          row = line.split('\t');
        } else if (line.indexOf(',') !== -1) { // カンマ区切り
          row = line.split(',');
        } else {
          row = line.split(/\s+/); //テキストエリアに張り付けた後そのデータを弄る可能性を考慮してスペース区切りも対応
        }
        
        // セルのトリムを効率的に処理
        for (let j = 0; j < row.length; j++) {
          row[j] = row[j].trim();
        }
        
        data.push(row);
        if (row.length > maxCols) {
          maxCols = row.length;
        }
      }
    }
    
    if (data.length === 0) {
      alert('有効なデータが見つかりませんでした。');
      return null;
    }
    
    // 列数統一
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      while (row.length < maxCols) {
        row.push('');
      }
    }
    
    return data;
    
  } catch (error) {
    console.error('データ解析エラー:', error);
    alert('データの解析に失敗しました。正しい形式でデータを貼り付けてください。');
    return null;
  }
}


// LaTeX生成ボタンのイベントリスナー
generateBtn.addEventListener('click', () => {
  const inputData = excelDataInput.value.trim();
  if (!inputData) {
    alert('Excelデータを貼り付けてください。');
    return;
  }
  
  const data = parseExcelData(inputData);
  if (data && data.length > 0) {
    const latexCode = generateTabularCode(data);
    latexOutput.value = latexCode;
    outputSection.style.display = 'block';
    csvOutputSection.style.display = 'none';
  }
});

// CSV生成ボタンのイベントリスナー
generateCsvBtn.addEventListener('click', () => {
  const inputData = excelDataInput.value.trim();
  if (!inputData) {
    alert('Excelデータを貼り付けてください。');
    return;
  }
  
  const data = parseExcelData(inputData);
  if (data && data.length > 0) {
    const csvCode = generateCsvCode(data);
    csvOutput.value = csvCode;
    csvOutputSection.style.display = 'block';
    outputSection.style.display = 'none';
  }
});

// CSVダウンロードボタンのイベントリスナー
downloadCsvBtn.addEventListener('click', () => {
  if (csvOutput.value) {
    downloadCsvFile(csvOutput.value);
  } else {
    alert('先にCSVを生成してください。');
  }
});


/**
 * LaTeX tabularコード生成関数
 * @param {Array<Array<string>>} data - 表にするデータ
 * @returns {string} 生成されたLaTeXコード
 */
function generateTabularCode(data) {
  const numCols = data[0].length;
  const columnFormat = '{' + 'c'.repeat(numCols) + '}';
  
  const parts = [`\\begin{tabular}${columnFormat}\n\\hline\n`];
  
  const escapeRegex = /[&%$#_{}]/g;
  const escapeMap = {
    '&': '\\&', '%': '\\%', '$': '\\$', 
    '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}'
  };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const escapedCells = new Array(row.length);
    
    for (let j = 0; j < row.length; j++) {
      escapedCells[j] = String(row[j]).replace(escapeRegex, match => escapeMap[match]);
    }
    
    parts.push(escapedCells.join(' & ') + ' \\\\\n');
  }
  
  parts.push('\\hline\n\\end{tabular}');
  
  return parts.join('');
}

/**
 * CSVコード生成関数
 * @param {Array<Array<string>>} data - CSVにするデータ
 * @returns {string} 生成されたCSVコード
 */
function generateCsvCode(data) {
  const rows = new Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const cells = new Array(row.length);
    
    for (let j = 0; j < row.length; j++) {
      const cellStr = String(row[j]);
      if (cellStr.indexOf(',') !== -1 || cellStr.indexOf('\n') !== -1 || cellStr.indexOf('"') !== -1) {
        cells[j] = `"${cellStr.replace(/"/g, '""')}"`;
      } else {
        cells[j] = cellStr;
      }
    }
    
    rows[i] = cells.join(',');
  }
  
  return rows.join('\n');
}

/**
 * CSVデータをファイルとしてダウンロードする関数
 * @param {string} csvData - ダウンロードするCSVデータ
 */
function downloadCsvFile(csvData) {
  const bom = '\uFEFF';
  const csvContent = bom + csvData;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const fileName = `data_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}