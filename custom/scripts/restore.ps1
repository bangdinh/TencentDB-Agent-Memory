# =========================================================================
# TencentDB Agent Memory - Restore Script
# =========================================================================
param (
    [string]$BackupName = "",
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackupRootDir = Join-Path $RootDir "backups"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "      TencentDB Agent Memory - RESTORE UTILITY       " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

if (-not (Test-Path $BackupRootDir)) {
    Write-Host "[!] Khong tim thay thu muc backups/ nao!" -ForegroundColor Red
    exit 1
}

$BackupList = Get-ChildItem -Path $BackupRootDir -Directory | Sort-Object CreationTime -Descending

if ($BackupList.Count -eq 0) {
    Write-Host "[!] Danh sach backups dang trong!" -ForegroundColor Yellow
    exit 0
}

$SelectedDir = $null

if ([string]::IsNullOrWhiteSpace($BackupName)) {
    Write-Host "`nDanh sach cac ban sao luu hien co:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $BackupList.Count; $i++) {
        $item = $BackupList[$i]
        $infoFile = Join-Path $item.FullName "backup_info.json"
        $note = "Khong ro"
        $type = "Khong ro"
        $date = $item.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
        if (Test-Path $infoFile) {
            try {
                $info = Get-Content $infoFile -Raw | ConvertFrom-Json
                $note = $info.note
                $type = $info.type
                $date = $info.createdAt
            } catch {}
        }
        Write-Host "  [$($i + 1)] $($item.Name)" -ForegroundColor Green
        Write-Host "      Thoi gian: $date | Loai: $type" -ForegroundColor DarkGray
        Write-Host "      Ghi chu  : $note" -ForegroundColor White
    }

    $choice = Read-Host "`nNhap so thu tu ban backup muon khoi phuc (1-$($BackupList.Count), mac dinh 1)"
    if ([string]::IsNullOrWhiteSpace($choice)) {
        $choice = "1"
    }
    
    $index = [int]$choice - 1
    if ($index -lt 0 -or $index -ge $BackupList.Count) {
        Write-Host "[!] Lua chon khong hop le!" -ForegroundColor Red
        exit 1
    }
    $SelectedDir = $BackupList[$index].FullName
} else {
    $matched = $BackupList | Where-Object { $_.Name -eq $BackupName }
    if ($null -eq $matched) {
        Write-Host "[!] Khong tim thay ban backup co ten: $BackupName" -ForegroundColor Red
        exit 1
    }
    $SelectedDir = $matched.FullName
}

Write-Host "`nBan da chon ban backup: $SelectedDir" -ForegroundColor Cyan
if (-not $Force) {
    $confirm = Read-Host "CANH BAO: Du lieu va code hien tai se bi ghi de. Ban co chac chan? (Y/N)"
    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "Da huy thao tac restore." -ForegroundColor Yellow
        exit 0
    }
}

$infoFile = Join-Path $SelectedDir "backup_info.json"
$isFull = $false
if (Test-Path $infoFile) {
    $info = Get-Content $infoFile -Raw | ConvertFrom-Json
    if ($info.type -eq "Full" -or ($info.volumes -and $info.volumes.Count -gt 0)) {
        $isFull = $true
    }
} else {
    # Kiem tra file .tar.gz trong thu muc
    if (Get-ChildItem -Path $SelectedDir -Filter "*.tar.gz") {
        $isFull = $true
    }
}

# 1. Neu la Full Backup -> Dung docker de khoi phuc volume
if ($isFull) {
    Write-Host "`n[-] Dang tam dung cac container Docker..." -ForegroundColor Yellow
    $StopBat = Join-Path $RootDir "stop.bat"
    if (Test-Path $StopBat) {
        & cmd.exe /c "$StopBat" | Out-Null
    }

    $Volumes = @("tdai-memory-core-data", "tdai-panel-data")
    foreach ($vol in $Volumes) {
        $tarFile = Join-Path $SelectedDir "$vol.tar.gz"
        if (Test-Path $tarFile) {
            Write-Host "[-] Dang khoi phuc Docker Volume: $vol..." -ForegroundColor Yellow
            docker run --rm -v "${vol}:/data" -v "${SelectedDir}:/backup" agentmemory/memory-core:latest sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar -xzf /backup/$vol.tar.gz -C /data"
            Write-Host "    [OK] Da khoi phuc volume $vol" -ForegroundColor Green
        }
    }
}

# 2. Khoi phuc ma nguon custom/
$CustomBackup = Join-Path $SelectedDir "custom"
$CustomTarget = Join-Path $RootDir "custom"
if (Test-Path $CustomBackup) {
    Write-Host "[-] Dang khoi phuc thu muc custom/..." -ForegroundColor Yellow
    Copy-Item -Path "$CustomBackup\*" -Destination $CustomTarget -Recurse -Force
    Write-Host "    [OK] Da khoi phuc custom/" -ForegroundColor Green
}

# 3. Khoi phuc cac file configs
$ConfigsBackup = Join-Path $SelectedDir "configs"
if (Test-Path $ConfigsBackup) {
    Write-Host "[-] Dang khoi phuc cac file cau hinh..." -ForegroundColor Yellow
    
    $envFile = Join-Path $ConfigsBackup ".env"
    if (Test-Path $envFile) {
        Copy-Item -Path $envFile -Destination (Join-Path $RootDir "deploy\global-images\.env") -Force
    }

    $adminKeyFile = Join-Path $ConfigsBackup ".admin-key"
    if (Test-Path $adminKeyFile) {
        Copy-Item -Path $adminKeyFile -Destination (Join-Path $RootDir "deploy\global-images\.admin-key") -Force
    }

    $claudeFile = Join-Path $ConfigsBackup "CLAUDE.md"
    if (Test-Path $claudeFile) {
        Copy-Item -Path $claudeFile -Destination (Join-Path $RootDir "CLAUDE.md") -Force
    }

    $agentsFile = Join-Path $ConfigsBackup "AGENTS.md"
    if (Test-Path $agentsFile) {
        Copy-Item -Path $agentsFile -Destination (Join-Path $RootDir "AGENTS.md") -Force
    }

    $mcpFile = Join-Path $ConfigsBackup "mcp_config.json"
    if (Test-Path $mcpFile) {
        Copy-Item -Path $mcpFile -Destination (Join-Path $RootDir ".agents\mcp_config.json") -Force
    }
    Write-Host "    [OK] Da khoi phuc configs" -ForegroundColor Green
}

# 4. Khoi dong lai docker neu la full backup
if ($isFull) {
    Write-Host "`n[-] Dang khoi dong lai he thong..." -ForegroundColor Yellow
    $StartBat = Join-Path $RootDir "start.bat"
    if (Test-Path $StartBat) {
        & cmd.exe /c "$StartBat" | Out-Null
    }
}

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "  KHOI PHUC (RESTORE) HOAN TAT VA THANH CONG!        " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
