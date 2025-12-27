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
    const data = input.value.trim();
    if (data) {
      const mode = getRoundMode();
      if (mode === 'decimal') {
        latex.value = call(genLatexRounded(data, parseInt(decimals.value) || 0));
      } else if (mode === 'sig-figs') {
        latex.value = call(genLatexSigFigs(data, parseInt(sigFigs.value) || 1));
      } else {
        latex.value = call(genLatex(data));
      }
    }
  };
  
  document.getElementById('csv-btn').onclick = () => {
    const data = input.value.trim();
    if (data) {
      const mode = getRoundMode();
      if (mode === 'decimal') {
        csv.value = call(genCsvRounded(data, parseInt(decimals.value) || 0));
      } else if (mode === 'sig-figs') {
        csv.value = call(genCsvSigFigs(data, parseInt(sigFigs.value) || 1));
      } else {
        csv.value = call(genCsv(data));
      }
    }
  };
  
  document.getElementById('tikz-btn').onclick = () => {
    const data = input.value.trim();
    if (data) {
      const fname = filename.value.trim() || 'data';
      const sf = parseInt(sigFigs.value) || 3;
      const lp = legendPos.value || 'north west';
      const sm = scaleMode.value || 'linear';
      tikz.value = call(genTikzGraph(data, fname, sf, lp, sm));
    }
  };
  
  previewBtn.onclick = () => {
    const data = input.value.trim();
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