@echo off
echo Запуск Silent Red Storm с логированием на сервер
echo.

REM Проверяем наличие необходимых пакетов
echo Проверка зависимостей...
call npm install

REM Сборка проекта
echo.
echo Сборка проекта...
call npm run build

REM Запуск сервера
echo.
echo Запуск сервера...
echo Логи будут сохраняться в папку logs
echo.
echo Игра будет доступна по адресу: http://localhost:3101
echo.
echo Для остановки нажмите Ctrl+C
echo.
call npm run server
