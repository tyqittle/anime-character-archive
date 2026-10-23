# Extracted from the Windows workflow. Run from the repository root.
$core = (Resolve-Path ./safe-release/core).Path
$paths = @(Get-ChildItem $core -Recurse -File | Sort-Object FullName)
$hashes = @($paths | ForEach-Object {
  $relative = [System.IO.Path]::GetRelativePath($core, $_.FullName).Replace('\\','/')
  "$(Get-FileHash $_.FullName -Algorithm SHA256 | Select-Object -ExpandProperty Hash)  $relative"
})
$hashes | Set-Content ./safe-release/core/SHA256SUMS.txt -Encoding ascii
$signature = Get-AuthenticodeSignature ./safe-release/core/app/SpinePet.exe
"SpinePet.exe Authenticode: $($signature.Status)" | Tee-Object -FilePath ./safe-release/core/BUILD-SECURITY-REPORT.txt
"Source: KAIDO-YONAGI/My_SpinePet at 6690e986b4da31dc89337794bcef1b45e6531303" | Add-Content ./safe-release/core/BUILD-SECURITY-REPORT.txt
"Core binary executables:" | Add-Content ./safe-release/core/BUILD-SECURITY-REPORT.txt
@(Get-ChildItem $core -Recurse -File -Include *.exe | ForEach-Object {
  "$([System.IO.Path]::GetRelativePath($core, $_.FullName)) SHA256=$((Get-FileHash $_.FullName -Algorithm SHA256).Hash)"
}) | Add-Content ./safe-release/core/BUILD-SECURITY-REPORT.txt
try {
  $status = Get-MpComputerStatus -ErrorAction Stop
  if ($status.AntivirusEnabled -and $status.RealTimeProtectionEnabled) {
    Write-Host 'Microsoft Defender enabled; scanning core and optional bridge.'
    Start-MpScan -ScanType CustomScan -ScanPath (Resolve-Path ./safe-release).Path -ErrorAction Stop
    'Microsoft Defender custom scan completed. This is not a guarantee of safety.' | Add-Content ./safe-release/core/BUILD-SECURITY-REPORT.txt
  } else {
    'Microsoft Defender scanner NOT ACTIVE on build runner; security scan NOT VERIFIED.' | Add-Content ./safe-release/core/BUILD-SECURITY-REPORT.txt
  }
} catch {
  "Microsoft Defender scanning unavailable: $($_.Exception.Message)" | Add-Content ./safe-release/core/BUILD-SECURITY-REPORT.txt
}
# Do not claim that a clean CI run overrides a Chrome Safe Browsing block.
