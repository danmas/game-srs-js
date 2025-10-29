/**
 * Универсальный логгер для браузера и сервера
 * Логирует в консоль, localStorage браузера и отправляет на сервер (если доступен)
 */
export enum LogLevel {
    TRACE = 0,  // Очень детальное логирование
    DEBUG = 1,  // Отладочная информация
    INFO = 2,   // Информационные сообщения
    WARN = 3,   // Предупреждения
    ERROR = 4   // Ошибки
}

export interface LogSettings {
    minLevel: LogLevel;           // Минимальный уровень для логирования
    enableConsole: boolean;       // Включить логирование в консоль
    enableLocalStorage: boolean;  // Включить сохранение в localStorage
    enableServer: boolean;        // Включить отправку на сервер
    throttleInterval: number;     // Интервал дросселирования (мс)
    useStructuredFormat: boolean; // Использовать структурированный формат (JSON)
}

export interface LogContext {
    [key: string]: any;           // Дополнительные данные для структурированного логирования
}

export class UniversalLogger {
    private static logs: string[] = [];
    private static maxLocalStorageLogs: number = 10000;
    private static storageKey: string = 'game_logs_session';
    private static isInitialized: boolean = false;
    
    // Хранение последних логов по тегам для дросселирования
    private static lastLogs: Map<string, {
        message: string,
        timestamp: number,
        count: number
    }> = new Map();
    
    // Настройки логирования по умолчанию
    private static settings: LogSettings = {
        minLevel: LogLevel.INFO,
        enableConsole: true,
        enableLocalStorage: true,
        enableServer: true,
        throttleInterval: 1000, // 1 секунда
        useStructuredFormat: false
    };
    
    /**
     * Инициализирует логгер
     */
    public static initialize(settings?: Partial<LogSettings>): void {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Применяем пользовательские настройки, если они предоставлены
        if (settings) {
            this.updateSettings(settings);
        }
        
        // Загружаем существующие логи из localStorage
        if (this.settings.enableLocalStorage) {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    this.logs = JSON.parse(stored);
                }
            } catch (e) {
                console.error('Failed to load logs from localStorage:', e);
            }
        }
        
        const timestamp = new Date().toISOString();
        this.log(`========== Logger Initialized at ${timestamp} ==========`, 'INIT', LogLevel.INFO);
    }
    
    /**
     * Обновляет настройки логирования
     */
    public static updateSettings(settings: Partial<LogSettings>): void {
        this.settings = { ...this.settings, ...settings };
        
        // Логируем изменение настроек
        if (this.isInitialized) {
            const settingsStr = JSON.stringify(this.settings);
            this.log(`Logger settings updated: ${settingsStr}`, 'LOGGER', LogLevel.INFO);
        }
    }
    
    /**
     * Получает текущие настройки логирования
     */
    public static getSettings(): LogSettings {
        return { ...this.settings };
    }
    
    /**
     * Проверяет, нужно ли логировать сообщение с данным уровнем
     */
    private static shouldLog(level: LogLevel): boolean {
        return level >= this.settings.minLevel;
    }
    
    /**
     * Проверяет, нужно ли дросселировать логи
     * @returns true если сообщение нужно логировать, false если его нужно пропустить
     */
    private static shouldThrottle(tag: string, message: string): boolean {
        const now = Date.now();
        const key = `${tag}:${message.substring(0, 50)}`;
        
        // Проверяем, было ли похожее сообщение недавно
        const lastLog = this.lastLogs.get(key);
        if (lastLog) {
            // Если прошло меньше времени, чем интервал дросселирования
            if (now - lastLog.timestamp < this.settings.throttleInterval) {
                // Увеличиваем счетчик и обновляем время
                lastLog.count++;
                lastLog.timestamp = now;
                this.lastLogs.set(key, lastLog);
                return true; // Дросселируем
            } else {
                // Если было много пропущенных сообщений, логируем это
                if (lastLog.count > 1) {
                    const throttleMsg = `Пропущено ${lastLog.count - 1} похожих сообщений для тега ${tag}`;
                    this.logToConsole(throttleMsg, tag, LogLevel.DEBUG);
                }
                // Сбрасываем счетчик и обновляем время
                this.lastLogs.set(key, { message, timestamp: now, count: 1 });
            }
        } else {
            // Первое сообщение такого типа
            this.lastLogs.set(key, { message, timestamp: now, count: 1 });
        }
        
        return false; // Не дросселируем
    }
    
    /**
     * Логирует сообщение в консоль
     */
    private static logToConsole(message: string, tag: string, level: LogLevel): void {
        if (!this.settings.enableConsole) return;
        
        const timestamp = new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        });
        
        const levelStr = LogLevel[level];
        const formattedMessage = `[${timestamp}] [${tag}] [${levelStr}] ${message}`;
        
        // Логируем в консоль браузера с цветом
        const consoleStyle = this.getConsoleStyle(level);
        console.log(`%c${formattedMessage}`, consoleStyle);
    }
    
    /**
     * Сохраняет лог в localStorage
     */
    private static saveToLocalStorage(formattedMessage: string): void {
        if (!this.settings.enableLocalStorage) return;
        
        // Сохраняем в памяти
        this.logs.push(formattedMessage);
        
        // Ограничиваем размер логов
        if (this.logs.length > this.maxLocalStorageLogs) {
            this.logs = this.logs.slice(-this.maxLocalStorageLogs);
        }
        
        // Сохраняем в localStorage
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
        } catch (e) {
            // Если localStorage переполнен, удаляем старые логи
            console.error('localStorage full, clearing old logs:', e);
            this.logs = this.logs.slice(-5000);
            localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
        }
    }
    
    /**
     * Логирует сообщение
     * @param message Сообщение для логирования
     * @param tag Тег для категоризации (например 'AI', 'PHYSICS', 'INPUT')
     * @param level Уровень логирования
     * @param context Дополнительный контекст для структурированного логирования
     */
    public static log(message: string, tag: string = 'LOG', level: LogLevel = LogLevel.INFO, context?: LogContext): void {
        if (!this.isInitialized) {
            this.initialize();
        }
        
        // Проверяем уровень логирования
        if (!this.shouldLog(level)) {
            return;
        }
        
        // Проверяем дросселирование
        if (this.shouldThrottle(tag, message)) {
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        });
        
        const levelStr = LogLevel[level];
        
        // Формируем сообщение в зависимости от формата
        let formattedMessage: string;
        if (this.settings.useStructuredFormat) {
            const logData = {
                timestamp,
                tag,
                level: levelStr,
                message,
                ...(context || {})
            };
            formattedMessage = JSON.stringify(logData);
        } else {
            formattedMessage = `[${timestamp}] [${tag}] [${levelStr}] ${message}`;
        }
        
        // 1. Логируем в консоль браузера
        this.logToConsole(message, tag, level);
        
        // 2. Сохраняем в localStorage
        this.saveToLocalStorage(formattedMessage);
        
        // 3. Отправляем на сервер (асинхронно, если доступен)
        if (this.settings.enableServer) {
            this.sendToServer(message, tag, levelStr, context).catch(() => {
                // Ошибка при отправке на сервер - игнорируем, логирование в браузере всё равно работает
            });
        }
    }
    
    /**
     * Логирует ошибку
     */
    public static error(message: string, tag: string = 'ERROR', context?: LogContext): void {
        this.log(message, tag, LogLevel.ERROR, context);
    }
    
    /**
     * Логирует предупреждение
     */
    public static warn(message: string, tag: string = 'WARN', context?: LogContext): void {
        this.log(message, tag, LogLevel.WARN, context);
    }
    
    /**
     * Логирует информационное сообщение
     */
    public static info(message: string, tag: string = 'INFO', context?: LogContext): void {
        this.log(message, tag, LogLevel.INFO, context);
    }
    
    /**
     * Логирует отладочное сообщение
     */
    public static debug(message: string, tag: string = 'DEBUG', context?: LogContext): void {
        this.log(message, tag, LogLevel.DEBUG, context);
    }
    
    /**
     * Логирует трассировочное сообщение (самый низкий уровень)
     */
    public static trace(message: string, tag: string = 'TRACE', context?: LogContext): void {
        this.log(message, tag, LogLevel.TRACE, context);
    }
    
    /**
     * Отправляет логи на сервер
     */
    private static async sendToServer(message: string, tag: string, level: string, context?: LogContext): Promise<void> {
        // Определяем URL сервера логов
        // В dev режиме используем localhost:3101, в production - текущий хост
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const serverUrl = isLocalhost && window.location.port !== '3101' 
            ? 'http://localhost:3101/api/logs' 
            : '/api/logs';
            
        try {
            // Формируем данные для отправки
            const logData = {
                message,
                tag,
                level,
                timestamp: new Date().toISOString(),
                context: context || {}
            };
            
            // Пытаемся отправить, но не ждём ответ
            fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData),
                // Добавляем credentials для поддержки CORS
                credentials: 'include',
                mode: 'cors'
            })
            .catch(() => {
                // Сервер недоступен - это нормально для браузерной игры
            });
        } catch (e) {
            // Игнорируем ошибки отправки
        }
    }
    
    /**
     * Возвращает стиль для console.log
     */
    private static getConsoleStyle(level: LogLevel): string {
        switch (level) {
            case LogLevel.ERROR:
                return 'color: #FF4444; font-weight: bold; font-size: 12px;';
            case LogLevel.WARN:
                return 'color: #FFAA00; font-weight: bold; font-size: 12px;';
            case LogLevel.DEBUG:
                return 'color: #00AAFF; font-size: 11px;';
            case LogLevel.TRACE:
                return 'color: #888888; font-size: 10px;';
            case LogLevel.INFO:
                return 'color: #CCCCCC; font-size: 12px;';
            default:
                return 'color: #CCCCCC; font-size: 12px;';
        }
    }
    
    /**
     * Скачивает логи как текстовый файл
     */
    public static downloadLogs(): void {
        if (this.logs.length === 0) {
            alert('Нет логов для скачивания');
            return;
        }
        
        const logData = this.logs.join('\n');
        const blob = new Blob([logData], { type: 'text/plain; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `game_logs_${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('[UniversalLogger] Downloaded logs file');
    }
    
    /**
     * Очищает логи
     */
    public static clearLogs(): void {
        this.logs = [];
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
        }
        console.log('[UniversalLogger] Logs cleared');
    }
    
    /**
     * Возвращает все логи
     */
    public static getAllLogs(): string[] {
        return [...this.logs];
    }
    
    /**
     * Возвращает количество логов
     */
    public static getLogCount(): number {
        return this.logs.length;
    }
    
    /**
     * Экспортирует логи как JSON
     */
    public static exportAsJSON(): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            logCount: this.logs.length,
            logs: this.logs
        }, null, 2);
    }
}
