$ErrorActionPreference = "Stop"

Write-Host "=== WASM Build Script ===" -ForegroundColor Cyan

# Set emsdk environment
$env:EMSDK = "C:/Users/kei01/emsdk"
$env:EMSDK_NODE = "C:\Users\kei01\emsdk\node\22.16.0_64bit\bin\node.exe"
$env:EMSDK_PYTHON = "C:\Users\kei01\emsdk\python\3.13.3_64bit\python.exe"
$env:PATH = "C:\Users\kei01\emsdk\upstream\emscripten;C:\Users\kei01\emsdk\node\22.16.0_64bit\bin;C:\Users\kei01\emsdk\python\3.13.3_64bit;$env:PATH"

Write-Host "Environment configured" -ForegroundColor Green
Write-Host "Python: $env:EMSDK_PYTHON" -ForegroundColor Gray
Write-Host "Node: $env:EMSDK_NODE" -ForegroundColor Gray

# Build command
$buildCmd = @(
  "C:\Users\kei01\emsdk\python\3.13.3_64bit\python.exe",
  "C:\Users\kei01\emsdk\upstream\emscripten\emcc.py",
  "convert.cpp",
  "-O3",
  "-s", "WASM=1",
  "-s", "MODULARIZE=1",
  "-s", "EXPORT_NAME=ConvertModule",
  "-s", "EXPORTED_FUNCTIONS=[_gen_latex,_gen_csv,_gen_latex_rounded,_gen_latex_sig_figs,_gen_tikz_graph,_gen_tikz_graph_preview,_free]",
  "-s", "EXPORTED_RUNTIME_METHODS=[cwrap,UTF8ToString]",
  "-o", "dist/convert.js"
)

Write-Host "`nBuilding WASM..." -ForegroundColor Cyan
& $buildCmd[0] $buildCmd[1..($buildCmd.Length-1)]

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✅ Build successful!" -ForegroundColor Green
  Write-Host "`nGenerated files:" -ForegroundColor Cyan
  Get-ChildItem dist\ -Filter "convert.*" | ForEach-Object {
    Write-Host "  $($_.Name) - $([math]::Round($_.Length/1KB, 2)) KB" -ForegroundColor Gray
  }
} else {
  Write-Host "`n❌ Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}
