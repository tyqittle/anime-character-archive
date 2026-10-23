# SPDX-License-Identifier: GPL-3.0-or-later
param(
    [Parameter(Mandatory=$true)][string]$Repository,
    [Parameter(Mandatory=$true)][string]$BuiltSha
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Read-GitHubValue([string]$endpoint,[string]$filter) {
    $value=gh api $endpoint --jq $filter
    if($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)){
        throw "Cannot verify release source: $endpoint"
    }
    return $value.Trim()
}
function Read-NativeTree([string]$revision) {
    $tree=Read-GitHubValue "repos/$Repository/commits/$revision" '.commit.tree.sha'
    Read-GitHubValue "repos/$Repository/git/trees/$tree" '.tree[] | select(.path == "native-desktop") | .sha'
}
$head=Read-GitHubValue "repos/$Repository/commits/main" '.sha'
$publish='true'
if($head -ne $BuiltSha){
    $status=Read-GitHubValue "repos/$Repository/compare/$BuiltSha...$head" '.status'
    if($status -ne 'ahead'){throw 'Release source history is not a verified fast-forward'}
    # Git tree hashes cover every descendant, even when a website update adds
    # thousands of images. The compare API's first 300 files are not a full diff.
    $builtNative=Read-NativeTree $BuiltSha
    $headNative=Read-NativeTree $head
    $workflow='.github/workflows/native-spinepet-windows.yml'
    $builtWorkflow=Read-GitHubValue "repos/$Repository/contents/$($workflow)?ref=$BuiltSha" '.sha'
    $headWorkflow=Read-GitHubValue "repos/$Repository/contents/$($workflow)?ref=$head" '.sha'
    if($builtNative -ne $headNative -or $builtWorkflow -ne $headWorkflow){
        $publish='false'
        Write-Host 'A newer native source or release-workflow revision supersedes this build.'
    }else{
        Write-Host 'Complete native tree and release workflow are unchanged; website updates preserve eligibility.'
    }
}
Write-Host "Built SHA=$BuiltSha; branch HEAD=$head; publish=$publish"
"publish=$publish" | Out-File -LiteralPath $env:GITHUB_OUTPUT -Append -Encoding utf8
