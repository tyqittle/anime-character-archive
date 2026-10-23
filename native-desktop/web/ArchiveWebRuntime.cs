// SPDX-License-Identifier: GPL-3.0-or-later
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using Microsoft.Web.WebView2.Core;
namespace SpinePet;

internal static class ArchiveWebRuntime
{
    private static readonly object Sync=new();
    private static Task? _installation;
    public static bool Available()
    {
        try{return !string.IsNullOrWhiteSpace(CoreWebView2Environment.GetAvailableBrowserVersionString());}
        catch(WebView2RuntimeNotFoundException){return false;}
    }
    public static async Task EnsureAsync(CancellationToken cancellation)
    {
        if(Available())return;
        Task installation;
        lock(Sync)
        {
            if(_installation==null||_installation.IsFaulted)
                _installation=InstallAsync();
            installation=_installation;
        }
        // Cancel the character request, never terminate Microsoft's installer
        // midway through a shared runtime installation.
        await installation.WaitAsync(cancellation);
    }
    private static async Task InstallAsync()
    {
        string directory=Path.Combine(AppContext.BaseDirectory,"Dependencies");
        string setup=Path.Combine(directory,"MicrosoftEdgeWebview2Setup.exe");
        string receipt=Path.Combine(directory,"MicrosoftEdgeWebview2Setup.sha256");
        if(!File.Exists(setup)||!File.Exists(receipt))
            throw new FileNotFoundException("缺少 Microsoft WebView2 运行环境。请使用最新完整安装包安装通用桌宠。");
        string expected=(await File.ReadAllTextAsync(receipt)).Trim();
        await using(var stream=File.OpenRead(setup))
        {
            string actual=Convert.ToHexString(await SHA256.HashDataAsync(stream));
            if(!string.Equals(actual,expected,StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("WebView2 官方依赖摘要不符，已停止安装。");
        }
        using var process=Process.Start(new ProcessStartInfo(setup,"/silent /install") {
            UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden })
            ?? throw new IOException("无法启动 Microsoft WebView2 安装程序");
        await process.WaitForExitAsync();
        if(!Available())throw new IOException(
            "Microsoft WebView2 尚未安装完成，请确认能连接 Microsoft 下载服务后重试。安装程序退出码："+process.ExitCode);
    }
}
