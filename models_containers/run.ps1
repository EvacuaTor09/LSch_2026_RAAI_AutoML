param(
    [ValidateSet("up", "down", "build", "logs", "status")]
    [string]$Action = "up",
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

switch ($Action) {
    "up" {
        Write-Host "Building and starting model containers..."
        docker compose up --build -d
        Write-Host ""
        Write-Host "Services:"
        Write-Host "  resnet -> http://localhost:8001"
        Write-Host "  vgg    -> http://localhost:8002"
        Write-Host "  vit    -> http://localhost:8003"
    }
    "down" {
        docker compose down
    }
    "build" {
        docker compose build
    }
    "logs" {
        if ($Service) {
            docker compose logs -f $Service
        } else {
            docker compose logs -f
        }
    }
    "status" {
        docker compose ps
    }
}
