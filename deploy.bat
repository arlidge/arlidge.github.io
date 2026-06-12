@echo off
REM deploy.bat
REM Stage, commit, and push local changes to GitHub Pages.
REM
REM Usage:
REM   deploy.bat                          (auto-generates a timestamped message)
REM   deploy.bat "Your commit message"    (uses your message — keep the quotes)
REM
REM Works from a double-click in Explorer or from the command line.
REM GitHub Pages republishes within ~1-2 minutes of a successful push.

setlocal enabledelayedexpansion
pushd "%~dp0"

REM --- preview --------------------------------------------------------------
echo.
for /f "tokens=*" %%R in ('git config --get remote.origin.url') do set "REMOTE=%%R"
for /f "tokens=*" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo Repo:   !REMOTE!
echo Branch: !BRANCH!
echo.
echo Changes to deploy:
git status --short
echo.

REM --- detect dirty + unpushed commits --------------------------------------
set "DIRTY="
for /f "delims=" %%S in ('git status --porcelain') do set "DIRTY=1"

set "AHEAD=0"
for /f %%A in ('git rev-list --count "@{u}..HEAD" 2^>NUL') do set "AHEAD=%%A"
if "!AHEAD!"=="" set "AHEAD=0"

if "!DIRTY!"=="" if "!AHEAD!"=="0" (
    echo Nothing to commit and nothing to push. Up to date.
    goto :done
)

REM --- commit local changes -------------------------------------------------
if defined DIRTY (
    set "MSG=%~1"
    if "!MSG!"=="" (
        for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "STAMP=%%T"
        set "MSG=Site update !STAMP!"
    )

    echo Staging all changes...
    git add -A
    if errorlevel 1 (
        echo git add failed.
        goto :fail
    )

    echo Committing: !MSG!
    git commit -m "!MSG!"
    if errorlevel 1 (
        echo git commit failed.
        goto :fail
    )
)

REM --- push -----------------------------------------------------------------
echo.
echo Pushing to origin/!BRANCH!...
git push origin !BRANCH!
if errorlevel 1 (
    echo.
    echo Push failed. Check the error above ^(auth, network, or remote conflict^).
    goto :fail
)

echo.
echo Deployed. GitHub Pages will publish in ~1-2 minutes.
goto :done

:fail
popd
endlocal
echo.
pause
exit /b 1

:done
popd
endlocal
echo.
pause
exit /b 0
