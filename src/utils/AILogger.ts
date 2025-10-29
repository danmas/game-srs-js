import { Vehicle } from "../objects/Vehicle";
import { UniversalLogger } from "./UniversalLogger";

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
        UniversalLogger.log(`AI Log initialized`, 'AI_LOGGER', 'INFO');
    }

    /**
     * Логирует решение, принятое стратегией ИИ.
     * @param owner Объект, управляемый ИИ.
     * @param strategyName Имя стратегии ИИ, принявшей решение.
     * @param decision Описание принятого решения.
     * @param reason Контекст или причина принятия решения.
     */
    public static log(owner: Vehicle, strategyName: string, decision: string, reason: string): void {
        if (!this.isInitialized) {
            this.initialize();
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const ownerInfo = `${owner.entityType} ${owner.id}`;
        const message = `[${timestamp}] [${ownerInfo}] [${strategyName}] | Decision: ${decision} | Reason: ${reason}`;
        
        this.logMessage(message);
        UniversalLogger.log(`${ownerInfo} - ${decision}: ${reason}`, 'AI', 'INFO');
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
     */
    public static changeLogContext(owner: Vehicle, newStrategyName: string): void {
        const ownerInfo = `${owner.entityType} ${owner.id}`;
        this.logMessage(`--- [${ownerInfo}] AI Strategy changed to [${newStrategyName}] ---`);
        UniversalLogger.log(`Strategy changed to ${newStrategyName}`, `AI_${ownerInfo}`, 'INFO');
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
        UniversalLogger.log(`AI logs downloaded (${this.logs.length} entries)`, 'AI_LOGGER', 'INFO');
    }
}
