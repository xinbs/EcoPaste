@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 开发环境停止脚本
echo ========================================
echo.

set "stopped_count=0"
set "total_processes=0"

echo 正在检查并停止所有EcoPaste相关进程...
echo.

echo [1/5] 停止Tauri开发进程...
REM 停止EcoPaste主程序
tasklist | find /i "eco-paste.exe" >nul 2>&1
if errorlevel 1 goto skip_ecopaste
taskkill /f /im "eco-paste.exe" 2>nul
if errorlevel 1 goto skip_ecopaste
echo   [成功] 已停止 eco-paste.exe
set /a stopped_count+=1
set /a total_processes+=1
goto check_cargo
:skip_ecopaste
echo   [信息] 未发现 eco-paste.exe 进程

:check_cargo
REM 停止Cargo构建进程
tasklist | find /i "cargo.exe" >nul 2>&1
if errorlevel 1 goto skip_cargo
taskkill /f /im "cargo.exe" 2>nul
if errorlevel 1 goto skip_cargo
echo   [成功] 已停止 cargo.exe
set /a stopped_count+=1
set /a total_processes+=1
goto check_port3001
:skip_cargo
echo   [信息] 未发现 cargo.exe 进程

:check_port3001
echo.
echo [2/5] 停止后端服务 (端口3001)...
netstat -an | find ":3001" | find "LISTENING" >nul 2>&1
if errorlevel 1 goto skip_port3001
echo   [信息] 发现端口3001被占用，正在停止相关进程...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    set /a total_processes+=1
    taskkill /f /pid %%a 2>nul
    if not errorlevel 1 (
        echo   [成功] 已停止端口3001上的进程 (PID: %%a)
        set /a stopped_count+=1
    )
)
goto check_port1420
:skip_port3001
echo   [信息] 端口3001未被占用

:check_port1420
echo.
echo [3/5] 停止前端服务 (端口1420)...
netstat -an | find ":1420" | find "LISTENING" >nul 2>&1
if errorlevel 1 goto skip_port1420
echo   [信息] 发现端口1420被占用，正在停止相关进程...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":1420" ^| find "LISTENING"') do (
    set /a total_processes+=1
    taskkill /f /pid %%a 2>nul
    if not errorlevel 1 (
        echo   [成功] 已停止端口1420上的进程 (PID: %%a)
        set /a stopped_count+=1
    )
)
goto check_windows
:skip_port1420
echo   [信息] 端口1420未被占用

:check_windows
echo.
echo [4/5] 停止EcoPaste相关窗口进程...
tasklist /fi "WINDOWTITLE eq EcoPaste*" 2>nul | find "EcoPaste" >nul
if errorlevel 1 goto skip_windows
echo   [信息] 发现EcoPaste相关窗口进程，正在停止...
taskkill /f /fi "WINDOWTITLE eq EcoPaste*" 2>nul
if not errorlevel 1 (
    echo   [成功] 已停止EcoPaste相关窗口进程
    set /a stopped_count+=1
    set /a total_processes+=1
)
goto cleanup
:skip_windows
echo   [信息] 未发现EcoPaste相关窗口进程

:cleanup
echo.
echo [5/5] 清理临时文件和缓存...
REM 清理可能的临时文件
if exist "%TEMP%\tauri-*" (
    rd /s /q "%TEMP%\tauri-*" 2>nul
    echo   [成功] 已清理Tauri临时文件
)

if exist "target\debug" (
    echo   [信息] 保留构建缓存 (target/debug)
)

echo.
echo ========================================
if !total_processes! equ 0 (
    echo [成功] 没有发现运行中的EcoPaste进程
    goto end_summary
)
if !stopped_count! equ !total_processes! (
    echo [成功] 成功停止所有EcoPaste开发服务 (!stopped_count!/!total_processes!)
    goto end_summary
)
echo [警告] 部分进程停止失败 (!stopped_count!/!total_processes!)
echo    请检查是否有进程被其他程序占用
:end_summary
echo ========================================
echo.
echo [提示] 如需重新启动，请运行 start-dev.bat
echo.
echo 按任意键退出...
pause >nul