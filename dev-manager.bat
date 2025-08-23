@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 开发脚本管理器 (Windows)
echo ========================================
echo.

:menu
echo 请选择要执行的操作:
echo.
echo  [1] 🔍 检查开发环境        (check-env.bat)
echo  [2] 🚀 启动开发环境        (start-dev.bat)  
echo  [3] 🎨 启动开发环境(增强版) (start-dev.ps1)
echo  [4] ⏹️  停止开发服务        (stop-dev.bat)
echo  [5] 🔄 重启开发环境        (restart-dev.bat)
echo  [6] 🏗️  构建生产版本(批处理) (build-windows.bat)
echo  [7] 🏗️  构建生产版本(增强版) (build-windows.ps1)
echo  [8] 📖 查看开发文档        (DEV-SCRIPTS.md)
echo  [9] 🚪 退出管理器
echo.

set /p choice=请输入选项 [1-9]: 

if "%choice%"=="1" goto check_env
if "%choice%"=="2" goto start_dev
if "%choice%"=="3" goto start_dev_ps1
if "%choice%"=="4" goto stop_dev
if "%choice%"=="5" goto restart_dev
if "%choice%"=="6" goto build_bat
if "%choice%"=="7" goto build_ps1
if "%choice%"=="8" goto show_docs
if "%choice%"=="9" goto exit
goto invalid_choice

:check_env
echo.
echo [执行] 正在运行环境检查...
call check-env.bat
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:start_dev
echo.
echo [执行] 启动开发环境 (批处理版本)...
call start-dev.bat
goto menu

:start_dev_ps1
echo.
echo [执行] 启动开发环境 (PowerShell增强版)...
powershell -ExecutionPolicy Bypass -File "start-dev.ps1"
goto menu

:stop_dev
echo.
echo [执行] 停止开发服务...
call stop-dev.bat
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:restart_dev
echo.
echo [执行] 重启开发环境...
call restart-dev.bat
goto menu

:build_bat
echo.
echo [执行] 构建生产版本 (批处理版本)...
call build-windows.bat
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:build_ps1
echo.
echo [执行] 构建生产版本 (PowerShell增强版)...
powershell -ExecutionPolicy Bypass -File "build-windows.ps1"
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:show_docs
echo.
echo [信息] 正在打开开发文档...
if exist "DEV-SCRIPTS.md" (
    start notepad "DEV-SCRIPTS.md"
) else (
    echo [错误] 未找到 DEV-SCRIPTS.md 文档
)
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:invalid_choice
echo.
echo [错误] 无效选项，请输入 1-9 之间的数字
echo.
pause
cls
goto menu

:exit
echo.
echo 感谢使用 EcoPaste 开发脚本管理器！
echo 祝开发愉快！ 🎉
echo.
exit /b 0