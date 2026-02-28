$code = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")] 
public class CShellLink {}

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct WIN32_FIND_DATAW { public uint dwFileAttributes; public System.Runtime.InteropServices.ComTypes.FILETIME ftCreationTime; public System.Runtime.InteropServices.ComTypes.FILETIME ftLastAccessTime; public System.Runtime.InteropServices.ComTypes.FILETIME ftLastWriteTime; public uint nFileSizeHigh; public uint nFileSizeLow; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string cFileName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=14)] public string cAlternateFileName; }

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
public interface IShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cchMaxPath, out WIN32_FIND_DATAW pfd, uint fFlags);
    void GetIDList(out IntPtr ppidl);
    void SetIDList(IntPtr pidl);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cchMaxName);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cchMaxPath);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cchMaxPath);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
    void GetHotkey(out short pwHotkey);
    void SetHotkey(short wHotkey);
    void GetShowCmd(out int piShowCmd);
    void SetShowCmd(int iShowCmd);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cchIconPath, out int piIcon);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
    void Resolve(IntPtr hwnd, uint fFlags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
    void GetCount(out uint cProps);
    void GetAt(uint iProp, out PROPERTYKEY pkey);
    void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
    void Commit();
}

[StructLayout(LayoutKind.Sequential)]
public struct PROPERTYKEY { public Guid fmtid; public uint pid; }

[StructLayout(LayoutKind.Explicit)]
public struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr pointerValue; }

public class ShortcutHelper {
    [DllImport("ole32.dll")]
    static extern int PropVariantClear(ref PROPVARIANT pvar);

    public static void SetAppUserModelId(string lnkPath, string appId) {
        var shellLink = (IShellLinkW)new CShellLink();
        var persistFile = (IPersistFile)shellLink;
        // Use STGM_READWRITE (0x2) to open the shortcut for write
        persistFile.Load(lnkPath, 0x2);
        var propStore = (IPropertyStore)shellLink;
        var key = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
        var pv = new PROPVARIANT();
        pv.vt = 31; // VT_LPWSTR
        pv.pointerValue = Marshal.StringToCoTaskMemUni(appId);
        propStore.SetValue(ref key, ref pv);
        propStore.Commit();
        PropVariantClear(ref pv);
    }
}
'@

$lnk = 'C:\Users\docrs\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\In-Accord Launcher.lnk'
if (-not (Test-Path $lnk)) { Write-Output "Shortcut not found: $lnk"; exit 2 }

try {
    Add-Type -TypeDefinition $code -ErrorAction Stop
} catch {
    Write-Output "Add-Type compile failed: $($_.Exception.Message)"
    exit 3
}

try {
    [ShortcutHelper]::SetAppUserModelId($lnk, 'com.in-accord.launcher')
    Write-Output 'SetAppUserModelId OK'
    exit 0
} catch {
    Write-Output "SetAppUserModelId failed: $($_.Exception.Message)"
    exit 4
}
