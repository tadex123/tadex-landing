# Minimal local web server for testing the hub (no Node/Python needed).
#   powershell -File tools\serve-local.ps1 -Port 8765            -> normal (real Supabase via /sb proxy is NOT available; sign-in will not work)
#   powershell -File tools\serve-local.ps1 -Port 8766 -Preview   -> serves an empty config.js so ?preview=apps|admin|noapps|direktor works with sample data
param([int]$Port = 8765, [switch]$Preview)
$root = Split-Path -Parent $PSScriptRoot
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg"; ".woff2"="font/woff2"; ".mp4"="video/mp4"; ".txt"="text/plain; charset=utf-8" }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
"Serving $root on http://localhost:$Port/ (preview=$Preview)"
while ($l.IsListening) {
  $ctx = $l.GetContext(); $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($Preview -and $path -eq "/config.js") {
      $body = [Text.Encoding]::UTF8.GetBytes('export const SUPABASE_PROJECT_URL = ""; export const SUPABASE_URL = ""; export const SUPABASE_STORAGE_KEY = "local-preview"; export const SUPABASE_ANON_KEY = "";')
      $res.ContentType = $types[".js"]; $res.OutputStream.Write($body, 0, $body.Length); $res.Close(); continue
    }
    $file = Join-Path $root ($path.TrimStart("/") -replace "/", "\")
    if ((Test-Path $file -PathType Container)) { $file = Join-Path $file "index.html" }
    $full = [IO.Path]::GetFullPath($file)
    if (-not $full.StartsWith($root) -or -not (Test-Path $full -PathType Leaf)) { $res.StatusCode = 404; $res.Close(); continue }
    $ext = [IO.Path]::GetExtension($full).ToLower()
    $res.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
    $res.Headers.Add("Cache-Control", "no-store")
    $bytes = [IO.File]::ReadAllBytes($full)
    $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close()
  } catch { try { $res.StatusCode = 500; $res.Close() } catch {} }
}
