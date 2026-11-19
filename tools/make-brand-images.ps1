# Generates the PNG brand images used by index.html (favicon-32, apple-touch-icon, link-preview card).
# Windows PowerShell 5.1: run from the repo root with  powershell -File tools\make-brand-images.ps1
# Colours from the TadexChina logo: navy #0c163a, pink #e92264.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
$navy = [System.Drawing.Color]::FromArgb(12, 22, 58)
$pink = [System.Drawing.Color]::FromArgb(233, 34, 100)
$white = [System.Drawing.Color]::White

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}

# Square icon: same drawing as favicon.svg (64-unit grid), scaled to $size.
function Save-Icon([int]$size, [string]$file, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.Clear([System.Drawing.Color]::Transparent)
  $k = $size / 64.0
  $bg = New-Object System.Drawing.SolidBrush $navy
  if ($rounded) { $g.FillPath($bg, (New-RoundRect 0 0 $size $size (14 * $k))) } else { $g.FillRectangle($bg, 0, 0, $size, $size) }
  $wb = New-Object System.Drawing.SolidBrush $white
  $g.FillRectangle($wb, [float](14 * $k), [float](17 * $k), [float](30 * $k), [float](8 * $k))
  $g.FillRectangle($wb, [float](25 * $k), [float](25 * $k), [float](8 * $k), [float](23 * $k))
  $pb = New-Object System.Drawing.SolidBrush $pink
  $g.FillEllipse($pb, [float](41 * $k), [float](37 * $k), [float](14 * $k), [float](14 * $k))
  $bmp.Save((Join-Path $assets $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Save-Icon 32 "favicon-32.png" $true
# iOS rounds the corners itself, so the touch icon is a full square.
Save-Icon 180 "apple-touch-icon.png" $false

# Link-preview card 1200x630 (WhatsApp, Viber, Slack, email).
$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAliasGridFit"
$g.Clear($navy)
# faint graticule, echoing the route map
$grid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(18, 255, 255, 255)), 1
for ($x = 0; $x -le $W; $x += 60) { $g.DrawLine($grid, $x, 0, $x, $H) }
for ($y = 0; $y -le $H; $y += 60) { $g.DrawLine($grid, 0, $y, $W, $y) }
# sea-route arc with port dots
$route = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 255, 255, 255)), 4
$route.StartCap = "Round"; $route.EndCap = "Round"
$g.DrawBezier($route, 1110, 140, 980, 380, 760, 470, 560, 520)
$dash = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 255, 255, 255)), 3
$dash.DashStyle = "Dash"
$g.DrawBezier($dash, 1110, 140, 1090, 430, 860, 540, 560, 520)
$wb = New-Object System.Drawing.SolidBrush $white
$pb = New-Object System.Drawing.SolidBrush $pink
$g.FillEllipse($wb, 1100, 130, 20, 20)
$g.FillEllipse($pb, 548, 508, 24, 24)

$family = "Segoe UI"
$fBig = New-Object System.Drawing.Font $family, 104, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$fPill = New-Object System.Drawing.Font $family, 46, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$fSub = New-Object System.Drawing.Font $family, 38, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fSmall = New-Object System.Drawing.Font $family, 28, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205, 214, 234))
$fmt = [System.Drawing.StringFormat]::GenericTypographic

$g.DrawString("TADEX", $fBig, $wb, 80, 150, $fmt)
$tw = $g.MeasureString("TADEX", $fBig, 2000, $fmt).Width
$pillText = "Hub"
$pw = $g.MeasureString($pillText, $fPill, 2000, $fmt).Width + 48
$g.FillPath($pb, (New-RoundRect (80 + $tw + 22) 180 $pw 74 37))
$g.DrawString($pillText, $fPill, $wb, (80 + $tw + 22 + 24), 189, $fmt)
# Non-ASCII built from code points: Windows PowerShell 5.1 reads a BOM-less script as ANSI.
$dot = [string][char]0x00B7; $arr = [string][char]0x2192; $c = [string][char]0x010D
$yiwu = [string][char]0x4E49 + [char]0x4E4C; $gz = [string][char]0x5E7F + [char]0x5DDE
$g.DrawString("Radni prostor tima  $dot  Team workspace", $fSub, $muted, 84, 300, $fmt)
$fCjk = New-Object System.Drawing.Font "Microsoft YaHei", 28, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString("$yiwu Yiwu $dot $gz Guangzhou  $arr  Plo${c}e $dot Rijeka $dot Koper  $arr  BiH", $fCjk, $muted, 84, 548, $fmt)
$g.DrawString("tadexhub.com", $fSmall, $wb, 84, 80, $fmt)

$bmp.Save((Join-Path $assets "og-tadex-hub.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"ok"
