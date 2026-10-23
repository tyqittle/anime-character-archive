# SPDX-License-Identifier: GPL-3.0-or-later
param([Parameter(Mandatory=$true)][string]$WindowXaml)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$presentation='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
$names='http://schemas.microsoft.com/winfx/2006/xaml'
$document=[Xml.XmlDocument]::new()
$document.PreserveWhitespace=$true
$document.Load((Resolve-Path -LiteralPath $WindowXaml))
$namespace=[Xml.XmlNamespaceManager]::new($document.NameTable)
$namespace.AddNamespace('p',$presentation)
$namespace.AddNamespace('x',$names)
function Require-One([string]$xpath) {
    $found=$document.SelectNodes($xpath,$namespace)
    if($found.Count -ne 1){throw "Pinned window layout anchor mismatch: $xpath"}
    return $found[0]
}
function Add-AutoRows([Xml.XmlElement]$grid,[string[]]$heights) {
    if($grid.SelectSingleNode('p:Grid.RowDefinitions',$namespace)){throw 'Unexpected existing layout rows'}
    $rows=$document.CreateElement('Grid.RowDefinitions',$presentation)
    foreach($height in $heights){
        $row=$document.CreateElement('RowDefinition',$presentation)
        $row.SetAttribute('Height',$height)
        [void]$rows.AppendChild($row)
    }
    [void]$grid.PrependChild($rows)
}
# App-wide controls must be outside both native and website character settings.
$exit=Require-One "//p:Button[@x:Name='ExitButton']"
if($exit.ParentNode.LocalName -ne 'Grid' -or $exit.ParentNode.GetAttribute('Height') -ne '58'){
    throw 'Pinned selected-character header changed'
}
[void]$exit.ParentNode.RemoveChild($exit)
$layout=Require-One "//p:Grid[@Margin='16']"
$body=$layout.SelectSingleNode('p:Grid',$namespace)
if($null -eq $body){throw 'Missing main window content grid'}
Add-AutoRows $layout @('Auto','*')
$layout.SetAttribute('Name',$names,'ArchiveWindowLayout')
$body.SetAttribute('Grid.Row','1')
$body.SetAttribute('Name',$names,'ArchiveWindowBody')
$toolbar=[Xml.XmlDocument]::new()
$toolbar.Load((Join-Path $PSScriptRoot '../ui/ArchiveWindowToolbar.xaml'))
[void]$layout.AppendChild($document.ImportNode($toolbar.DocumentElement,$true))
# Separate library tools from the title. Wrap against finite available width.
$tools=Require-One "//p:Button[@x:Name='AddCharacterButton']/parent::p:StackPanel"
$header=$tools.ParentNode
if($header.LocalName -ne 'Grid' -or $tools.GetAttribute('Grid.Column') -ne '2'){
    throw 'Pinned character library toolbar changed'
}
Add-AutoRows $header @('Auto','Auto')
$wrap=$document.CreateElement('WrapPanel',$presentation)
$wrap.SetAttribute('Name',$names,'ArchiveLibraryToolbar')
$wrap.SetAttribute('Grid.Row','1')
$wrap.SetAttribute('Grid.ColumnSpan','3')
$wrap.SetAttribute('Margin','0,8,0,0')
$wrap.SetAttribute('HorizontalAlignment','Left')
while($tools.HasChildNodes){[void]$wrap.AppendChild($tools.FirstChild)}
[void]$header.ReplaceChild($wrap,$tools)
foreach($control in $wrap.ChildNodes){
    if($control -is [Xml.XmlElement]){$control.SetAttribute('Margin','0,4,6,4')}
}
$batch=Require-One "//p:ComboBox[@x:Name='BatchProcessingCombo']"
$batch.RemoveAttribute('Width')
$batch.SetAttribute('MinWidth','160')
$settings=Require-One "//p:TextBlock[@Text='SELECTED CHARACTER']/parent::p:StackPanel/parent::p:Grid"
$settings.SetAttribute('Name',$names,'ArchiveSelectedCharacterHeader')
[IO.File]::WriteAllText((Resolve-Path -LiteralPath $WindowXaml),$document.OuterXml,[Text.UTF8Encoding]::new($false))
Write-Host 'Window commands moved to an auto-sized shared toolbar; library actions wrap within their column.'
