# SPDX-License-Identifier: GPL-3.0-or-later
# Microsoft's official redistributable; no third-party mirrors or unsigned executables.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$directory = Join-Path (Resolve-Path './native-dist/app').Path 'Dependencies'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$setup = Join-Path $directory 'MicrosoftEdgeWebview2Setup.exe'
Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $setup
if ((Get-Item -LiteralPath $setup).Length -gt 10000000) { throw 'Unexpected runtime bootstrapper size' }
$signature = Get-AuthenticodeSignature -LiteralPath $setup
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'WebView2 redistributable is not validly signed by Microsoft'
}
(Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash |
    Set-Content (Join-Path $directory 'MicrosoftEdgeWebview2Setup.sha256') -Encoding ascii
Write-Host "Verified official WebView2 bootstrapper signer: $($signature.SignerCertificate.Subject)"
# Provision the same signed dependency on the Windows test runner.
Add-Type -Path './native-dist/app/Microsoft.Web.WebView2.Core.dll'
$loader = Join-Path (Resolve-Path './native-dist/app').Path 'WebView2Loader.dll'
if(Test-Path -LiteralPath $loader) { [Runtime.InteropServices.NativeLibrary]::Load($loader) | Out-Null }
$available = $false
try { $available = -not [string]::IsNullOrWhiteSpace([Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableBrowserVersionString()) }
catch { $available = $false }
if(-not $available) {
    $process=Start-Process -FilePath $setup -ArgumentList '/silent','/install' -PassThru -Wait -WindowStyle Hidden
    if($process.ExitCode -ne 0) { throw "WebView2 runner provisioning failed: $($process.ExitCode)" }
}
Write-Host 'Microsoft WebView2 runtime prepared for native composition regressions'
