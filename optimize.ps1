$source = "public/models/scene.glb"
$dedupFile = "public/models/scene-dedup.glb"
$meshoptFile = "public/models/scene-meshopt.glb"
$finalFile = "public/models/scene-opt-webp.glb"

npx gltf-transform dedup $source $dedupFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx gltf-transform meshopt $dedupFile $meshoptFile --level high
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx gltf-transform webp $meshoptFile $finalFile --quality 90
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $dedupFile, $meshoptFile -Force

Write-Host ""
Write-Host "Done: $finalFile"