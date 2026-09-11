# =========================================================================
# TencentDB Agent Memory - Backup Script
# =========================================================================
param (
    [string]$Type = "",
    [string]$Note = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackupRootDir = Join-Path $RootDir "backups"

if (-not (Test-Path $BackupRootDir)) {
    New-Item -ItemType Directory -Path $BackupRootDir -Force | Out-Null
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "      TencentDB Agent Memory - BACKUP UTILITY        " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Interactive prompt if Type is not passed
if ([string]::IsNullOrWhiteSpace($Type)) {
    Write-Host "Chon loai backup:" -ForegroundColor Yellow
    Write-Host "  [1] FULL BACKUP   : Ma nguon custom + Cau hinh + Du lieu Tri nho (Docker Volumes)"
    Write-Host "  [2] QUICK BACKUP  : Chi ma nguon custom/ va Cau hinh (Sieu nhanh, khong dung Docker)"
    $choice = Read-Host "Nhap lua chon (1 hoac 2, mac dinh la 1)"
    if ($choice -eq "2") {
        $Type = "Quick"
    } else {
        $Type = "Full"
    }
}

if ([string]::IsNullOrWhiteSpace($Note)) {
    $Note = Read-Host "Nhap ghi chu cho ban backup nay (hoac Enter de bo qua)"
    if ([string]::IsNullOrWhiteSpace($Note)) {
        $Note = "Manual backup"
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFolderName = "backup_${Timestamp}_${Type}"
$TargetBackupDir = Join-Path $BackupRootDir $BackupFolderName
New-Item -ItemType Directory -Path $TargetBackupDir -Force | Out-Null

Write-Host "`nDang tao ban sao luu tai: $TargetBackupDir" -ForegroundColor Green

# 1. Sao luu thu muc custom/
Write-Host "[-] Sao luu ma nguon thu muc custom/..." -ForegroundColor Yellow
$CustomSrc = Join-Path $RootDir "custom"
$CustomDest = Join-Path $TargetBackupDir "custom"
if (Test-Path $CustomSrc) {
    Copy-Item -Path $CustomSrc -Destination $CustomDest -Recurse -Force -Exclude "node_modules", ".git"
}

# 2. Sao luu cau hinh he thong & Agent
Write-Host "[-] Sao luu cac file cau hinh quan trong..." -ForegroundColor Yellow
$ConfigDest = Join-Path $TargetBackupDir "configs"
New-Item -ItemType Directory -Path $ConfigDest -Force | Out-Null

$ConfigFiles = @(
    (Join-Path $RootDir "deploy\global-images\.env"),
    (Join-Path $RootDir "deploy\global-images\.admin-key"),
    (Join-Path $RootDir "CLAUDE.md"),
    (Join-Path $RootDir "AGENTS.md"),
    (Join-Path $RootDir ".agents\mcp_config.json")
)

foreach ($file in $ConfigFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $ConfigDest -Force
    }
}

$VolumesIncluded = @()

# 3. Sao luu Docker Volumes (Neu la Full Backup)
if ($Type -eq "Full") {
    Write-Host "[-] Tien hanh sao luu Docker Data Volumes (tdai-memory-core-data, tdai-panel-data)..." -ForegroundColor Yellow
    
    # Tam dung de dam bao toan ven du lieu
    Write-Host "    Tam dung container de dam bao toan ven SQLite/VectorDB..." -ForegroundColor DarkGray
    $StopBat = Join-Path $RootDir "stop.bat"
    if (Test-Path $StopBat) {
        & cmd.exe /c "$StopBat" | Out-Null
    }

    try {
        $Volumes = @("tdai-memory-core-data", "tdai-panel-data")
        foreach ($vol in $Volumes) {
            Write-Host "    Dang nen volume: $vol..." -ForegroundColor Yellow
            $VolArchive = Join-Path $TargetBackupDir "$vol.tar.gz"
            docker run --rm -v "${vol}:/data" -v "${TargetBackupDir}:/backup" agentmemory/memory-core:latest tar -czf "/backup/$vol.tar.gz" -C /data .
            if (Test-Path $VolArchive) {
                $VolumesIncluded += $vol
                $sizeMb = [math]::Round((Get-Item $VolArchive).Length / 1MB, 2)
                Write-Host "    [OK] Da sao luu $vol ($sizeMb MB)" -ForegroundColor Green
            }
        }
    } finally {
        Write-Host "    Khoi dong lai he thong..." -ForegroundColor DarkGray
        $StartBat = Join-Path $RootDir "start.bat"
        if (Test-Path $StartBat) {
            & cmd.exe /c "$StartBat" | Out-Null
        }
    }
}

# 4. Ghi metadata backup_info.json
$Meta = @{
    timestamp = $Timestamp
    type = $Type
    note = $Note
    volumes = $VolumesIncluded
    createdAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}
$Meta | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $TargetBackupDir "backup_info.json") -Encoding UTF8

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "  BACKUP THANH CONG!                                 " -ForegroundColor Green
Write-Host "  Thu muc: $TargetBackupDir" -ForegroundColor White
Write-Host "  Loai: $Type" -ForegroundColor White
Write-Host "  Ghi chu: $Note" -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Green
