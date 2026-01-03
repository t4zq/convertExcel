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

// %!TEX コメントからエンジンを抽出する関数（runlatex.jsベース）
// uplatex, platexも対応
const engineregex = /% *!TEX.*[^a-zA-Z](((pdf|xe|lua|u?p)?latex(-dev)?)|uplatex|platex|asy|context|(pdf|xe|lua|[ou]?p)?tex) *\n/i;
const returnregex = /% *!TEX.*[^a-zA-Z](pdfjs|pdf|log|make4ht|latexml|lwarp) *\n/i;
const bibregex = /% *!TEX.*[^a-zA-Z](p?bibtex8?|biber) *\n/i;
const makeglossariesregex = /% *!TEX.*[^a-zA-Z](makeglossaries(-light)?) *\n/i;
const makeindexregex = /% *!TEX.*[^a-zA-Z]makeindex( [a-z0-9\.\- ]*)\n/ig;

function extractEngineFromTeX(texCode) {
  const match = texCode.match(engineregex);
  if (match) {
    return match[1].toLowerCase();
  }
  // fontspecやdirectluaなどから自動検出
  return defaultEngineFromContent(texCode);
}

// コンテンツからデフォルトエンジンを推測
function defaultEngineFromContent(texCode) {
  if ((texCode.indexOf('\\usepackage{lua') !== -1) || (texCode.indexOf('\\directlua') !== -1)) {
    return 'lualatex';
  } else if (texCode.indexOf('fontspec') !== -1) {
    return 'xelatex';
  } else if (texCode.indexOf('pstricks') !== -1) {
    return 'latex';
  }
  return null;
}

// %!TEX return パラメータを抽出する関数
function extractReturnFormat(texCode) {
  const match = texCode.match(returnregex);
  if (match) {
    return match[1].toLowerCase();
  }
  return 'pdfjs'; // デフォルトはpdf.js
}

// bibcmdを抽出
function extractBibCmd(texCode) {
  const match = texCode.match(bibregex);
  return match ? match[1].toLowerCase() : null;
}

// makeglossariesを抽出
function extractMakeGlossaries(texCode) {
  const match = texCode.match(makeglossariesregex);
  return match ? match[1].toLowerCase() : null;
}

// makeindexコマンドを抽出（複数可能）
function extractMakeIndex(texCode) {
  const indices = [];
  let match;
  while ((match = makeindexregex.exec(texCode)) !== null) {
    indices.push(match[1].trim());
  }
  return indices;
}

// フォーム送信によるLaTeXコンパイル（CORS回避）
function submitLatexForm(formId, texCode, engine = 'pdflatex') {
  const form = document.getElementById(formId);
  form.innerHTML = '';
  
  // %!TEX コメントからエンジンを自動抽出
  const autoEngine = extractEngineFromTeX(texCode);
  if (autoEngine) {
    engine = autoEngine;
    console.log(`エンジンを自動検出: ${engine}`);
  }
  
  // ファイル内容
  const fileContents = document.createElement('textarea');
  fileContents.name = 'filecontents[]';
  fileContents.textContent = texCode;
  form.appendChild(fileContents);
  
  // ファイル名
  const fileName = document.createElement('input');
  fileName.type = 'hidden';
  fileName.name = 'filename[]';
  fileName.value = 'document.tex';
  form.appendChild(fileName);
  
  // エンジン
  const engineInput = document.createElement('input');
  engineInput.type = 'hidden';
  engineInput.name = 'engine';
  engineInput.value = engine;
  form.appendChild(engineInput);
  
  // 戻り形式（PDF.jsを使用）
  const returnInput = document.createElement('input');
  returnInput.type = 'hidden';
  returnInput.name = 'return';
  returnInput.value = 'pdfjs';
  form.appendChild(returnInput);
  
  // bibtexサポート
  const bibcmd = extractBibCmd(texCode);
  if (bibcmd) {
    const bibInput = document.createElement('input');
    bibInput.type = 'hidden';
    bibInput.name = 'bibcmd';
    bibInput.value = bibcmd;
    form.appendChild(bibInput);
  }
  
  // makeglossariesサポート
  const makegloss = extractMakeGlossaries(texCode);
  if (makegloss) {
    const glossInput = document.createElement('input');
    glossInput.type = 'hidden';
    glossInput.name = 'makeglossaries';
    glossInput.value = makegloss;
    form.appendChild(glossInput);
  }
  
  // フォーム送信
  form.submit();
}

// LaTeXプレビュー
const latexPreviewBtn = document.getElementById('latex-preview-btn');
const latexDeleteBtn = document.getElementById('latex-delete-btn');

if (latexPreviewBtn) {
  latexPreviewBtn.addEventListener('click', () => {
    const texCode = editors.latex.getValue().trim();
    if (!texCode) {
      alert('LaTeXコードが空です。まずLaTeXボタンで出力を生成してください。');
      return;
    }
    
    // upLaTeXを使用して日本語対応
    const fullTexCode = `% !TEX uplatex
\\documentclass[uplatex,a4paper,12pt]{jsarticle}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{float}
\\usepackage{xcolor}
\\usepackage[dvipdfmx]{hyperref}
\\usepackage[dvipdfmx]{geometry}
\\geometry{a4paper,margin=25mm}
\\begin{document}
${texCode}
\\end{document}`;
    
    const loading = document.getElementById('latex-loading');
    loading.classList.add('active');
    
    // フォーム送信
    submitLatexForm('latex-form', fullTexCode, 'uplatex');
    
    // プレビューを表示
    document.getElementById('latex-pdf-preview').style.display = 'block';
    latexDeleteBtn.style.display = 'inline-block';
    
    // ローディング解除（iframeが読み込まれたら）
    const iframe = document.getElementById('latex-iframe');
    iframe.onload = () => {
      loading.classList.remove('active');
    };
    
    // スクロール
    setTimeout(() => {
      document.getElementById('latex-pdf-preview').scrollIntoView({ behavior: 'smooth' });
    }, 100);
  });
}

if (latexDeleteBtn) {
  latexDeleteBtn.addEventListener('click', () => {
    document.getElementById('latex-pdf-preview').style.display = 'none';
    document.getElementById('latex-iframe').src = 'about:blank';
    latexDeleteBtn.style.display = 'none';
  });
}

// TikZプレビュー
const tikzPreviewBtn = document.getElementById('tikz-preview-btn');
const tikzDeleteBtn = document.getElementById('tikz-delete-btn');

if (tikzPreviewBtn) {
  tikzPreviewBtn.addEventListener('click', () => {
    // プレビュー用にデータ埋め込み版のTikZコードを生成
    const data = editors.input.getValue().trim();
    if (!data) {
      alert('入力データが空です。まずデータを入力してください。');
      return;
    }
    
    // WebAssemblyモジュールが初期化されるまで待機
    ConvertModule().then(M => {
      const call = (ptr) => { const s = M.UTF8ToString(ptr); M._free(ptr); return s; };
      const genTikzGraphPreview = M.cwrap('gen_tikz_graph_preview', 'number', ['string', 'number', 'string', 'string']);
      
      const sigFigs = document.getElementById('sig-figs');
      const legendPos = document.getElementById('legend-pos');
      const scaleMode = document.getElementById('scale-mode');
      
      const sf = parseInt(sigFigs.value) || 3;
      const lp = legendPos.value || 'north west';
      const sm = scaleMode.value || 'linear';
      
      // プレビュー用のTikZコード（データ埋め込み版）を生成
      const tikzCode = call(genTikzGraphPreview(data, sf, lp, sm));
      
      if (!tikzCode) {
        alert('TikZコードの生成に失敗しました。データ形式を確認してください。');
        return;
      }
      
      // upLaTeXを使用して日本語対応
      const fullTexCode = `% !TEX uplatex
\\documentclass[uplatex,a4paper,12pt]{jsarticle}
\\usepackage{amsmath,amssymb}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{float}
\\usepackage{xcolor}
\\usepackage[dvipdfmx]{geometry}
\\geometry{a4paper,margin=25mm}
\\pgfplotsset{compat=1.18}
\\begin{document}
${tikzCode}
\\end{document}`;
      
      const loading = document.getElementById('tikz-loading');
      loading.classList.add('active');
      
      // フォーム送信
      submitLatexForm('tikz-form', fullTexCode, 'uplatex');
      
      // プレビューを表示
      document.getElementById('tikz-pdf-preview').style.display = 'block';
      tikzDeleteBtn.style.display = 'inline-block';
      
      // ローディング解除（iframeが読み込まれたら）
      const iframe = document.getElementById('tikz-iframe');
      iframe.onload = () => {
        loading.classList.remove('active');
      };
      
      // スクロール
      setTimeout(() => {
        document.getElementById('tikz-pdf-preview').scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  });
}

if (tikzDeleteBtn) {
  tikzDeleteBtn.addEventListener('click', () => {
    document.getElementById('tikz-pdf-preview').style.display = 'none';
    document.getElementById('tikz-iframe').src = 'about:blank';
    tikzDeleteBtn.style.display = 'none';
  });
}

// WebAssemblyモジュール初期化とイベントハンドラ
ConvertModule().then(M => {
  const call = (ptr) => { const s = M.UTF8ToString(ptr); M._free(ptr); return s; };
  const genLatex = M.cwrap('gen_latex', 'number', ['string']);
  const genCsv = M.cwrap('gen_csv', 'number', ['string']);
  const genLatexRounded = M.cwrap('gen_latex_rounded', 'number', ['string', 'number']);
  const genLatexSigFigs = M.cwrap('gen_latex_sig_figs', 'number', ['string', 'number']);
  const genTikzGraph = M.cwrap('gen_tikz_graph', 'number', ['string', 'string', 'number', 'string', 'string']);
  const genTikzGraphPreview = M.cwrap('gen_tikz_graph_preview', 'number', ['string', 'number', 'string', 'string']);
  
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
    
    // CSVは常に生データを出力（丸め処理は適用しない）
    const result = call(genCsv(data));
    
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