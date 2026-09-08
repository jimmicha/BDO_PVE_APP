param([ValidateSet('assembleDebug','bundleRelease')][string]$Task = 'assembleDebug')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
Push-Location $workspace
try {
  if (-not $env:JAVA_HOME) {
    $portableJava = Join-Path $workspace '.local/java/jdk-21.0.12.1+1'
    if (Test-Path -LiteralPath $portableJava) { $env:JAVA_HOME = $portableJava }
  }
  if (-not $env:ANDROID_HOME) {
    $portableSdk = Join-Path $workspace '.local/android-sdk'
    if (Test-Path -LiteralPath $portableSdk) { $env:ANDROID_HOME = $portableSdk }
  }
  if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Install Java 21 and Android SDK 36, then set JAVA_HOME and ANDROID_HOME.' }
  if ($Task -eq 'bundleRelease') {
    foreach ($variable in @('ANDROID_KEYSTORE_PATH','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD')) {
      if (-not [Environment]::GetEnvironmentVariable($variable)) { throw "Release signing is incomplete: $variable is required." }
    }
    if (-not (Test-Path -LiteralPath $env:ANDROID_KEYSTORE_PATH -PathType Leaf)) { throw 'The release keystore file does not exist.' }
  }
  & pnpm android:sync
  if ($LASTEXITCODE -ne 0) { throw 'Web build or native synchronization failed.' }
  Push-Location android
  try {
    & .\gradlew.bat $Task --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
  } finally { Pop-Location }
} finally { Pop-Location }
