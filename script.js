// HTML要素の取得（UIのみ維持）
const excelDataInput = document.getElementById('excel-data-input');
const generateBtn = document.getElementById('generate-btn');
const generateCsvBtn = document.getElementById('generate-csv-btn');
const outputSection = document.getElementById('output-section');
const csvOutputSection = document.getElementById('csv-output-section');
const latexOutput = document.getElementById('latex-output');
const csvOutput = document.getElementById('csv-output');
const significantFiguresSelect = document.getElementById('significant-figures');

// WASM モジュール準備が完了するまでボタン無効化
generateBtn.disabled = true;
generateCsvBtn.disabled = true;

// Emscripten の MODULARIZE 出力を読み込んだ前提（index.html で dist/convert.js を先読み込み）
// EXPORT_NAME=ConvertModule を想定
const moduleReady = (typeof ConvertModule === 'function')
  ? ConvertModule()
  : Promise.reject(new Error('WASM モジュール convert.js が読み込まれていません'));

moduleReady.then((Module) => {
  // C++ 側関数へのバインディング（ポインタを返す → JSで文字列化して手動解放）
  const genLatexPtr = Module.cwrap('gen_latex', 'number', ['string']);
  const genCsvPtr = Module.cwrap('gen_csv', 'number', ['string']);

  function callString(ptr) {
    if (!ptr) return '';
    const s = Module.UTF8ToString(ptr);
    Module._free(ptr);
    return s;
  }

  // LaTeX生成
  generateBtn.addEventListener('click', () => {
    const inputData = excelDataInput.value.trim();
    if (!inputData) {
      alert('Excelデータを貼り付けてください。');
      return;
    }
    const ptr = genLatexPtr(inputData);
    const latexCode = callString(ptr);
    if (!latexCode) {
      alert('有効なデータが見つかりませんでした。');
      return;
    }
    latexOutput.value = latexCode;
    outputSection.style.display = 'block';
    csvOutputSection.style.display = 'none';
  });

  // CSV生成
  generateCsvBtn.addEventListener('click', () => {
    const inputData = excelDataInput.value.trim();
    if (!inputData) {
      alert('Excelデータを貼り付けてください。');
      return;
    }
    const ptr = genCsvPtr(inputData);
    const csvCode = callString(ptr);
    if (!csvCode) {
      alert('有効なデータが見つかりませんでした。');
      return;
    }
    csvOutput.value = csvCode;
    csvOutputSection.style.display = 'block';
    outputSection.style.display = 'none';
  });

  // 準備完了 → 有効化
  generateBtn.disabled = false;
  generateCsvBtn.disabled = false;
}).catch((err) => {
  console.error(err);
  alert('WASM モジュールの読み込みに失敗しました。ビルド手順を確認してください。');
});