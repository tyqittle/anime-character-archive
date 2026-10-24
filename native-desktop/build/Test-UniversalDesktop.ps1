# SPDX-License-Identifier: GPL-3.0-or-later
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Join-Path (Resolve-Path '.').Path 'native-universal-test'
$public = Join-Path $root 'public'
New-Item -ItemType Directory -Path $public,(Join-Path $root 'fixture') -Force | Out-Null
# Explicit public inputs only. Never expose a checkout's .git or runner credentials.
Copy-Item ./spine.html,./azurlane-stage.html -Destination $public
New-Item -ItemType Directory -Path (Join-Path $public 'assets') -Force | Out-Null
Copy-Item ./assets/*.css -Destination (Join-Path $public 'assets')
foreach ($directory in @('assets/js','data','vendor')) {
    if(Test-Path -LiteralPath $directory) {
        $target=if($directory -eq 'assets/js'){Join-Path $public 'assets'}else{$public}
        Copy-Item -LiteralPath $directory -Destination $target -Recurse
    }
}
# Only the chosen cases' thumbnails are useful; hidden gallery assets are not renderer input.
@'
<!doctype html><html><head><style>html,body{margin:0;background:transparent}#pixel{position:absolute;left:20px;top:20px;width:100px;height:100px;background:red}</style></head><body><div id="pixel"></div><script>
const q=new URLSearchParams(location.search),session=q.get('session'),id=q.get('id')||'one';
function emit(kind,data){chrome.webview.postMessage({channel:'archive-desktop-v1',session,kind,id,...data})}
emit('ready',{game:'fixture',engine:'fixture',name:'fixture'});
setInterval(()=>emit('mask',{width:innerWidth,height:innerHeight,rects:[[20,20,100,100]]}),100);
</script></body></html>
'@ | Set-Content (Join-Path $root 'fixture/spine.html') -Encoding utf8
$cases = @(
    @{Game='nikke';Id='c010';Engine='spine'},
    @{Game='nikke';Id='c015';Engine='spine'},
    @{Game='bluearchive';Id='ba-ch0058_home';Engine='spine'},
    @{Game='azurlane';Id='al-abeikelongbi_3';Engine='cubism'},
    @{Game='girlscafegun';Id='gc-girl01-l2d00';Engine='cubism'}
)
$cases | ConvertTo-Json | Set-Content (Join-Path $root 'cases.json') -Encoding utf8
$testProject='./native-upstream/SpinePet/tests/SpinePet.Tests'
Copy-Item ./native-desktop/ArchiveUniversalDesktopTests.cs $testProject
$env:ARCHIVE_WEB_TEST_ROOT=$root
# Use the installed, Authenticode-verified runtime provisioned by Prepare-WebViewRuntime.
dotnet test (Join-Path $testProject 'SpinePet.Tests.csproj') -c Release --filter 'FullyQualifiedName~ArchiveUniversalDesktopTests' --logger 'console;verbosity=normal' --logger 'trx;LogFileName=archive-universal.trx' --results-directory ./native-test-results
if($LASTEXITCODE -ne 0) {throw 'Universal WebView2, transparent pixels, engine playback or view persistence regression failed'}
Remove-Item Env:ARCHIVE_WEB_TEST_ROOT
