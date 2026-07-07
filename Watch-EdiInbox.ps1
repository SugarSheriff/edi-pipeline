param(
    [string]$InboxPath = "\\edi-server\inbound\850",
    [int]$StaleMinutes = 15
)

$stuck = Get-ChildItem -Path $InboxPath -Filter *.edi |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddMinutes(-$StaleMinutes) }

if ($stuck) {
    foreach ($file in $stuck) {
        Write-Warning "Stuck file: $($file.Name), age $([math]::Round(((Get-Date) - $file.LastWriteTime).TotalMinutes)) min"
    }
    Send-MailMessage -To "integrations-oncall@company.com" `
        -Subject "EDI inbox has $($stuck.Count) stuck file(s)" `
        -Body ($stuck.Name -join "`n") `
        -SmtpServer "smtp.company.com" -From "edi-monitor@company.com"
    exit 1
}

Write-Output "Inbox clear - $(Get-Date -Format u)"
exit 0
