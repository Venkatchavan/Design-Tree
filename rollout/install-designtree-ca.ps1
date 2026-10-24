[CmdletBinding()]
param(
    [string]$CaPath = (Join-Path $PSScriptRoot 'designtree-lan-ca.crt'),
    [string]$ExpectedThumbprint = 'E9C43312A2D5EEE87A5C38862AA60A2D305EBD01'
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $procArgs = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"{0}"' -f $PSCommandPath)
    )
    Start-Process powershell.exe -Verb RunAs -ArgumentList $procArgs
    exit
}

$CaPath = (Resolve-Path -LiteralPath $CaPath).Path
$ca = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CaPath)

if ($ca.Thumbprint -ne $ExpectedThumbprint) {
    throw "CA thumbprint mismatch. Expected $ExpectedThumbprint, found $($ca.Thumbprint)."
}

Get-ChildItem Cert:\LocalMachine\Root |
    Where-Object { $_.Subject -eq $ca.Subject -and $_.Thumbprint -ne $ca.Thumbprint } |
    Remove-Item -Force

if (-not (Test-Path "Cert:\LocalMachine\Root\$($ca.Thumbprint)")) {
    Import-Certificate -FilePath $CaPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
}

$firefoxPolicy = 'HKLM:\SOFTWARE\Policies\Mozilla\Firefox\Certificates'
New-Item -Path $firefoxPolicy -Force | Out-Null
New-ItemProperty -Path $firefoxPolicy -Name ImportEnterpriseRoots -Value 1 -PropertyType DWord -Force | Out-Null

$installed = Get-ChildItem Cert:\LocalMachine\Root |
    Where-Object { $_.Thumbprint -eq $ca.Thumbprint }

if (-not $installed) {
    throw 'CA install failed.'
}

Write-Host ''
Write-Host "Installed:  $($installed.Subject)"
Write-Host "Thumbprint: $($installed.Thumbprint)"
Write-Host "Valid until: $($installed.NotAfter)"
Write-Host ''
Write-Host 'Close all browser windows and reopen the browser to pick up the trust.'
Write-Host 'This trusts the DesignTree LAN certificate for http(s)://192.168.1.50.'
Write-Host 'It does not make external browsers trust the private LAN CA.'
