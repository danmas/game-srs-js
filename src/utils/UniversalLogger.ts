/**
 * Универсальный логгер для браузера и сервера
 * Логирует в консоль, localStorage браузера и отправляет на сервер (если доступен)
 */
export class UniversalLogger {
    private static logs: string[] = [];
    private static maxLocalStorageLogs: number = 10000;
    private static storageKey: string = 'game_logs_session';
    private static isInitialized: boolean = false;
    
    /**
     * Инициализирует логгер
     */
    public static initialize(): void {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Загружаем существующие логи из localStorage
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load logs from localStorage:', e);
        }
        
        const timestamp = new Date().toISOString();
        this.log(`========== Logger Initialized at ${timestamp} ==========`, 'INIT');
    }
    
    /**
     * Логирует сообщение
     * @param message Сообщение для логирования
     * @param tag Тег для категоризации (например 'AI', 'PHYSICS', 'INPUT')
     * @param level Уровень логирования ('DEBUG', 'INFO', 'WARN', 'ERROR')
     */
    public static log(message: string, tag: string = 'LOG', level: string = 'INFO'): void {
        if (!this.isInitialized) {
            this.initialize();
        }
        
        const timestamp = new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        });
        
        const formattedMessage = `[${timestamp}] [${tag}] [${level}] ${message}`;
        
        // 1. Логируем в консоль браузера с цветом
        const consoleStyle = this.getConsoleStyle(level);
        console.log(`%c${formattedMessage}`, consoleStyle);
        
        // 2. Сохраняем в памяти и localStorage
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
        
        // 3. Отправляем на сервер (асинхронно, если доступен)
        this.sendToServer(formattedMessage, tag, level).catch(() => {
            // Ошибка при отправке на сервер - игнорируем, логирование в браузере всё равно работает
        });
    }
    
    /**
     * Логирует ошибку
     */
    public static error(message: string, tag: string = 'ERROR'): void {
        this.log(message, tag, 'ERROR');
    }
    
    /**
     * Логирует предупреждение
     */
    public static warn(message: string, tag: string = 'WARN'): void {
        this.log(message, tag, 'WARN');
    }
    
    /**
     * Логирует отладочное сообщение
     */
    public static debug(message: string, tag: string = 'DEBUG'): void {
        this.log(message, tag, 'DEBUG');
    }
    
    /**
     * Отправляет логи на сервер
     */
    private static async sendToServer(message: string, tag: string, level: string): Promise<void> {
        // Определяем URL сервера логов
        // В dev режиме используем localhost:3101, в production - текущий хост
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const serverUrl = isLocalhost && window.location.port !== '3101' 
            ? 'http://localhost:3101/api/logs' 
            : '/api/logs';
            
        try {
            // Отладочное сообщение о попытке отправки лога
            if (isLocalhost) {
                console.debug(`[Logger] Отправка лога на сервер: ${serverUrl}`);
            }
            
            // Пытаемся отправить, но не ждём ответ
            fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, tag, level, timestamp: new Date().toISOString() }),
                // Добавляем credentials для поддержки CORS
                credentials: 'include',
                mode: 'cors'
            })
            .then(response => {
                if (isLocalhost && response.ok) {
                    console.debug(`[Logger] Лог успешно отправлен на сервер: ${tag} - ${message.substring(0, 30)}...`);
                }
                return response;
            })
            .catch((error) => {
                // Выводим ошибку в консоль только в режиме разработки
                if (isLocalhost) {
                    console.error(`[Logger] Не удалось отправить лог на сервер: ${error.message}`);
                    console.error(`[Logger] URL: ${serverUrl}, Tag: ${tag}, Level: ${level}`);
                }
                // Сервер недоступен - это нормально для браузерной игры
            });
        } catch (e) {
            // Игнорируем ошибки отправки
        }
    }
    
    /**
     * Возвращает стиль для console.log
     */
    private static getConsoleStyle(level: string): string {
        switch (level) {
            case 'ERROR':
                return 'color: #FF4444; font-weight: bold; font-size: 12px;';
            case 'WARN':
                return 'color: #FFAA00; font-weight: bold; font-size: 12px;';
            case 'DEBUG':
                return 'color: #00AAFF; font-size: 11px;';
            case 'INIT':
                return 'color: #00FF00; font-weight: bold; font-size: 12px;';
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
