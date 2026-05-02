#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Subcommand
)

$ErrorActionPreference = "Stop"

$Version    = if ($env:FITCODING_VERSION) { $env:FITCODING_VERSION } else { "latest" }
$InstallDir = Join-Path $env:USERPROFILE ".fitcoding\bin"
$Bin        = Join-Path $InstallDir "fitcoding.exe"

function Get-Target {
    $arch = (Get-CimInstance Win32_OperatingSystem).OSArchitecture
    if ($arch -like "*64-bit*") {
        return "x86_64-pc-windows-msvc"
    }
    throw "fitcoding: unsupported Windows architecture $arch"
}

function Ensure-Binary {
    if (Test-Path $Bin) { return }
    $target = Get-Target
    $url = if ($Version -eq "latest") {
        "https://github.com/AndrewWayne/FitCoding/releases/latest/download/fitcoding-$target.zip"
    } else {
        "https://github.com/AndrewWayne/FitCoding/releases/download/$Version/fitcoding-$target.zip"
    }
    Write-Host "Downloading FitCoding binary for $target..."
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $tmp = New-TemporaryFile
    $zip = "$($tmp.FullName).zip"
    Move-Item $tmp.FullName $zip
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $InstallDir -Force
    Remove-Item $zip
}

function Dispatch {
    switch ($Subcommand) {
        "" {
            Start-Process -WindowStyle Hidden -FilePath $Bin -ArgumentList "launch"
            Write-Host "FitCoding window launching..."
        }
        "board" {
            & $Bin board
            exit $LASTEXITCODE
        }
        Default {
            Write-Error "Usage: /fit          (start a 30s exercise)`n       /fit board    (print today's scoreboard)"
            exit 1
        }
    }
}

Ensure-Binary
Dispatch
