const input = document.getElementById('input');
const latex = document.getElementById('latex');
const csv = document.getElementById('csv');
const tikz = document.getElementById('tikz');
const decimals = document.getElementById('decimals');
const sigFigs = document.getElementById('sig-figs');
const scientificOnlyTable = document.getElementById('scientific-only-table');
const filename = document.getElementById('filename');
const legendPos = document.getElementById('legend-pos');
const scaleMode = document.getElementById('scale-mode');
const previewBtn = document.getElementById('preview-btn');
const tikzPreview = document.getElementById('tikz-preview');

ConvertModule()
  .then((M) => {
    console.log('✅ WASM モジュールのロードに成功しました');
    const call = (ptr) => {
      const s = M.UTF8ToString(ptr);
      M._free(ptr);
      return s;
    };

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

    document.getElementById('latex-btn').onclick = () => {
      const data = input.value.trim();
      if (!data) return;
      // 表のみ指数表記（自動）: sigFigs を負値として渡し、C++ 側で切り替え
      if (scientificOnlyTable && scientificOnlyTable.checked) {
        const sf = parseInt(sigFigs.value) || 3;
        latex.value = call(genLatexSigFigs(data, -Math.abs(sf)));
        return;
      }
      const mode = getRoundMode();
      if (mode === 'decimal') {
        latex.value = call(genLatexRounded(data, parseInt(decimals.value) || 0));
      } else if (mode === 'sig-figs') {
        latex.value = call(genLatexSigFigs(data, parseInt(sigFigs.value) || 1));
      } else {
        latex.value = call(genLatex(data));
      }
    };

    document.getElementById('csv-btn').onclick = () => {
      const data = input.value.trim();
      if (!data) return;
      csv.value = call(genCsv(data));
    };

    document.getElementById('tikz-btn').onclick = () => {
      const data = input.value.trim();
      if (!data) return;
      const fname = filename.value.trim() || 'data';
      const sf = parseInt(sigFigs.value) || 3;
      const lp = legendPos.value || 'north west';
      const sm = scaleMode.value || 'linear';
      tikz.value = call(genTikzGraph(data, fname, sf, lp, sm));
    };

    previewBtn.onclick = () => {
      const data = input.value.trim();
      if (!data) {
        tikzPreview.innerHTML = '<div style="color:#999;padding:8px;">データを入力してください</div>';
        return;
      }
      const sf = parseInt(sigFigs.value) || 3;
      const lp = legendPos.value || 'north west';
      const sm = scaleMode.value || 'linear';

      const previewCode = call(genTikzGraphPreview(data, sf, lp, sm));

      // データをパースしてグラフ描画
      try {
        const table = parseTableData(data);
        if (table.length < 2 || table[0].length < 2) {
          throw new Error('少なくとも2列2行のデータが必要です');
        }

        // Chart.jsでグラフを描画
        if (window.Chart) {
          renderChartPreview(table, sm);
        } else {
          // Chart.jsが読み込めない場合はCanvasで簡易描画
          renderCanvasPreview(table, sm);
        }
        
        // TikZコードも下部に表示
        const tikzSection = `
          <div style="margin-top:20px;background:#f5f5f5;padding:12px;border-radius:4px;border:1px solid #ddd;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong>生成されたTikZコード:</strong>
              <button id="copy-tikz-preview" style="padding:4px 12px;background:#4CAF50;color:white;border:none;border-radius:3px;cursor:pointer;">コピー</button>
            </div>
            <pre id="tikz-code-preview" style="margin:0;padding:10px;background:white;border:1px solid #ccc;border-radius:3px;overflow:auto;max-height:200px;text-align:left;font-family:'Courier New',monospace;font-size:11px;line-height:1.4;">${previewCode}</pre>
          </div>
        `;
        tikzPreview.insertAdjacentHTML('beforeend', tikzSection);
        
        // コピーボタン
        document.getElementById('copy-tikz-preview').onclick = () => {
          navigator.clipboard.writeText(previewCode).then(() => {
            const btn = document.getElementById('copy-tikz-preview');
            btn.textContent = 'コピー完了!';
            btn.style.background = '#2196F3';
            setTimeout(() => {
              btn.textContent = 'コピー';
              btn.style.background = '#4CAF50';
            }, 2000);
          });
        };
      } catch (err) {
        tikzPreview.innerHTML = `<div style="color:red;padding:8px;">プレビュー生成エラー: ${err.message}</div>`;
      }
    };

    function parseTableData(data) {
      const lines = data.trim().split('\n');
      const table = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const delim = line.includes('\t') ? '\t' : ',';
        const cells = line.split(delim).map(c => c.trim());
        table.push(cells);
      }
      return table;
    }

    function renderChartPreview(table, scaleMode) {
      tikzPreview.innerHTML = `
        <div style="background:#e3f2fd;color:#1976d2;padding:8px;border-radius:4px;margin-bottom:10px;font-size:14px;">
          <strong>📊 グラフプレビュー</strong> (Chart.js使用)
        </div>
        <div style="background:white;padding:15px;border-radius:4px;border:1px solid #ddd;">
          <canvas id="preview-chart" style="max-height:350px;"></canvas>
        </div>
      `;

      const ctx = document.getElementById('preview-chart').getContext('2d');
      const datasets = [];
      const labels = table.slice(1).map(row => parseFloat(row[0]) || row[0]);

      for (let i = 1; i < table[0].length; i++) {
        const yData = table.slice(1).map(row => parseFloat(row[i]) || 0);
        const colors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0'];
        datasets.push({
          label: table[0][i] || `系列${i}`,
          data: yData,
          borderColor: colors[(i-1) % colors.length],
          backgroundColor: colors[(i-1) % colors.length] + '33',
          tension: 0.1
        });
      }

      new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { 
              type: scaleMode === 'loglog' || scaleMode === 'semilog' ? 'logarithmic' : 'linear',
              title: { display: true, text: table[0][0] || 'X軸' }
            },
            y: { 
              type: scaleMode === 'loglog' ? 'logarithmic' : 'linear',
              title: { display: true, text: 'Y軸' }
            }
          },
          plugins: {
            legend: { position: 'top' }
          }
        }
      });
    }

    function renderCanvasPreview(table, scaleMode) {
      tikzPreview.innerHTML = `
        <div style="background:#fff3cd;color:#856404;padding:8px;border-radius:4px;margin-bottom:10px;font-size:14px;">
          <strong>📊 簡易グラフプレビュー</strong> (Canvas使用 - Chart.jsが読み込めませんでした)
        </div>
        <div style="background:white;padding:15px;border-radius:4px;border:1px solid #ddd;">
          <canvas id="preview-canvas" width="600" height="400"></canvas>
        </div>
      `;

      const canvas = document.getElementById('preview-canvas');
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const padding = 60;

      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // データ抽出
      const xData = table.slice(1).map(row => parseFloat(row[0]));
      const yData = table.slice(1).map(row => parseFloat(row[1]));
      
      const xMin = Math.min(...xData);
      const xMax = Math.max(...xData);
      const yMin = Math.min(...yData);
      const yMax = Math.max(...yData);

      // スケール関数
      const xScale = (x) => padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
      const yScale = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);

      // 軸
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(padding, padding);
      ctx.stroke();

      // データプロット
      ctx.strokeStyle = '#2196F3';
      ctx.fillStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < xData.length; i++) {
        const x = xScale(xData[i]);
        const y = yScale(yData[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
      ctx.stroke();

      // ラベル
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.fillText(table[0][0] || 'X', width / 2, height - 20);
      ctx.save();
      ctx.translate(20, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(table[0][1] || 'Y', 0, 0);
      ctx.restore();
    }
  })
  .catch((err) => {
    console.error('❌ WASM モジュールのロードに失敗:', err);
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorDiv && errorText) {
      errorText.textContent = `WASM モジュール (convert.wasm) の読み込みに失敗しました。\n\nEmscripten でビルドが必要です:\n1) emsdk をインストール・有効化\n2) build_local.ps1 を実行\n\n詳細は README.md を参照してください。\n\nエラー: ${err.message}`;
      errorDiv.style.display = 'block';
    }
  });