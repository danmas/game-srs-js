import { Vehicle } from '../../objects/Vehicle';
import { Ship } from '../../objects/Ship';
import { Torpedo } from '../../objects/Torpedo';
import { MainScene } from '../../scenes/MainScene';
import { AIStrategy } from './AIStrategy';
import { DefaultShipStrategy } from './DefaultShipStrategy';
import { AggressiveShipStrategy } from './AggressiveShipStrategy';
import { HomingTorpedoStrategy } from './HomingTorpedoStrategy';
import { AILogger } from '../../utils/AILogger';

/**
 * Фабрика для создания и управления стратегиями ИИ.
 */
export class AIStrategyFactory {
    // Хранилище всех доступных стратегий
    private static strategies: Map<string, new () => AIStrategy> = new Map();
    
    // Инициализация стандартных стратегий
    static {
        AIStrategyFactory.registerStrategy('default_ship', DefaultShipStrategy);
        AIStrategyFactory.registerStrategy('aggressive_ship', AggressiveShipStrategy);
        AIStrategyFactory.registerStrategy('homing_torpedo', HomingTorpedoStrategy);
    }
    
    /**
     * Регистрирует новую стратегию в фабрике
     * @param id Уникальный идентификатор стратегии
     * @param strategyClass Класс стратегии
     */
    public static registerStrategy(id: string, strategyClass: new () => AIStrategy): void {
        AIStrategyFactory.strategies.set(id, strategyClass);
    }
    
    /**
     * Создает стратегию по идентификатору
     * @param id Идентификатор стратегии
     * @returns Экземпляр стратегии или null, если стратегия не найдена
     */
    public static createStrategy(id: string): AIStrategy | null {
        const strategyClass = AIStrategyFactory.strategies.get(id);
        if (!strategyClass) return null;
        
        return new strategyClass();
    }
    
    /**
     * Создает и назначает стратегию объекту
     * @param id Идентификатор стратегии
     * @param vehicle Объект, которому назначается стратегия
     * @param scene Игровая сцена
     * @returns true, если стратегия успешно назначена
     */
    public static assignStrategy(id: string, vehicle: Vehicle, scene: MainScene): boolean {
        const strategy = AIStrategyFactory.createStrategy(id);
        if (!strategy) return false;
        
        strategy.initialize(vehicle, scene);
        vehicle.aiStrategy = strategy;
        AILogger.changeLogContext(vehicle, strategy.name);
        return true;
    }
    
    /**
     * Возвращает подходящую стратегию по умолчанию для объекта
     * @param vehicle Объект
     * @param scene Игровая сцена
     * @returns Стратегия по умолчанию
     */
    public static getDefaultStrategy(vehicle: Vehicle, scene: MainScene): AIStrategy {
        if (vehicle instanceof Ship) {
            const strategy = new DefaultShipStrategy();
            strategy.initialize(vehicle, scene);
            return strategy;
        } else if (vehicle instanceof Torpedo) {
            const strategy = new HomingTorpedoStrategy();
            strategy.initialize(vehicle, scene);
            return strategy;
        }
        
        // Если не удалось определить тип, возвращаем пустую стратегию
        const strategy = new DefaultShipStrategy();
        strategy.initialize(vehicle, scene);
        return strategy;
    }
    
    /**
     * Возвращает список всех доступных стратегий
     * @returns Массив идентификаторов стратегий
     */
    public static getAvailableStrategies(): string[] {
        return Array.from(AIStrategyFactory.strategies.keys());
    }
    
    /**
     * Создает стратегию из строки кода JavaScript
     * @param code Строка с JavaScript кодом
     * @param vehicle Объект, которому назначается стратегия
     * @param scene Игровая сцена
     * @returns Экземпляр стратегии или null в случае ошибки
     */
    public static createStrategyFromCode(code: string, vehicle: Vehicle, scene: MainScene): AIStrategy | null {
        try {
            // Оборачиваем код в функцию, которая возвращает класс стратегии
            const wrappedCode = `
                ${code}
                return CustomAIStrategy;
            `;
            
            // "Компилируем" строку в класс
            const CustomAIClass = new Function(wrappedCode)();
            
            // Создаем экземпляр
            const strategy = new CustomAIClass();
            
            // Инициализируем
            strategy.initialize(vehicle, scene);
            
            AILogger.changeLogContext(vehicle, strategy.name || 'Unnamed Custom Strategy');
            return strategy;
        } catch (e) {
            console.error("Ошибка в сгенерированном коде ИИ:", e);
            return null;
        }
    }
}
