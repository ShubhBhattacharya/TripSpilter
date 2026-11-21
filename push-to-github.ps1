param(
    [string]$RepoUrl
)

if (-not $RepoUrl) {
    $RepoUrl = Read-Host "Enter your GitHub repository URL (e.g., https://github.com/your-username/TripSplit.git)"
}

if (-not $RepoUrl) {
    Write-Host "No URL provided. Exiting." -ForegroundColor Yellow
    exit 1
}

Write-Host "Linking remote origin: $RepoUrl" -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin $RepoUrl

Write-Host "Setting default branch to main..." -ForegroundColor Cyan
git branch -M main

Write-Host "Pushing all commits to GitHub..." -ForegroundColor Green
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccessfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "`nPush encountered an issue. Ensure the repository exists on GitHub and you have permission." -ForegroundColor Red
}
