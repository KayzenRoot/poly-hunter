$ErrorActionPreference = 'Stop'
$page = 'apps/web/app/page.tsx'
$backup = Join-Path $env:TEMP 'ph-sec-wo006-page.tsx.bak'
$evidence = '.engineering/evidence/PH-SEC-WO-006/validation/C/hot-reload.txt'
$logFile = '.engineering/evidence/PH-SEC-WO-006/validation/C/web-logs-hot-reload.txt'
$marker = 'PH-SEC-WO-006-HOST-POLL-PROBE-20261004'
$pagePath = Join-Path (Get-Location) $page
$originalHash = (Get-FileHash $pagePath -Algorithm SHA256).Hash
Copy-Item -LiteralPath $pagePath -Destination $backup -Force
$markerContainer = $false
$markerHttp = $false
$restoreContainer = $false
$restoreHttp = $false
$httpMarkerCode = 0
$httpRestoreCode = 0

try {
    $original = [System.IO.File]::ReadAllText($pagePath)
    $needle = '<h1>PolyHunter engineering shell</h1>'
    if (($original.Split($needle).Length - 1) -ne 1) {
        throw 'Unique JSX insertion point not found'
    }

    $changed = $original.Replace($needle, "$needle`r`n      <p id=`"ph-sec-wo006-poll-probe`">$marker</p>")
    [System.IO.File]::WriteAllText($pagePath, $changed, [System.Text.UTF8Encoding]::new($false))

    for ($i = 0; $i -lt 30; $i++) {
        docker exec polyhunter-web sh -c "grep -F '$marker' /workspace/apps/web/app/page.tsx" *> $null
        if ($LASTEXITCODE -eq 0) {
            $markerContainer = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $markerContainer) {
        throw 'Host marker did not appear inside the web container'
    }

    for ($i = 0; $i -lt 40; $i++) {
        try {
            $response = Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200 -and $response.Content.Contains($marker)) {
                $markerHttp = $true
                $httpMarkerCode = [int]$response.StatusCode
                [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.engineering/evidence/PH-SEC-WO-006/validation/C/http-marker.html'), $response.Content, [System.Text.UTF8Encoding]::new($false))
                break
            }
        }
        catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $markerHttp) {
        throw 'HTTP did not serve the host marker after automatic recompilation'
    }
}
finally {
    Copy-Item -LiteralPath $backup -Destination $pagePath -Force

    for ($i = 0; $i -lt 30; $i++) {
        docker exec polyhunter-web sh -c "! grep -F '$marker' /workspace/apps/web/app/page.tsx" *> $null
        if ($LASTEXITCODE -eq 0) {
            $restoreContainer = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    for ($i = 0; $i -lt 40; $i++) {
        try {
            $restored = Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 10
            if ($restored.StatusCode -eq 200 -and -not $restored.Content.Contains($marker) -and $restored.Content.Contains('PolyHunter engineering shell')) {
                $restoreHttp = $true
                $httpRestoreCode = [int]$restored.StatusCode
                [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.engineering/evidence/PH-SEC-WO-006/validation/C/http-restored.html'), $restored.Content, [System.Text.UTF8Encoding]::new($false))
                break
            }
        }
        catch { }
        Start-Sleep -Seconds 2
    }

    docker logs polyhunter-web --since 10m 2>&1 | Set-Content $logFile
    Remove-Item -LiteralPath $backup -Force
}

$finalHash = (Get-FileHash $pagePath -Algorithm SHA256).Hash
$diff = git diff -- $page
$diffEmpty = [string]::IsNullOrWhiteSpace(($diff | Out-String))
@(
    "ORIGINAL_SHA256=$originalHash",
    "RESTORED_SHA256=$finalHash",
    "FILE_VISIBLE_IN_CONTAINER=$markerContainer",
    "HTTP_MARKER_AFTER_RECOMPILE=$markerHttp",
    "HTTP_MARKER_STATUS=$httpMarkerCode",
    "RESTORED_IN_CONTAINER=$restoreContainer",
    "HTTP_RESTORED=$restoreHttp",
    "HTTP_RESTORED_STATUS=$httpRestoreCode",
    "PAGE_DIFF_EMPTY=$diffEmpty",
    'CONTAINER_TOUCH_USED=NO'
) | Set-Content $evidence
Get-Content $evidence

if ($originalHash -ne $finalHash -or -not $markerContainer -or -not $markerHttp -or -not $restoreContainer -or -not $restoreHttp -or -not $diffEmpty) {
    throw 'Windows host hot reload proof failed'
}
