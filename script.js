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

// LaTeX PDF プレビュー機能
const latexPreviewBtn = document.getElementById('latex-preview-btn');
const latexEngine = document.getElementById('latex-engine');
const latexLoading = document.getElementById('latex-loading');
const latexPdfPreview = document.getElementById('latex-pdf-preview');
const latexPdfFrame = document.getElementById('latex-pdf-frame');

// TikZ PDF プレビュー機能
const tikzPreviewBtn = document.getElementById('tikz-preview-btn');
const tikzEngine = document.getElementById('tikz-engine');
const tikzLoading = document.getElementById('tikz-loading');
const tikzPdfPreview = document.getElementById('tikz-pdf-preview');
const tikzPdfFrame = document.getElementById('tikz-pdf-frame');

// texlive.netでLaTeXをコンパイルする関数
async function compileLatex(texCode, engine = 'pdflatex') {
  const formData = new FormData();
  
  // ファイル名とコンテンツを設定
  formData.append('filename[]', 'document.tex');
  formData.append('filecontents[]', texCode);
  
  // エンジンを設定
  formData.append('engine', engine);
  
  // PDF.jsを使用したプレビューを要求
  formData.append('return', 'pdfjs');
  
  try {
    const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      // エラーレスポンスのテキストを取得
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}\n${errorText}`);
    }
    
    // レスポンスがHTMLの場合（PDF.jsビューア）
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const html = await response.text();
      // エラーメッセージが含まれているかチェック
      if (html.includes('LaTeX Error') || html.includes('! ')) {
        // HTMLからエラーログを抽出
        const errorMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        const errorLog = errorMatch ? errorMatch[1] : html;
        return { success: false, error: 'コンパイルエラー', log: errorLog };
      }
      return { success: true, html: html };
    }
    
    // PDFバイナリの場合
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return { success: true, pdfUrl: url };
    
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    return { success: false, error: error.message };
  }
}

// LaTeXプレビューボタンのイベントハンドラ
if (latexPreviewBtn) {
  latexPreviewBtn.addEventListener('click', async () => {
    const texCode = editors.latex.getValue().trim();
    
    if (!texCode) {
      alert('LaTeXコードが空です。まずLaTeXボタンで出力を生成してください。');
      return;
    }
    
    // LaTeXテーブルを完全なドキュメントにラップ
    const fullTexCode = `\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{booktabs}

\\begin{document}

${texCode}

\\end{document}`;
    
    // ローディング表示
    latexLoading.classList.add('active');
    latexPreviewBtn.disabled = true;
    
    try {
      const engine = latexEngine.value;
      const result = await compileLatex(fullTexCode, engine);
      
      if (result.success) {
        latexPdfPreview.style.display = 'block';
        
        if (result.html) {
          // HTMLレスポンス（PDF.js）の場合
          latexPdfFrame.srcdoc = result.html;
        } else if (result.pdfUrl) {
          // PDFバイナリの場合
          latexPdfFrame.src = result.pdfUrl;
        }
      } else {
        // エラーメッセージを詳細に表示
        let errorMessage = 'LaTeXのコンパイルに失敗しました:\n\n' + result.error;
        if (result.log) {
          console.error('LaTeX Compilation Log:', result.log);
          errorMessage += '\n\n詳細なエラーログはコンソールを確認してください（F12キー）。';
          // ログから重要なエラー行を抽出
          const errorLines = result.log.split('\n').filter(line => 
            line.includes('Error') || line.startsWith('!') || line.includes('l.')
          ).slice(0, 10).join('\n');
          if (errorLines) {
            errorMessage += '\n\n主なエラー:\n' + errorLines;
          }
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('LaTeX compilation error:', error);
      alert('エラーが発生しました: ' + error.message);
    } finally {
      // ローディング非表示
      latexLoading.classList.remove('active');
      latexPreviewBtn.disabled = false;
    }
  });
}

// TikZ PDFプレビューボタンのイベントハンドラ
if (tikzPreviewBtn) {
  tikzPreviewBtn.addEventListener('click', async () => {
    const texCode = editors.tikz.getValue().trim();
    
    if (!texCode) {
      alert('TikZコードが空です。まずTikZ グラフボタンで出力を生成してください。');
      return;
    }
    
    // TikZコードを完全なLaTeXドキュメントにラップ
    const fullTexCode = `\\documentclass[a4paper,12pt,titlepage]{ltjsarticle}
\\usepackage[utf8]{inputenc}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{float}
\\pgfplotsset{compat=1.18}

\\begin{document}

${texCode}

\\end{document}`;
    
    // ローディング表示
    tikzLoading.classList.add('active');
    tikzPreviewBtn.disabled = true;
    
    try {
      const engine = tikzEngine.value;
      const result = await compileLatex(fullTexCode, engine);
      
      if (result.success) {
        tikzPdfPreview.style.display = 'block';
        
        if (result.html) {
          // HTMLレスポンス（PDF.js）の場合
          tikzPdfFrame.srcdoc = result.html;
        } else if (result.pdfUrl) {
          // PDFバイナリの場合
          tikzPdfFrame.src = result.pdfUrl;
        }
      } else {
        // エラーメッセージを詳細に表示
        let errorMessage = 'TikZのコンパイルに失敗しました:\n\n' + result.error;
        if (result.log) {
          console.error('TikZ Compilation Log:', result.log);
          errorMessage += '\n\n詳細なエラーログはコンソールを確認してください（F12キー）。';
          // ログから重要なエラー行を抽出
          const errorLines = result.log.split('\n').filter(line => 
            line.includes('Error') || line.startsWith('!') || line.includes('l.')
          ).slice(0, 10).join('\n');
          if (errorLines) {
            errorMessage += '\n\n主なエラー:\n' + errorLines;
          }
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('TikZ compilation error:', error);
      alert('エラーが発生しました: ' + error.message);
    } finally {
      // ローディング非表示
      tikzLoading.classList.remove('active');
      tikzPreviewBtn.disabled = false;
    }
  });
}

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