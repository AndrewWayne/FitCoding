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
    # Use PROCESSOR_ARCHITECTURE — distinguishes AMD64 from ARM64 (CIM
    # OSArchitecture lumps both as "*64-bit*").
    switch ($env:PROCESSOR_ARCHITECTURE) {
        "AMD64" { return "x86_64-pc-windows-msvc" }
        "ARM64" { throw "fitcoding: native ARM64 Windows builds are not yet shipped (will arrive in v0.0.2+)" }
        Default { throw "fitcoding: unsupported Windows architecture $($env:PROCESSOR_ARCHITECTURE)" }
    }
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

    $zip       = Join-Path $env:TEMP ("fitcoding-{0}.zip" -f ([guid]::NewGuid()))
    $extractTo = Join-Path $env:TEMP ("fitcoding-extract-{0}" -f ([guid]::NewGuid()))
    try {
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        New-Item -ItemType Directory -Force -Path $extractTo | Out-Null
        Expand-Archive -Path $zip -DestinationPath $extractTo -Force

        # Locate fitcoding.exe regardless of nesting (release archive may or may
        # not have a top-level fitcoding-<target>/ directory).
        $extracted = Get-ChildItem -Path $extractTo -Recurse -Filter "fitcoding.exe" `
            | Select-Object -First 1
        if (-not $extracted) {
            throw "fitcoding: archive at $url did not contain fitcoding.exe"
        }
        Move-Item -Force -LiteralPath $extracted.FullName -Destination $Bin
    }
    finally {
        if (Test-Path $zip)       { Remove-Item -Force -LiteralPath $zip }
        if (Test-Path $extractTo) { Remove-Item -Force -Recurse -LiteralPath $extractTo }
    }
}

function Dispatch {
    switch ($Subcommand) {
        "" {
            # No -WindowStyle: Tauri opens its own GUI window; -WindowStyle only
            # affects the spawned process's console (irrelevant for a GUI app).
            Start-Process -FilePath $Bin -ArgumentList "launch"
            Write-Host "FitCoding window launching..."
        }
        "board" {
            & $Bin board
            exit $LASTEXITCODE
        }
        Default {
            [Console]::Error.WriteLine("Usage: /fit          (start a 30s exercise)`n       /fit board    (print today's scoreboard)")
            exit 1
        }
    }
}

Ensure-Binary
Dispatch
