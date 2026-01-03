# データ変換ツール（LaTeX / CSV / TikZ）

ブラウザでデータを貼り付けて LaTeX表・CSV・TikZグラフコードに変換するツールです。WASM（Emscripten）を使用しています。

## 🚀 クイックスタート

### 1. ビルド（初回のみ）

**Windows（emsdkインストール済み）**
```powershell
.\build_now.ps1
```

成果物: `dist/convert.js`, `dist/convert.wasm`

### 2. ローカルサーバで起動

```powershell
# Python がある場合
python -m http.server 5500

# または Node.js がある場合
npx http-server -p 5500
```

### 3. ブラウザで開く

http://localhost:5500/index.html

## 使い方

1. **入力欄にデータを貼り付け**（CSV形式またはタブ区切り）
2. **丸め方式を選択**
   - 丸めなし
   - 小数点以下の桁数
   - 有効数字
   - **表のみ指数表記（自動）** ← NEW!
3. **各ボタンで出力**
   - LaTeX: 表形式（tabular）
   - CSV: カンマ区切り
   - TikZ グラフ: PGFPlotsコード生成

### 表のみ指数表記（自動）- NEW!

「表のみ指数表記（自動）」チェックをオンにすると、LaTeX表出力時のみ、数値セルに対して自動的に科学（指数）表記が適用されます。

- **適用条件**: `|x| >= 10000` または `|x| < 0.001` のとき
- **出力形式**: `$1.23 \times 10^{4}$`（LaTeX数式モード）
- **適用範囲**: LaTeX表のみ（CSV・TikZ出力には影響なし）
- **非数値セル**: そのまま保持

## ビルド方法（詳細）

### 必要なもの
- [Emscripten (emsdk)](https://emscripten.org/docs/getting_started/downloads.html)

### ビルド手順

1. **emsdkのセットアップ**
   ```powershell
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   .\emsdk install latest
   .\emsdk activate latest
   ```

2. **ビルド実行**
   ```powershell
   # パスが設定済みの場合
   .\build_now.ps1
   
   # または手動で
   emcc convert.cpp -O3 -s WASM=1 -s MODULARIZE=1 \
     -s EXPORT_NAME=ConvertModule \
     -s EXPORTED_FUNCTIONS=[_gen_latex,_gen_csv,_gen_latex_rounded,_gen_latex_sig_figs,_gen_tikz_graph,_gen_tikz_graph_preview,_free] \
     -s EXPORTED_RUNTIME_METHODS=[cwrap,UTF8ToString] \
     -o dist/convert.js
   ```

## プロジェクト構造

```
pro]/
├── convert.cpp          # C++ソースコード（変換ロジック）
├── index.html           # メインHTML
├── script.js            # JavaScriptロジック（UI制御）
├── style.css            # スタイルシート
├── build_now.ps1        # ビルドスクリプト（Windows、emsdkパス設定済み）
├── build_local.ps1      # ビルドスクリプト（emscripten PATH設定済みの環境用）
├── build.yml            # GitHub Actions用（CI/CD）
├── dist/                # ビルド成果物（自動生成）
│   ├── convert.js
│   └── convert.wasm
├── .vscode/             # VS Code設定
│   └── tasks.json
└── README.md
```

## 注意点

- **CSVモード**: 丸め処理は適用されず、常に元の値を出力します
- **WASMファイル**: `file://` プロトコルでは動作しません。必ずHTTPサーバ経由で実行してください
- **ブラウザキャッシュ**: ビルド後は `Ctrl+Shift+R` で強制リロードしてください

## ライセンス

このプロジェクトは個人利用・学術利用を想定しています。

