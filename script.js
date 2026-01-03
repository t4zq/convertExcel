// Aceエディタの初期化
const editors = {};

// エディタ設定を適用する関数
function setupEditor(editorId, textareaId, mode = 'ace/mode/text', readOnly = false) {
  const editor = ace.edit(editorId);
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode(mode);
  editor.setOptions({
    fontSize: '14px',
    showPrintMargin: false,
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    enableSnippets: true,
    tabSize: 2,
    useSoftTabs: true,
    wrap: true,
    readOnly: readOnly
  });
  
  const textarea = document.getElementById(textareaId);
  
  // エディタの変更をtextareaに同期
  editor.session.on('change', function() {
    textarea.value = editor.getValue();
  });
  
  // 初期値の設定
  if (textarea.value) {
    editor.setValue(textarea.value, -1);
  }
  
  // placeholderの実装
  const placeholders = {
    'input': 'データを貼り付け',
    'latex': 'LaTeX形式で出力されます',
    'csv': 'CSV形式で出力されます',
    'tikz': 'TikZ/PGFPlotsグラフコードが出力されます'
  };
  
  if (placeholders[textareaId]) {
    editor.setOptions({
      placeholder: placeholders[textareaId]
    });
  }
  
  return editor;
}

// 各エディタをセットアップ
editors.input = setupEditor('input-editor', 'input', 'ace/mode/text', false);
editors.latex = setupEditor('latex-editor', 'latex', 'ace/mode/latex', true);
editors.csv = setupEditor('csv-editor', 'csv', 'ace/mode/text', true);
editors.tikz = setupEditor('tikz-editor', 'tikz', 'ace/mode/latex', true);

// 元のDOM要素への参照（後方互換性のため）
const input = document.getElementById('input');
const latex = document.getElementById('latex');
const csv = document.getElementById('csv');
const tikz = document.getElementById('tikz');
const decimals = document.getElementById('decimals');
const sigFigs = document.getElementById('sig-figs');
const filename = document.getElementById('filename');
const legendPos = document.getElementById('legend-pos');
const scaleMode = document.getElementById('scale-mode');
const previewBtn = document.getElementById('preview-btn');
const tikzPreview = document.getElementById('tikz-preview');

ConvertModule().then(M => {
  const call = (ptr) => { const s = M.UTF8ToString(ptr); M._free(ptr); return s; };
  const genLatex = M.cwrap('gen_latex', 'number', ['string']);
  const genCsv = M.cwrap('gen_csv', 'number', ['string']);
  const genLatexRounded = M.cwrap('gen_latex_rounded', 'number', ['string', 'number']);
  const genCsvRounded = M.cwrap('gen_csv_rounded', 'number', ['string', 'number']);
  const genLatexSigFigs = M.cwrap('gen_latex_sig_figs', 'number', ['string', 'number']);
  const genCsvSigFigs = M.cwrap('gen_csv_sig_figs', 'number', ['string', 'number']);
  const genTikzGraph = M.cwrap('gen_tikz_graph', 'number', ['string', 'string', 'number', 'string', 'string']);
  const genTikzGraphPreview = M.cwrap('gen_tikz_graph_preview', 'number', ['string', 'number', 'string', 'string']);
  
  const getRoundMode = () => {
    const selected = document.querySelector('input[name="round-mode"]:checked');
    return selected ? selected.value : 'none';
  };
  
  document.getElementById('latex-btn').onclick = () => {
    const data = editors.input.getValue().trim();
    if (data) {
      const mode = getRoundMode();
      let result;
      if (mode === 'decimal') {
        result = call(genLatexRounded(data, parseInt(decimals.value) || 0));
      } else if (mode === 'sig-figs') {
        result = call(genLatexSigFigs(data, parseInt(sigFigs.value) || 1));
      } else {
        result = call(genLatex(data));
      }
      editors.latex.setValue(result, -1);
      latex.value = result;
    }
  };
  
  document.getElementById('csv-btn').onclick = () => {
    const data = editors.input.getValue().trim();
    if (data) {
      const mode = getRoundMode();
      let result;
      if (mode === 'decimal') {
        result = call(genCsvRounded(data, parseInt(decimals.value) || 0));
      } else if (mode === 'sig-figs') {
        result = call(genCsvSigFigs(data, parseInt(sigFigs.value) || 1));
      } else {
        result = call(genCsv(data));
      }
      editors.csv.setValue(result, -1);
      csv.value = result;
    }
  };
  
  document.getElementById('tikz-btn').onclick = () => {
    const data = editors.input.getValue().trim();
    if (data) {
      const fname = filename.value.trim() || 'data';
      const sf = parseInt(sigFigs.value) || 3;
      const lp = legendPos.value || 'north west';
      const sm = scaleMode.value || 'linear';
      const result = call(genTikzGraph(data, fname, sf, lp, sm));
      editors.tikz.setValue(result, -1);
      tikz.value = result;
    }
  };
  
  previewBtn.onclick = () => {
    const data = editors.input.getValue().trim();
    if (data) {
      const sf = parseInt(sigFigs.value) || 3;
      const lp = legendPos.value || 'north west';
      const sm = scaleMode.value || 'linear';
      
      // プレビュー用のTikZコード（データ埋め込み）を生成
      const previewCode = call(genTikzGraphPreview(data, sf, lp, sm));
      
      tikzPreview.innerHTML = '';
      const script = document.createElement('script');
      script.type = 'text/tikz';
      script.textContent = previewCode;
      tikzPreview.appendChild(script);
      
      // TikZJaxを再実行してレンダリング
      if (window.tikzjax) {
        window.tikzjax.processTikz();
      }
    }
  };
});