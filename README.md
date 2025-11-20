# convertExcel (JS → C++/WASM 最小JS化)

本リポジトリは、これまで JavaScript で行っていたデータ解析・LaTeX/CSV 生成処理を C++ 実装へ移行し、Emscripten により WebAssembly としてブラウザから呼び出す構成に変更しています。フロント側の JS は UI と WASM 呼び出しの最小限に抑えています。

## 🚀 GitHub Pages でそのまま使えます

**https://T4zq.github.io/convertExcel/** にアクセスするだけで、何も設定せずに使用できます。

WASMファイルは GitHub Actions で自動ビルドされ、リポジトリにコミットされています。

## 変更点の概要
- C++ 実装: `cpp/convert.cpp`
  - 入力テキストを行/セルに分解、列数を揃える処理
  - LaTeX のエスケープと `tabular` 出力生成
  - CSV のクォートルールに基づく出力生成
- 最小 JS 化: `script.js`
  - UI のイベントと WASM 関数呼び出しのみ
  - 生成済み文字列の表示と CSV ダウンロード処理のみ維持
- HTML: `index.html`
  - `dist/convert.js`（Emscripten 出力）を先に読み込み、その後に `script.js` を読み込み

## 自動ビルド（GitHub Actions）

C++コードを変更すると、GitHub Actionsが自動的にWASMをビルドして`dist/`にコミットします。
手動でビルドする必要はありません。

### ローカルでビルドする場合

Emscripten SDK が必要です:
- セットアップ: https://emscripten.org/docs/getting_started/downloads.html

Windows PowerShell の例:
```powershell
# emsdk の導入例（未導入の場合）
# git clone https://github.com/emscripten-core/emsdk
# cd emsdk
# .\emsdk install latest; .\emsdk activate latest
# .\emsdk_env.ps1  # セッションにパスを通す
```

ビルドコマンド:
```powershell
# 出力フォルダ作成
New-Item -ItemType Directory -Force -Path dist | Out-Null

# C++ → WASM/JS へビルド
emcc cpp/convert.cpp -O3 `
  -s WASM=1 `
  -s MODULARIZE=1 `
  -s EXPORT_NAME=ConvertModule `
  -s EXPORTED_FUNCTIONS='[_gen_latex,_gen_csv,_free]' `
  -s EXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString"]' `
  -o dist/convert.js
```

## ローカルでの起動

```powershell
# Python がある場合
python -m http.server 8000

# Node.js がある場合
npx http-server -p 8000
```

ブラウザで `http://localhost:8000/` を開きます。

## 使い方
- テキストエリアに Excel からコピーしたデータを貼り付け
- 「表を生成」→ LaTeX を生成
- 「CSVを生成」→ CSV を生成（必要なら「CSVファイルをダウンロードする」）

## 備考
- `significant-figures`（有効数字）は UI のみ現状維持で、C++ 側では未適用です（今後の拡張ポイント）。
- 既存 JS の解析/生成ロジックは C++ に移行済みです。
