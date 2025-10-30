import { Vehicle } from '../../objects/Vehicle';
import { Ship } from '../../objects/Ship';
import { Torpedo } from '../../objects/Torpedo';
import { MainScene } from '../../scenes/MainScene';
import { AIStrategy } from './AIStrategy';
import { AILogger } from '../../utils/AILogger';

/**
 * Фабрика для создания и управления стратегиями ИИ.
 */
export class AIStrategyFactory {
    // Хранилище всех доступных стратегий
    private static strategies: Map<string, new () => AIStrategy> = new Map();
    // Флаг инициализации стандартных стратегий
    private static initialized: boolean = false;
    
    // Кэш для ленивой загрузки классов стратегий
    private static _DefaultShipStrategy: (new () => AIStrategy) | null = null;
    private static _AggressiveShipStrategy: (new () => AIStrategy) | null = null;
    private static _HomingTorpedoStrategy: (new () => AIStrategy) | null = null;
    private static _MerchantShipStrategy: (new () => AIStrategy) | null = null;
    
    /**
     * Ленивые геттеры для загрузки классов стратегий
     * Использует синхронный require для webpack совместимости
     */
    private static get DefaultShipStrategyClass(): new () => AIStrategy {
        if (!AIStrategyFactory._DefaultShipStrategy) {
            // Используем webpack-совместимый require
            const module = (require as any)('./DefaultShipStrategy');
            AIStrategyFactory._DefaultShipStrategy = module.DefaultShipStrategy;
        }
        return AIStrategyFactory._DefaultShipStrategy!;
    }
    
    private static get AggressiveShipStrategyClass(): new () => AIStrategy {
        if (!AIStrategyFactory._AggressiveShipStrategy) {
            const module = (require as any)('./AggressiveShipStrategy');
            AIStrategyFactory._AggressiveShipStrategy = module.AggressiveShipStrategy;
        }
        return AIStrategyFactory._AggressiveShipStrategy!;
    }
    
    private static get HomingTorpedoStrategyClass(): new () => AIStrategy {
        if (!AIStrategyFactory._HomingTorpedoStrategy) {
            const module = (require as any)('./HomingTorpedoStrategy');
            AIStrategyFactory._HomingTorpedoStrategy = module.HomingTorpedoStrategy;
        }
        return AIStrategyFactory._HomingTorpedoStrategy!;
    }
    
    private static get MerchantShipStrategyClass(): new () => AIStrategy {
        if (!AIStrategyFactory._MerchantShipStrategy) {
            const module = (require as any)('./MerchantShipStrategy');
            AIStrategyFactory._MerchantShipStrategy = module.MerchantShipStrategy;
        }
        return AIStrategyFactory._MerchantShipStrategy!;
    }
    
    /**
     * Ленивая инициализация стандартных стратегий
     * Вызывается автоматически при первом использовании фабрики
     */
    private static ensureInitialized(): void {
        if (AIStrategyFactory.initialized) return;
        
        // Ленивая загрузка классов стратегий для избежания циклических зависимостей
        AIStrategyFactory.registerStrategy('default_ship', AIStrategyFactory.DefaultShipStrategyClass);
        AIStrategyFactory.registerStrategy('aggressive_ship', AIStrategyFactory.AggressiveShipStrategyClass);
        AIStrategyFactory.registerStrategy('homing_torpedo', AIStrategyFactory.HomingTorpedoStrategyClass);
        AIStrategyFactory.registerStrategy('merchant_ship', AIStrategyFactory.MerchantShipStrategyClass);
        
        AIStrategyFactory.initialized = true;
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
        AIStrategyFactory.ensureInitialized();
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
        AIStrategyFactory.ensureInitialized();
        
        // Ленивая загрузка классов для избежания циклических зависимостей
        if (vehicle instanceof Ship) {
            const StrategyClass = AIStrategyFactory.DefaultShipStrategyClass;
            const strategy = new StrategyClass();
            strategy.initialize(vehicle, scene);
            return strategy;
        } else if (vehicle instanceof Torpedo) {
            const StrategyClass = AIStrategyFactory.HomingTorpedoStrategyClass;
            const strategy = new StrategyClass();
            strategy.initialize(vehicle, scene);
            return strategy;
        }
        
        // Если не удалось определить тип, возвращаем пустую стратегию
        const StrategyClass = AIStrategyFactory.DefaultShipStrategyClass;
        const strategy = new StrategyClass();
        strategy.initialize(vehicle, scene);
        return strategy;
    }
    
    /**
     * Возвращает список всех доступных стратегий
     * @returns Массив идентификаторов стратегий
     */
    public static getAvailableStrategies(): string[] {
        AIStrategyFactory.ensureInitialized();
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
