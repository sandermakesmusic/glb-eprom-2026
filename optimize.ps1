$source = "public/models/scene.glb"
$dedupFile = "public/models/scene-dedup.glb"
$meshoptFile = "public/models/scene-meshopt.glb"
$resizedFile = "public/models/scene-resized.glb"
$finalFile = "public/models/scene-opt.glb"

npx gltf-transform dedup $source $dedupFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx gltf-transform meshopt $dedupFile $meshoptFile --level high
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx gltf-transform resize $meshoptFile $resizedFile --width 2048 --height 2048
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx gltf-transform jpeg $resizedFile $finalFile --quality 90
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $dedupFile, $meshoptFile, $resizedFile -Force

Write-Host ""
Write-Host "Done: $finalFile"
