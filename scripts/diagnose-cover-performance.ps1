param([int]$DurationSeconds = 120, [int]$IntervalMs = 350)
# Read-only, diagnostic-owned sampler. CPU is delta process CPU, not a scheduling trace.
$ErrorActionPreference = 'SilentlyContinue'
$previous = @{}
$last = [DateTime]::UtcNow
$end = $last.AddSeconds($DurationSeconds)
$cores = [Environment]::ProcessorCount
while ([DateTime]::UtcNow -lt $end) {
  $now = [DateTime]::UtcNow
  $elapsed = ($now - $last).TotalSeconds
  $current = @{}
  $rows = @()
  $total = 0.0
  foreach ($p in Get-Process) {
    $cpu = $p.CPU
    if ($null -eq $cpu) { continue }
    $current[$p.Id] = $cpu
    if ($previous.ContainsKey($p.Id) -and $elapsed -gt 0) {
      # Avoid Math.Max(0, double): Windows PowerShell can select the integer overload.
      [double]$delta = $cpu - $previous[$p.Id]
      if ($delta -lt 0) { $delta = 0 }
      $total += $delta
      if ($delta -gt 0) { $rows += @{id=$p.Id; name=$p.ProcessName; cpuMs=[Math]::Round($delta*1000,3); cpuOneCorePct=[Math]::Round($delta/$elapsed*100,2); workingSetMiB=[Math]::Round($p.WorkingSet64/1MB,1)} }
    }
  }
  if ($previous.Count -gt 0) {
    [Console]::WriteLine((@{at=$now.ToString('o'); intervalMs=[Math]::Round($elapsed*1000,2); machineCpuPct=[Math]::Round($total/$elapsed/$cores*100,2); top=@($rows | Sort-Object cpuMs -Descending | Select-Object -First 10)} | ConvertTo-Json -Depth 5 -Compress))
  }
  $previous = $current
  $last = $now
  Start-Sleep -Milliseconds $IntervalMs
}
