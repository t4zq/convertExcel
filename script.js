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
const engineregex = /% *!TEX.*[^a-zA-Z](((pdf|xe|lua|u?p)?latex(-dev)?)|asy|context|(pdf|xe|lua|[ou]?p)?tex) *\n/i;
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
// PDF.jsを使用してPDFをレンダリング
class PDFViewer {
  constructor(containerId, prefix) {
    this.container = document.getElementById(containerId);
    this.prefix = prefix;
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageCount = 0;
    this.scale = 1.5;
    this.rendering = false;
    
    // コントロール要素
    this.prevBtn = document.getElementById(`${prefix}-prev`);
    this.nextBtn = document.getElementById(`${prefix}-next`);
    this.pageNumInput = document.getElementById(`${prefix}-page-num`);
    this.pageCountSpan = document.getElementById(`${prefix}-page-count`);
    this.zoomInBtn = document.getElementById(`${prefix}-zoom-in`);
    this.zoomOutBtn = document.getElementById(`${prefix}-zoom-out`);
    this.zoomSpan = document.getElementById(`${prefix}-zoom`);
    this.canvasContainer = document.getElementById(`${prefix}-canvas-container`);
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        if (this.pageNum <= 1) return;
        this.pageNum--;
        this.renderPage();
      });
    }
    
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        if (this.pageNum >= this.pageCount) return;
        this.pageNum++;
        this.renderPage();
      });
    }
    
    if (this.pageNumInput) {
      this.pageNumInput.addEventListener('change', (e) => {
        let page = parseInt(e.target.value);
        if (page < 1) page = 1;
        if (page > this.pageCount) page = this.pageCount;
        this.pageNum = page;
        this.renderPage();
      });
    }
    
    if (this.zoomInBtn) {
      this.zoomInBtn.addEventListener('click', () => {
        this.scale += 0.25;
        if (this.scale > 3) this.scale = 3;
        this.updateZoomDisplay();
        this.renderPage();
      });
    }
    
    if (this.zoomOutBtn) {
      this.zoomOutBtn.addEventListener('click', () => {
        this.scale -= 0.25;
        if (this.scale < 0.5) this.scale = 0.5;
        this.updateZoomDisplay();
        this.renderPage();
      });
    }
  }
  
  updateZoomDisplay() {
    if (this.zoomSpan) {
      this.zoomSpan.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }
  
  updatePageControls() {
    if (this.pageNumInput) this.pageNumInput.value = this.pageNum;
    if (this.pageCountSpan) this.pageCountSpan.textContent = this.pageCount;
    if (this.prevBtn) this.prevBtn.disabled = this.pageNum <= 1;
    if (this.nextBtn) this.nextBtn.disabled = this.pageNum >= this.pageCount;
    if (this.pageNumInput) {
      this.pageNumInput.min = 1;
      this.pageNumInput.max = this.pageCount;
    }
  }
  
  async loadPDF(pdfUrl) {
    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      this.pdfDoc = await loadingTask.promise;
      this.pageCount = this.pdfDoc.numPages;
      this.pageNum = 1;
      this.updatePageControls();
      this.updateZoomDisplay();
      await this.renderAllPages();
    } catch (error) {
      console.error('PDF読み込みエラー:', error);
      throw error;
    }
  }
  
  async renderPage() {
    if (this.rendering) return;
    this.rendering = true;
    
    try {
      const page = await this.pdfDoc.getPage(this.pageNum);
      const viewport = page.getViewport({ scale: this.scale });
      
      // 既存のcanvasを取得または新規作成
      let canvas = this.canvasContainer.querySelector(`canvas[data-page="${this.pageNum}"]`);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.dataset.page = this.pageNum;
      }
      
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      this.updatePageControls();
    } catch (error) {
      console.error(`ページ ${this.pageNum} のレンダリングエラー:`, error);
    } finally {
      this.rendering = false;
    }
  }
  
  async renderAllPages() {
    this.canvasContainer.innerHTML = '';
    
    for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
      try {
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.dataset.page = pageNum;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        this.canvasContainer.appendChild(canvas);
      } catch (error) {
        console.error(`ページ ${pageNum} のレンダリングエラー:`, error);
      }
    }
    
    this.updatePageControls();
  }
  
  clear() {
    this.canvasContainer.innerHTML = '';
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageCount = 0;
    this.updatePageControls();
  }
}

// PDFビューアーインスタンス
const latexPDFViewer = new PDFViewer('latex-pdf-canvas-container', 'latex-pdf');
const tikzPDFViewer = new PDFViewer('tikz-pdf-canvas-container', 'tikz-pdf');
// LaTeXコンパイル関数（texlive.net API使用）- runlatex.js拡張版
async function compileLatex(texCode, engine = 'pdflatex', returnFormat = 'pdf') {
  // %!TEX コメントからエンジンを自動抽出（指定がある場合は上書き）
  const autoEngine = extractEngineFromTeX(texCode);
  if (autoEngine) {
    engine = autoEngine;
    console.log(`エンジンを自動検出: ${engine}`);
  }
  
  // %!TEX return コメントから返却形式を抽出
  const autoReturn = extractReturnFormat(texCode);
  if (autoReturn !== 'pdfjs') {
    returnFormat = autoReturn;
  }
  
  const formData = new FormData();
  formData.append('filename[]', 'document.tex');
  formData.append('filecontents[]', texCode);
  formData.append('engine', engine);
  formData.append('return', returnFormat === 'log' ? 'log' : 'pdf');  // PDFまたはログ
  
  // bibtexサポート
  const bibcmd = extractBibCmd(texCode);
  if (bibcmd) {
    formData.append('bibcmd', bibcmd);
    console.log(`BibTeXコマンド: ${bibcmd}`);
  }
  
  // makeglossariesサポート
  const makegloss = extractMakeGlossaries(texCode);
  if (makegloss) {
    formData.append('makeglossaries', makegloss);
    console.log(`Makeglossaries: ${makegloss}`);
  }
  
  // makeindexサポート（複数可能）
  const makeindices = extractMakeIndex(texCode);
  for (const idx of makeindices) {
    formData.append('makeindex[]', idx);
    console.log(`Makeindex: ${idx}`);
  }
  
  try {
    const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    console.log('Response Content-Type:', contentType);
    
    // PDFが正常に返された場合
    if (contentType.includes('application/pdf')) {
      const blob = await response.blob();
      console.log('PDF blob size:', blob.size);
      return { success: true, pdfUrl: URL.createObjectURL(blob) };
    }
    
    // エラーログが返された場合（text/plain）
    if (contentType.includes('text/plain')) {
      const log = await response.text();
      console.error('Compilation log:', log);
      
      // ログファイルとして要求された場合は成功として扱う
      if (returnFormat === 'log') {
        return { success: true, isLog: true, log: log };
      }
      
      return { success: false, error: 'コンパイルエラー', log: log };
    }
    
    // その他のレスポンス（念のため）
    const blob = await response.blob();
    console.log('Unknown response type, blob size:', blob.size);
    
    // PDFかどうかを内容で判定（マジックナンバー）
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const isPDF = bytes.length >= 4 && 
                  bytes[0] === 0x25 && bytes[1] === 0x50 && 
                  bytes[2] === 0x44 && bytes[3] === 0x46; // "%PDF"
    
    if (isPDF) {
      console.log('Detected PDF by magic number');
      return { success: true, pdfUrl: URL.createObjectURL(blob) };
    }
    
    // PDFでない場合はエラーログとして扱う
    const decoder = new TextDecoder('utf-8');
    const log = decoder.decode(bytes);
    console.error('Non-PDF response:', log.substring(0, 500));
    return { success: false, error: 'コンパイルエラー', log: log };
    
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    
    let errorMsg = error.message;
    if (error.name === 'TypeError' && errorMsg.includes('Failed to fetch')) {
      errorMsg = 'ネットワークエラー: texlive.netに接続できません。\n\n考えられる原因:\n- インターネット接続の問題\n- サービスが一時的に利用不可\n- CORS制限（ローカルファイルからのアクセス）\n\nしばらく待ってから再度お試しください。';
    }
    
    return { success: false, error: errorMsg };
  }
}

// プレビュー表示の共通処理（PDF.js使用）
async function showPreviewResult(result, previewElement, viewer, type) {
  if (result.success) {
    previewElement.style.display = 'block';
    
    // ログファイルの場合はテキストとして表示
    if (result.isLog) {
      const logContent = document.createElement('pre');
      logContent.textContent = result.log;
      logContent.style.cssText = 'background-color: #f5f5f5; padding: 1em; overflow: auto; max-height: 600px; border: 1px solid #ccc;';
      
      // 既存のコンテンツをクリアしてログを表示
      viewer.container.parentElement.style.display = 'none';
      const logContainer = previewElement.querySelector('.log-container') || document.createElement('div');
      logContainer.className = 'log-container';
      logContainer.innerHTML = '';
      logContainer.appendChild(logContent);
      if (!previewElement.querySelector('.log-container')) {
        previewElement.appendChild(logContainer);
      }
    } else {
      // PDFの場合：PDF.jsで読み込んで表示
      viewer.container.parentElement.style.display = 'block';
      const logContainer = previewElement.querySelector('.log-container');
      if (logContainer) logContainer.style.display = 'none';
      
      try {
        await viewer.loadPDF(result.pdfUrl);
      } catch (error) {
        alert(`PDFの読み込みに失敗しました: ${error.message}`);
        return;
      }
    }
    
    // プレビューエリアが画面下部近くにある場合はスクロール
    const rect = previewElement.getBoundingClientRect();
    if (document.documentElement.clientHeight - rect.bottom < 50) {
      window.scrollBy({ top: 150, behavior: 'smooth' });
    }
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
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{float}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{a4paper,margin=25mm}
\\begin{document}
${texCode}
\\end{document}`;
    
    const loading = document.getElementById('latex-loading');
    loading.classList.add('active');
    loading.textContent = 'PDFをコンパイル中...';
    latexPreviewBtn.disabled = true;
    
    // タイムアウト警告（10秒後）
    const timeoutWarning = setTimeout(() => {
      loading.textContent = 'コンパイルに時間がかかっています... しばらくお待ちください';
    }, 10000);
    
    try {
      const result = await compileLatex(fullTexCode, 'pdflatex');
      clearTimeout(timeoutWarning);
      await showPreviewResult(result, 
        document.getElementById('latex-pdf-preview'),
        latexPDFViewer,
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
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{float}
\\usepackage{xcolor}
\\usepackage{geometry}
\\geometry{a4paper,margin=25mm}
\\pgfplotsset{compat=1.18}
\\begin{document}
${texCode}
\\end{document}`;
    
    const loading = document.getElementById('tikz-loading');
    loading.classList.add('active');
    loading.textContent = 'PDFをコンパイル中...';
    tikzPreviewBtn.disabled = true;
    
    // タイムアウト警告（15秒後 - TikZは時間がかかる可能性が高い）
    const timeoutWarning = setTimeout(() => {
      loading.textContent = 'TikZ/PGFplotsのコンパイルに時間がかかっています...';
    }, 15000);
    
    try {
      const result = await compileLatex(fullTexCode, 'pdflatex');
      clearTimeout(timeoutWarning);
      await showPreviewResult(result,
        document.getElementById('tikz-pdf-preview'),
        tikzPDFViewer,
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