@echo off
setlocal
cd /d "%~dp0.."

where git >nul 2>nul || (echo Git nao encontrado. Instale em https://git-scm.com/download/win ^& pause ^& exit /b 1)

if not exist ".git" (
  git init -b main
  git remote add origin https://github.com/Eduoliver04/crm-eduardo.git
)

git remote set-url origin https://github.com/Eduoliver04/crm-eduardo.git
git add -A

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Atualizacao do Caderno de Caixa"
git commit -m "%MSG%" || echo (nada novo para commitar)

git push -u origin main
echo.
echo Pronto.
pause
