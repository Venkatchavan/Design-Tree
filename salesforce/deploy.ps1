#Requires -Version 5.1
<#
.SYNOPSIS
    Deploy the DesignTree Project__c fields to a Salesforce Developer Edition
    org, import three synthetic test records and capture a DESCRIBE export.

.DESCRIPTION
    Safe to re-run. The package only adds the 13 custom fields; it never
    redeclares the Project__c object itself, so existing org settings and the
    standard fields are left untouched.

.PARAMETER TargetOrg
    Salesforce CLI org alias. Defaults to dt-dev.

.PARAMETER SkipData
    Deploy fields only; skip the sample record import.

.EXAMPLE
    .\salesforce\deploy.ps1

.EXAMPLE
    .\salesforce\deploy.ps1 -TargetOrg my-dev-org -SkipData
#>
[CmdletBinding()]
param(
    [string]$TargetOrg = 'dt-dev',
    [switch]$SkipData
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root

function Invoke-Sf {
    param([string[]]$SfArgs)
    & sf @SfArgs
    if ($LASTEXITCODE -ne 0) {
        throw "sf $($SfArgs -join ' ') failed with exit code $LASTEXITCODE."
    }
}

try {
    if (-not (Get-Command sf -ErrorAction SilentlyContinue)) {
        throw 'Salesforce CLI not found. Install it with: npm install --global @salesforce/cli'
    }

    Write-Host '==> Deploying Project__c fields' -ForegroundColor Cyan
    Invoke-Sf @(
        'project', 'deploy', 'start',
        '--manifest', 'metadata/package.xml',
        '--target-org', $TargetOrg,
        '--wait', '15'
    )

    # Fields created through the API are not added to any profile, so the
    # running user cannot query them until field-level security is granted.
    Write-Host '==> Assigning permission set (field-level security)' -ForegroundColor Cyan
    Invoke-Sf @(
        'org', 'assign', 'permset',
        '--name', 'DesignTree_Salesforce_Dev',
        '--target-org', $TargetOrg
    )

    if (-not $SkipData) {
        Write-Host '==> Importing synthetic test records' -ForegroundColor Cyan
        Invoke-Sf @(
            'data', 'import', 'tree',
            '--files', 'data/Project__c.json',
            '--target-org', $TargetOrg
        )
    }

    Write-Host '==> Capturing DESCRIBE' -ForegroundColor Cyan
    sf sobject describe --sobject Project__c --target-org $TargetOrg --json |
        Set-Content -Path 'project-describe.json' -Encoding UTF8
    if ($LASTEXITCODE -ne 0) {
        throw 'DESCRIBE failed, but the fields and data are already deployed.'
    }

    Write-Host ''
    Write-Host 'Done.' -ForegroundColor Green
    Write-Host "DESCRIBE written to $root\project-describe.json"
    Write-Host 'Next: add the SF_* values to api/.env and run the token test.'
}
finally {
    Pop-Location
}
