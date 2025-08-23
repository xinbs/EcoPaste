@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo        EcoPaste 同步服务器测试
echo ========================================
echo.

echo [1] 测试服务器健康状态...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:3001/health' -Method GET; Write-Host '✅ 服务器正常运行:' -ForegroundColor Green; Write-Host '   版本:' $response.version -ForegroundColor Cyan; Write-Host '   状态:' $response.status -ForegroundColor Cyan; Write-Host '   时间:' $response.timestamp -ForegroundColor Cyan } catch { Write-Host '❌ 服务器连接失败:' $_.Exception.Message -ForegroundColor Red }"

echo.
echo [2] 测试注册功能...
powershell -Command "try { $body = @{ username='test@example.com'; password='123456'; email='test@example.com'; deviceName='TestDevice'; deviceType='desktop'; platform='Windows' } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/register' -Method POST -ContentType 'application/json' -Body $body; Write-Host '✅ 注册接口响应正常' -ForegroundColor Green } catch { if ($_.Exception.Response.StatusCode -eq 409) { Write-Host '✅ 注册接口正常 (用户已存在)' -ForegroundColor Green } else { Write-Host '❌ 注册测试失败:' $_.Exception.Message -ForegroundColor Red } }"

echo.
echo [3] 测试登录功能...
powershell -Command "try { $body = @{ username='xinquanliang@qq.com'; password='123456'; deviceName='TestDevice'; deviceType='desktop'; platform='Windows' } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method POST -ContentType 'application/json' -Body $body; Write-Host '✅ 登录成功:' -ForegroundColor Green; Write-Host '   用户:' $response.user.username -ForegroundColor Cyan; Write-Host '   设备:' $response.device.name -ForegroundColor Cyan; $env:AUTH_TOKEN = $response.token; Write-Host '   令牌已保存到环境变量' -ForegroundColor Yellow } catch { Write-Host '❌ 登录失败:' $_.Exception.Message -ForegroundColor Red; Write-Host '💡 提示: 请确认用户名密码是否正确，或先注册账号' -ForegroundColor Yellow }"

echo.
echo [4] 如果登录成功，测试同步上传功能...
if defined AUTH_TOKEN (
    powershell -Command "try { $headers = @{ 'Authorization' = 'Bearer ' + $env:AUTH_TOKEN; 'Content-Type' = 'application/json' }; $body = @{ items = @(@{ id='test-' + (Get-Date).Ticks; type='text'; content='测试同步数据'; hash='test_' + (Get-Date).Ticks; metadata=@{ group='text'; search='测试数据'; createTime=(Get-Date).ToString('o') } }) } | ConvertTo-Json -Depth 4; $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/sync/upload' -Method POST -Headers $headers -Body $body; Write-Host '✅ 同步上传成功' -ForegroundColor Green } catch { Write-Host '❌ 同步上传失败:' $_.Exception.Message -ForegroundColor Red }"
) else (
    echo ⚠️  跳过同步测试（未获取到认证令牌）
)

echo.
echo ========================================
echo                测试完成
echo ========================================
echo.
echo 💡 如果所有测试都通过，说明同步服务器工作正常！
echo 💡 如果有失败的测试，请检查对应的错误信息。
echo.
pause