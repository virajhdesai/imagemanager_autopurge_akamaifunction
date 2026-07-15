# ==============================================================================
# 🚀 WINDOWS POWERSHELL: RELIABLE SPIN DEPLOY & NODE-BASED CACHE PURGE
# ==============================================================================

Write-Host "Triggering Spin Aka Deployment..."

spin aka deploy

if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Spin aka deployment failed. Aborting Akamai purge execution."
    Exit
}
Write-Host "Spin Aka Deployment complete."

Write-Host "Executing secure, direct Akamai cache invalidation..."
node purge.js