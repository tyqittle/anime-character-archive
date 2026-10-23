$ErrorActionPreference='Stop'
$built='a'*40
$newer='b'*40
$env:GITHUB_OUTPUT=Join-Path ([IO.Path]::GetTempPath()) ('archive-release-test-'+[guid]::NewGuid().ToString('N')+'.txt')
function gh([string]$action,[string]$endpoint,[string]$option,[string]$filter) {
    $global:LASTEXITCODE=0
    if($endpoint -eq 'repos/fixture/repo/commits/main'){return $newer}
    if($endpoint -like '*/compare/*'){return $(if($global:releaseFixtureCase -eq 'diverged'){'diverged'}else{'ahead'})}
    if($endpoint -eq "repos/fixture/repo/commits/$built"){return 'built-tree'}
    if($endpoint -eq "repos/fixture/repo/commits/$newer"){return 'head-tree'}
    if($endpoint -like '*/git/trees/*'){
        if($global:releaseFixtureCase -eq 'unreadable'){return ''}
        return $(if($global:releaseFixtureCase -eq 'new-native' -and $endpoint.EndsWith('head-tree')){'changed-native'}else{'same-native'})
    }
    if($endpoint -like '*/contents/*'){
        return $(if($global:releaseFixtureCase -eq 'new-workflow' -and $endpoint.EndsWith($newer)){'changed-workflow'}else{'same-workflow'})
    }
    throw "Unexpected GitHub query: $endpoint"
}
foreach($global:releaseFixtureCase in @('website-only','new-native','new-workflow','diverged','unreadable')){
    [IO.File]::WriteAllText($env:GITHUB_OUTPUT,'')
    $failed=$false
    try {& (Join-Path $PSScriptRoot 'Test-ReleaseSource.ps1') -Repository 'fixture/repo' -BuiltSha $built}
    catch {$failed=$true;Write-Output $_.Exception.Message}
    if($global:releaseFixtureCase -in @('diverged','unreadable')){
        if(-not $failed){throw "Expected fail-closed result: $global:releaseFixtureCase"}
    }else{
        $expected=if($global:releaseFixtureCase -eq 'website-only'){'publish=true'}else{'publish=false'}
        if($failed -or -not ([IO.File]::ReadAllText($env:GITHUB_OUTPUT).Contains($expected))){throw "Wrong eligibility: $global:releaseFixtureCase"}
    }
    Write-Output "PASS: $global:releaseFixtureCase"
}

Remove-Item -LiteralPath $env:GITHUB_OUTPUT
