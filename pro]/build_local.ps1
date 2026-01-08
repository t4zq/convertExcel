# Requires: emscripten (emcc) available in PATH
# Usage: powershell -ExecutionPolicy Bypass -File ./build_local.ps1

$ErrorActionPreference = "Stop"

# Check emcc availability
$emcc = Get-Command emcc -ErrorAction SilentlyContinue
if (-not $emcc) {
  Write-Host "[ERROR] emcc が見つかりません。emsdk をインストールし、emsdk_env.bat を実行してください。" -ForegroundColor Red
  exit 1
}

# Ensure dist directory
$distPath = Join-Path $PSScriptRoot "dist"
if (-not (Test-Path $distPath)) {
  New-Item -ItemType Directory -Path $distPath | Out-Null
}

# Build command
$cmd = @(
  "emcc",
  "convert.cpp",
  "-O3",
  "-s","WASM=1",
  "-s","MODULARIZE=1",
  "-s","EXPORT_NAME=ConvertModule",
  "-s","EXPORTED_FUNCTIONS=[_gen_latex,_gen_csv,_gen_latex_rounded,_gen_latex_sig_figs,_gen_tikz_graph,_gen_tikz_graph_preview,_free]",
  "-s","EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"UTF8ToString\"]",
  "-o","dist/convert.js"
)

Write-Host "[BUILD] Emscripten コンパイルを開始します..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $cmd[0] -ArgumentList $cmd[1..($cmd.Length-1)] -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) {
  Write-Host "[ERROR] emcc のコンパイルに失敗しました (ExitCode=$($proc.ExitCode))" -ForegroundColor Red
  exit $proc.ExitCode
}

Write-Host "[DONE] dist/convert.js / dist/convert.wasm を生成しました。" -ForegroundColor Green
