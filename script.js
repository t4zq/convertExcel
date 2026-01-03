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
  editor.session.on('change', () => {
    textarea.value = editor.getValue();
  });
  
  // 初期値とプレースホルダー設定
  if (textarea.value) {
    editor.setValue(textarea.value, -1);
  }
  
  const placeholders = {
    'input': 'データを貼り付け',
    'latex': 'LaTeX形式で出力されます',
    'csv': 'CSV形式で出力されます',
    'tikz': 'TikZ/PGFPlotsグラフコードが出力されます'
  };
  
  if (placeholders[textareaId]) {
    editor.setOptions({ placeholder: placeholders[textareaId] });
  }
  
  return editor;
}

// 各エディタをセットアップ
editors.input = setupEditor('input-editor', 'input', 'ace/mode/text', false);
editors.latex = setupEditor('latex-editor', 'latex', 'ace/mode/latex', true);
editors.csv = setupEditor('csv-editor', 'csv', 'ace/mode/text', true);
editors.tikz = setupEditor('tikz-editor', 'tikz', 'ace/mode/latex', true);

// DOM要素への参照
const latex = document.getElementById('latex');
const csv = document.getElementById('csv');
const tikz = document.getElementById('tikz');

// LaTeXコンパイル関数（texlive.net API使用）
async function compileLatex(texCode, engine = 'pdflatex') {
  const formData = new FormData();
  formData.append('filecontents[]', texCode);
  formData.append('filename[]', 'document.tex');
  formData.append('engine', engine);
  
  try {
    const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // レスポンスをBlobとして取得
    const blob = await response.blob();
    
    // Content-Typeを確認
    const contentType = response.headers.get('content-type') || '';
    
    // PDFの場合
    if (contentType.includes('application/pdf') || blob.type === 'application/pdf') {
      return { success: true, pdfUrl: URL.createObjectURL(blob) };
    }
    
    // HTMLレスポンス（エラーの可能性）
    const text = await blob.text();
    
    // エラーメッセージの抽出
    if (text.includes('LaTeX Error') || text.includes('! ')) {
      const errorMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      const errorLog = errorMatch ? errorMatch[1] : text;
      return { success: false, error: 'コンパイルエラー', log: errorLog };
    }
    
    // PDFデータかどうかを確認（マジックナンバー）
    if (text.startsWith('%PDF')) {
      const pdfBlob = new Blob([text], { type: 'application/pdf' });
      return { success: true, pdfUrl: URL.createObjectURL(pdfBlob) };
    }
    
    throw new Error('コンパイルに失敗しました');
    
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    
    let errorMsg = error.message;
    if (error.name === 'TypeError' && errorMsg.includes('Failed to fetch')) {
      errorMsg = 'ネットワークエラー: texlive.netに接続できません。\n\n考えられる原因:\n- インターネット接続の問題\n- サービスが一時的に利用不可\n\nしばらく待ってから再度お試しください。';
    }
    
    return { success: false, error: errorMsg };
  }
}

// プレビュー表示の共通処理
function showPreviewResult(result, previewElement, frameElement, type) {
  if (result.success) {
    previewElement.style.display = 'block';
    frameElement.src = result.pdfUrl;
  } else {
    let errorMessage = `${type}のコンパイルに失敗しました:\n\n${result.error}`;
    if (result.log) {
      console.error(`${type} Compilation Log:`, result.log);
      errorMessage += '\n\n詳細なエラーログはコンソールを確認してください（F12キー）。';
      const errorLines = result.log.split('\n')
        .filter(line => line.includes('Error') || line.startsWith('!') || line.includes('l.'))
        .slice(0, 10)
        .join('\n');
      if (errorLines) {
        errorMessage += '\n\n主なエラー:\n' + errorLines;
      }
    }
    alert(errorMessage);
  }
}

// LaTeXプレビュー
const latexPreviewBtn = document.getElementById('latex-preview-btn');
if (latexPreviewBtn) {
  latexPreviewBtn.addEventListener('click', async () => {
    const texCode = editors.latex.getValue().trim();
    if (!texCode) {
      alert('LaTeXコードが空です。まずLaTeXボタンで出力を生成してください。');
      return;
    }
    
    const fullTexCode = `\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{booktabs}
\\begin{document}
${texCode}
\\end{document}`;
    
    const loading = document.getElementById('latex-loading');
    loading.classList.add('active');
    latexPreviewBtn.disabled = true;
    
    try {
      const engine = document.getElementById('latex-engine').value;
      const result = await compileLatex(fullTexCode, engine);
      showPreviewResult(result, 
        document.getElementById('latex-pdf-preview'),
        document.getElementById('latex-pdf-frame'),
        'LaTeX'
      );
    } catch (error) {
      alert('エラーが発生しました: ' + error.message);
    } finally {
      loading.classList.remove('active');
      latexPreviewBtn.disabled = false;
    }
  });
}

// TikZプレビュー
const tikzPreviewBtn = document.getElementById('tikz-preview-btn');
if (tikzPreviewBtn) {
  tikzPreviewBtn.addEventListener('click', async () => {
    const texCode = editors.tikz.getValue().trim();
    if (!texCode) {
      alert('TikZコードが空です。まずTikZ グラフボタンで出力を生成してください。');
      return;
    }
    
    const fullTexCode = `\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{float}
\\pgfplotsset{compat=1.18}
\\begin{document}
${texCode}
\\end{document}`;
    
    const loading = document.getElementById('tikz-loading');
    loading.classList.add('active');
    tikzPreviewBtn.disabled = true;
    
    try {
      const engine = document.getElementById('tikz-engine').value;
      const result = await compileLatex(fullTexCode, engine);
      showPreviewResult(result,
        document.getElementById('tikz-pdf-preview'),
        document.getElementById('tikz-pdf-frame'),
        'TikZ'
      );
    } catch (error) {
      alert('エラーが発生しました: ' + error.message);
    } finally {
      loading.classList.remove('active');
      tikzPreviewBtn.disabled = false;
    }
  });
}

// WebAssemblyモジュール初期化とイベントハンドラ
ConvertModule().then(M => {
  const call = (ptr) => { const s = M.UTF8ToString(ptr); M._free(ptr); return s; };
  const genLatex = M.cwrap('gen_latex', 'number', ['string']);
  const genCsv = M.cwrap('gen_csv', 'number', ['string']);
  const genLatexRounded = M.cwrap('gen_latex_rounded', 'number', ['string', 'number']);
  const genCsvRounded = M.cwrap('gen_csv_rounded', 'number', ['string', 'number']);
  const genLatexSigFigs = M.cwrap('gen_latex_sig_figs', 'number', ['string', 'number']);
  const genCsvSigFigs = M.cwrap('gen_csv_sig_figs', 'number', ['string', 'number']);
  const genTikzGraph = M.cwrap('gen_tikz_graph', 'number', ['string', 'string', 'number', 'string', 'string']);
  
  const getRoundMode = () => {
    const selected = document.querySelector('input[name="round-mode"]:checked');
    return selected ? selected.value : 'none';
  };
  
  // LaTeX変換
  document.getElementById('latex-btn').onclick = () => {
    const data = editors.input.getValue().trim();
    if (!data) return;
    
    const mode = getRoundMode();
    const decimals = document.getElementById('decimals');
    const sigFigs = document.getElementById('sig-figs');
    
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
  };
  
  // CSV変換
  document.getElementById('csv-btn').onclick = () => {
    const data = editors.input.getValue().trim();
    if (!data) return;
    
    const mode = getRoundMode();
    const decimals = document.getElementById('decimals');
    const sigFigs = document.getElementById('sig-figs');
    
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
  };
  
  // TikZグラフ生成
  document.getElementById('tikz-btn').onclick = () => {
    const data = editors.input.getValue().trim();
    if (!data) return;
    
    const filename = document.getElementById('filename');
    const sigFigs = document.getElementById('sig-figs');
    const legendPos = document.getElementById('legend-pos');
    const scaleMode = document.getElementById('scale-mode');
    
    const fname = filename.value.trim() || 'data';
    const sf = parseInt(sigFigs.value) || 3;
    const lp = legendPos.value || 'north west';
    const sm = scaleMode.value || 'linear';
    
    const result = call(genTikzGraph(data, fname, sf, lp, sm));
    editors.tikz.setValue(result, -1);
    tikz.value = result;
  };
});