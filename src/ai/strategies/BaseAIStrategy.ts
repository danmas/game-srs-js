import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { AIStrategy, AIWorldContext } from './AIStrategy';
import { AILogger } from '../../utils/AILogger';
import { UniversalLogger } from '../../utils/UniversalLogger';

/**
 * Базовая абстрактная стратегия, реализующая общую функциональность.
 * От нее должны наследоваться все конкретные стратегии.
 */
export abstract class BaseAIStrategy implements AIStrategy {
    public abstract readonly name: string;
    public abstract readonly description: string;
    
    protected owner: Vehicle | null = null;
    protected scene: MainScene | null = null;
    
    /**
     * Инициализация стратегии
     */
    public initialize(owner: Vehicle, scene: MainScene): void {
        this.owner = owner;
        this.scene = scene;
        this.onInitialize();
    }
    
    /**
     * Метод для переопределения в дочерних классах для дополнительной инициализации
     */
    protected onInitialize(): void {
        // Пустая реализация по умолчанию
    }
    
    /**
     * Фаза анализа (переопределяется в дочерних классах)
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        this.logDecision("Analyze Step", "Evaluating situation.");
    }
    
    /**
     * Фаза действия (переопределяется в дочерних классах)
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        this.logDecision("Action Step", "Executing decisions.");
    }

    /**
     * Отправляет сообщение в логгер ИИ.
     * @param decision Краткое описание решения.
     * @param reason Контекст и причина решения.
     */
    protected logDecision(decision: string, reason: string): void {
        UniversalLogger.debug(`[${this.owner?.entityType} ${this.owner?.id}] ${decision}: ${reason}`, `AI_${this.name}`);
        if (this.owner) {
            AILogger.log(this.owner, this.name, decision, reason);
        }
    }
    
    /**
     * Проверяет, находится ли цель в зоне обнаружения 2 или выше
     */
    protected isTargetDetected(targetId: number): boolean {
        if (!this.owner) return false;
        
        const targetInfo = this.owner.perceivedTargets.get(targetId);
        if (!targetInfo) return false;
        
        // Зона 2 (локализовано) или Зона 3 (идентифицировано)
        return targetInfo.detectionState >= 1; // DetectionState.ZONE_2_LOCALIZED
    }
}
