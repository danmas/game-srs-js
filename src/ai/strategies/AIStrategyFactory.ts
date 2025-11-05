import { Vehicle } from '../../objects/Vehicle';
import { Ship } from '../../objects/Ship';
import { Torpedo } from '../../objects/Torpedo';
import { MainScene } from '../../scenes/MainScene';
import { AIStrategy } from './AIStrategy';
import { AILogger } from '../../utils/AILogger';
import { UniversalLogger } from '../../utils/UniversalLogger';

/**
 * Фабрика для создания и управления стратегиями ИИ.
 */
export class AIStrategyFactory {
    // Хранилище всех доступных стратегий
    private static strategies: Map<string, new () => AIStrategy> = new Map();
    // Флаг инициализации стандартных стратегий
    private static initialized: boolean = false;
    // Загрузчик DSL стратегий (ленивая загрузка модуля)
    private static _dslLoader: any | null = null;
    
    /**
     * Ленивый геттер для загрузчика DSL стратегий
     * Использует require для избежания циклических зависимостей
     */
    private static get dslLoader(): any {
        if (!AIStrategyFactory._dslLoader) {
            // Ленивая загрузка модуля для избежания циклических зависимостей
            const module = (require as any)('../dsl/DSLStrategyLoader');
            const DSLStrategyLoaderClass = module.DSLStrategyLoader;
            AIStrategyFactory._dslLoader = DSLStrategyLoaderClass.getInstance();
        }
        return AIStrategyFactory._dslLoader;
    }
    
    // Кэш для ленивой загрузки классов стратегий
    private static _DefaultShipStrategy: (new () => AIStrategy) | null = null;
    private static _AggressiveShipStrategy: (new () => AIStrategy) | null = null;
    private static _HomingTorpedoStrategy: (new () => AIStrategy) | null = null;
    private static _MerchantShipStrategy: (new () => AIStrategy) | null = null;
    private static _SilentHunterStrategy: (new () => AIStrategy) | null = null;
    
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
    
    private static get SilentHunterStrategyClass(): new () => AIStrategy {
        if (!AIStrategyFactory._SilentHunterStrategy) {
            const module = (require as any)('./SilentHunterStrategy');
            AIStrategyFactory._SilentHunterStrategy = module.SilentHunterStrategy;
        }
        return AIStrategyFactory._SilentHunterStrategy!;
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
        AIStrategyFactory.registerStrategy('silent_hunter', AIStrategyFactory.SilentHunterStrategyClass);
        
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
     * @param scene Игровая сцена (требуется для DSL стратегий)
     * @returns Экземпляр стратегии или null, если стратегия не найдена
     */
    public static createStrategy(id: string, scene?: MainScene): AIStrategy | null {
        AIStrategyFactory.ensureInitialized();
        
        // Сначала проверяем стандартные TypeScript стратегии
        const strategyClass = AIStrategyFactory.strategies.get(id);
        if (strategyClass) {
            return new strategyClass();
        }
        
        // Если не найдено, пробуем загрузить DSL стратегию из файла
        if (scene) {
            const dslStrategy = AIStrategyFactory.dslLoader.createStrategy(id, scene);
            if (dslStrategy) {
                return dslStrategy;
            }
        }
        
        return null;
    }
    
    /**
     * Создает и назначает стратегию объекту
     * @param id Идентификатор стратегии
     * @param vehicle Объект, которому назначается стратегия
     * @param scene Игровая сцена
     * @returns true, если стратегия успешно назначена
     */
    public static assignStrategy(id: string, vehicle: Vehicle, scene: MainScene): boolean {
        const strategy = AIStrategyFactory.createStrategy(id, scene);
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
        const tsStrategies = Array.from(AIStrategyFactory.strategies.keys());
        const dslStrategies = AIStrategyFactory.dslLoader.getLoadedStrategies();
        return [...tsStrategies, ...dslStrategies];
    }
    
    /**
     * Загружает DSL стратегию из файла по имени
     * @param strategyName Имя стратегии (имя файла без .yaml)
     * @returns Promise, который разрешается при успешной загрузке
     */
    public static async loadDSLStrategy(strategyName: string): Promise<boolean> {
        const yamlContent = await AIStrategyFactory.dslLoader.loadStrategy(strategyName);
        return yamlContent !== null;
    }
    
    /**
     * Загружает несколько DSL стратегий из файлов
     * @param strategyNames Массив имен стратегий
     * @returns Promise, который разрешается при успешной загрузке всех стратегий
     */
    public static async loadDSLStrategies(strategyNames: string[]): Promise<void> {
        await AIStrategyFactory.dslLoader.loadAllStrategies(strategyNames);
    }
    
    /**
     * Назначает DSL стратегию объекту по имени файла
     * @param strategyName Имя стратегии (имя файла без .yaml)
     * @param vehicle Объект, которому назначается стратегия
     * @param scene Игровая сцена
     * @returns Promise, который разрешается true при успешном назначении
     */
    public static async assignDSLStrategy(strategyName: string, vehicle: Vehicle, scene: MainScene): Promise<boolean> {
        // Проверяем, загружена ли стратегия
        if (!AIStrategyFactory.dslLoader.isStrategyLoaded(strategyName)) {
            // Пытаемся загрузить
            const loaded = await AIStrategyFactory.loadDSLStrategy(strategyName);
            if (!loaded) {
                UniversalLogger.warn(`Не удалось загрузить DSL стратегию '${strategyName}'`, 'AI_STRATEGY_FACTORY');
                return false;
            }
        }
        
        // Создаем и назначаем стратегию
        const strategy = AIStrategyFactory.dslLoader.createStrategy(strategyName, scene);
        if (!strategy) {
            UniversalLogger.warn(`Не удалось создать DSL стратегию '${strategyName}'`, 'AI_STRATEGY_FACTORY');
            return false;
        }
        
        strategy.initialize(vehicle, scene);
        vehicle.aiStrategy = strategy;
        AILogger.changeLogContext(vehicle, strategy.name);
        
        UniversalLogger.info(`DSL стратегия '${strategyName}' назначена объекту ${vehicle.id}`, 'AI_STRATEGY_FACTORY');
        return true;
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
    
    /**
     * Создает стратегию из YAML DSL описания
     * @param dslYaml Строка с YAML описанием стратегии на DSL
     * @param scene Игровая сцена
     * @returns Экземпляр стратегии или null в случае ошибки
     */
    public static createStrategyFromDSL(dslYaml: string, scene: MainScene): AIStrategy | null {
        try {
            // Ленивая загрузка DSLStrategy для избежания циклических зависимостей
            const module = (require as any)('../dsl/DSLStrategy');
            const DSLStrategyClass = module.DSLStrategy;
            
            // Создаем экземпляр DSL стратегии
            const strategy = new DSLStrategyClass(dslYaml, scene);
            return strategy;
        } catch (e) {
            console.error("Ошибка при создании DSL стратегии:", e);
            return null;
        }
    }
    
    /**
     * Создает и назначает DSL стратегию объекту
     * @param dslYaml Строка с YAML описанием стратегии на DSL
     * @param vehicle Объект, которому назначается стратегия
     * @param scene Игровая сцена
     * @returns true, если стратегия успешно создана и назначена
     */
    public static assignStrategyFromDSL(dslYaml: string, vehicle: Vehicle, scene: MainScene): boolean {
        const strategy = AIStrategyFactory.createStrategyFromDSL(dslYaml, scene);
        if (!strategy) return false;
        
        strategy.initialize(vehicle, scene);
        vehicle.aiStrategy = strategy;
        AILogger.changeLogContext(vehicle, strategy.name);
        return true;
    }
}
