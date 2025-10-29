import { Vehicle } from "../objects/Vehicle";
import { UniversalLogger, LogLevel, LogContext } from "./UniversalLogger";

/**
 * AILogger предоставляет простой механизм логирования решений ИИ.
 * Логи выводятся в консоль, хранятся в памяти и могут быть загружены в виде файла.
 */
export class AILogger {
    private static logs: string[] = [];
    private static isInitialized: boolean = false;

    /**
     * Инициализирует логгер для новой сессии.
     * Очищает все предыдущие логи.
     */
    public static initialize(): void {
        this.logs = [];
        this.isInitialized = true;
        const timestamp = new Date().toISOString();
        const message = `--- AI Log Initialized at ${timestamp} ---`;
        this.logMessage(message);
        UniversalLogger.log(`AI Log initialized`, 'AI_LOGGER', LogLevel.INFO);
    }

    /**
     * Логирует решение, принятое стратегией ИИ.
     * @param owner Объект, управляемый ИИ.
     * @param strategyName Имя стратегии ИИ, принявшей решение.
     * @param decision Описание принятого решения.
     * @param reason Контекст или причина принятия решения.
     * @param level Уровень логирования.
     * @param context Дополнительный контекст.
     */
    public static log(
        owner: Vehicle, 
        strategyName: string, 
        decision: string, 
        reason: string, 
        level: LogLevel = LogLevel.INFO,
        context?: LogContext
    ): void {
        if (!this.isInitialized) {
            this.initialize();
        }
        
        // Используем дросселирование логов на основе изменения состояния
        // Логируем только если решение или причина изменились
        const logState = {
            decision,
            reason
        };
        
        // Используем встроенный механизм дросселирования в Vehicle
        const wasLogged = owner.logIfStateChanged(
            `ai_decision_${strategyName}`,
            `${decision}: ${reason}`,
            logState,
            'AI',
            level,
            {
                ...context,
                strategy: strategyName
            }
        );
        
        // Если лог был отправлен, сохраняем его и в локальную историю AILogger
        if (wasLogged) {
            const timestamp = new Date().toLocaleTimeString();
            const ownerInfo = `${owner.entityType} ${owner.id}`;
            const message = `[${timestamp}] [${ownerInfo}] [${strategyName}] | Decision: ${decision} | Reason: ${reason}`;
            this.logMessage(message);
        }
    }

    /**
     * Добавляет отформатированное сообщение в лог и выводит его в консоль.
     * @param message Сообщение для логирования.
     */
    private static logMessage(message: string): void {
        console.log(`%cAI LOG: ${message}`, 'color: #3399FF;');
        this.logs.push(message);
    }

    /**
     * Отмечает в логе смену стратегии ИИ у объекта.
     * @param owner Объект, у которого меняется ИИ.
     * @param newStrategyName Имя новой стратегии.
     * @param oldStrategyName Имя предыдущей стратегии.
     */
    public static changeLogContext(
        owner: Vehicle, 
        newStrategyName: string, 
        oldStrategyName?: string
    ): void {
        const ownerInfo = `${owner.entityType} ${owner.id}`;
        
        // Всегда логируем смену стратегии, это важное событие
        const message = oldStrategyName 
            ? `Strategy changed from ${oldStrategyName} to ${newStrategyName}` 
            : `Strategy changed to ${newStrategyName}`;
            
        this.logMessage(`--- [${ownerInfo}] AI Strategy changed to [${newStrategyName}] ---`);
        
        // Используем структурированное логирование для этого события
        UniversalLogger.log(
            message, 
            `AI_${ownerInfo}`, 
            LogLevel.INFO,
            {
                entityId: owner.id,
                entityType: owner.entityType,
                newStrategy: newStrategyName,
                oldStrategy: oldStrategyName || 'unknown'
            }
        );
    }

    /**
     * Инициирует загрузку текущей сессии логов в виде .txt файла.
     */
    public static downloadLog(): void {
        if (this.logs.length <= 1) { // Учитываем сообщение об инициализации
            console.warn("AILogger: Нет логов для загрузки.");
            return;
        }

        const logData = this.logs.join('\n');
        const blob = new Blob([logData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `ai_log_${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("AILogger: Загрузка файла логов инициирована.");
        UniversalLogger.log(`AI logs downloaded (${this.logs.length} entries)`, 'AI_LOGGER', LogLevel.INFO);
    }
}
