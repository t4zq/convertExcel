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

// LaTeXプレビュー関連の要素
const latexPreviewBtn = document.getElementById('latex-preview-btn');
const latexClearPreviewBtn = document.getElementById('latex-clear-preview-btn');
const latexPreviewLoading = document.getElementById('latex-preview-loading');
const latexPreviewError = document.getElementById('latex-preview-error');
const latexPreviewContainer = document.getElementById('latex-preview-container');
const latexPreviewPdf = document.getElementById('latex-preview-pdf');

// texlive.netを使ったLaTeXコンパイル関数
async function compileLatexWithTexlive(latexCode) {
  const url = 'https://texlive.net/cgi-bin/latexcgi';
  
  // LaTeXコードを完全なドキュメントとして包む
  const fullDocument = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage[margin=1in]{geometry}
\\begin{document}
${latexCode}
\\end{document}`;

  // フォームデータとして送信
  const formData = new FormData();
  formData.append('filecontents[]', fullDocument);
  formData.append('filename[]', 'document.tex');
  formData.append('engine', 'pdflatex');
  formData.append('return', 'pdf');

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  
  // エラーメッセージの場合（テキスト）
  if (contentType && contentType.includes('text/plain')) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  // PDFの場合
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// LaTeXプレビューボタンのイベントハンドラ
latexPreviewBtn.addEventListener('click', async () => {
  const latexCode = editors.latex.getValue().trim();
  
  if (!latexCode) {
    alert('LaTeXコードがありません。先にLaTeX変換を実行してください。');
    return;
  }

  // UIの状態をリセット
  latexPreviewLoading.classList.add('active');
  latexPreviewError.classList.remove('active');
  latexPreviewContainer.style.display = 'none';
  latexPreviewError.textContent = '';

  try {
    const pdfUrl = await compileLatexWithTexlive(latexCode);
    latexPreviewPdf.src = pdfUrl;
    latexPreviewContainer.style.display = 'block';
  } catch (error) {
    latexPreviewError.textContent = `コンパイルエラー:\n${error.message}`;
    latexPreviewError.classList.add('active');
  } finally {
    latexPreviewLoading.classList.remove('active');
  }
});

// プレビューをクリアするボタン
latexClearPreviewBtn.addEventListener('click', () => {
  latexPreviewContainer.style.display = 'none';
  latexPreviewError.classList.remove('active');
  latexPreviewPdf.src = '';
  
  // Blob URLを解放
  if (latexPreviewPdf.src && latexPreviewPdf.src.startsWith('blob:')) {
    URL.revokeObjectURL(latexPreviewPdf.src);
  }
});


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
});