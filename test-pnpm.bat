@echo off
echo Testing pnpm availability...
echo.

echo Testing direct pnpm call:
pnpm --version
echo Direct call completed with errorlevel %errorlevel%
echo.

echo Testing pnpm with redirection:
pnpm --version >nul 2>&1
echo Redirection call completed with errorlevel %errorlevel%
echo.

echo Testing for loop:
for /f "tokens=*" %%i in ('pnpm --version') do echo Version: %%i
echo For loop completed
echo.

pause