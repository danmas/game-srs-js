import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { AIStrategy } from './AIStrategy';
import { AIStrategyFactory } from './AIStrategyFactory';

/**
 * Класс для генерации и загрузки ИИ из кода.
 * Позволяет создавать стратегии ИИ на лету из строки кода.
 */
export class AICodeGenerator {
    /**
     * Генерирует шаблон кода для новой стратегии ИИ
     * @param name Имя стратегии
     * @returns Шаблон кода для новой стратегии
     */
    public static generateTemplate(name: string = "CustomAIStrategy"): string {
        return `
class ${name} {
    constructor() {
        this.name = "${name}";
        this.description = "Пользовательская стратегия ИИ";
    }
    
    /**
     * Инициализация стратегии
     */
    initialize(owner, scene) {
        this.owner = owner;
        this.scene = scene;
        console.log(\`Стратегия \${this.name} инициализирована для \${owner.entityType} \${owner.id}\`);
    }
    
    /**
     * Фаза анализа - сбор информации и оценка ситуации
     */
    analyzeStep(owner, context) {
        // Ваш код для анализа ситуации
        // Доступные данные:
        // - owner: управляемый объект (Ship, Submarine, Torpedo)
        // - context.perceivedTargets: карта обнаруженных целей
        // - context.scene: игровая сцена
        // - context.gameTime: текущее игровое время
    }
    
    /**
     * Фаза действия - принятие решений и выполнение действий
     */
    actionStep(owner, context) {
        // Ваш код для выполнения действий
        // Примеры действий:
        // - owner.setPower(6): установить максимальную скорость
        // - owner.setRudder(-3): повернуть руль вправо на 15°
        // - owner.addWayPoint(x, y): добавить путевую точку
        // - owner.clearWayPoints(): очистить путевые точки
        // - owner.startMoveOnWP(): начать движение по путевым точкам
        
        // Пример атаки (если owner - это Ship):
        // if (owner.isWeaponReady(1)) { // 1 = торпеда типа I
        //     context.scene.fireTorpedo(owner, 1, targetX, targetY);
        // }
    }
}

return ${name};
        `;
    }
    
    /**
     * Создает стратегию ИИ из кода и назначает ее объекту
     * @param code Строка с JavaScript кодом
     * @param vehicle Объект, которому назначается стратегия
     * @param scene Игровая сцена
     * @returns true, если стратегия успешно создана и назначена
     */
    public static createAndAssignStrategy(code: string, vehicle: Vehicle, scene: MainScene): boolean {
        const strategy = AIStrategyFactory.createStrategyFromCode(code, vehicle, scene);
        if (!strategy) return false;
        
        vehicle.aiStrategy = strategy;
        console.log(`Новая стратегия "${strategy.name}" назначена ${vehicle.entityType} ${vehicle.id}`);
        return true;
    }
    
    /**
     * Создает стратегию ИИ из промпта с помощью LLM API
     * @param prompt Описание желаемого поведения ИИ
     * @param apiKey Ключ API для LLM сервиса
     * @returns Сгенерированный код стратегии или null в случае ошибки
     */
    public static async generateStrategyFromPrompt(prompt: string, apiKey: string): Promise<string | null> {
        try {
            // Формируем запрос к LLM API
            const systemPrompt = `Ты - эксперт по игровому ИИ для морской боевой игры.
Создай стратегию ИИ для игрового объекта на JavaScript.
Стратегия должна реализовывать следующие методы:
- constructor() - устанавливает name и description
- initialize(owner, scene) - инициализация
- analyzeStep(owner, context) - анализ ситуации
- actionStep(owner, context) - выполнение действий

Доступные методы объекта owner:
- setPower(level) - установка мощности (0-6)
- setRudder(position) - установка руля (-3 до +3)
- addWayPoint(x, y, type) - добавление путевой точки
- clearWayPoints() - очистка путевых точек
- startMoveOnWP() - начало движения по точкам
- isWeaponReady(type) - проверка готовности оружия

Контекст содержит:
- perceivedTargets - карта обнаруженных целей
- scene - игровая сцена
- gameTime - текущее игровое время

Верни только код класса CustomAIStrategy без дополнительных объяснений.`;

            // Здесь должен быть запрос к LLM API
            // Это заглушка, в реальном коде нужно реализовать запрос к API
            console.log("Отправка запроса к LLM API...");
            console.log("Системный промпт:", systemPrompt);
            console.log("Пользовательский промпт:", prompt);
            
            // Заглушка для демонстрации
            return `
class CustomAIStrategy {
    constructor() {
        this.name = "LLM Generated Strategy";
        this.description = "Стратегия, сгенерированная с помощью LLM на основе промпта";
    }
    
    initialize(owner, scene) {
        this.owner = owner;
        this.scene = scene;
    }
    
    analyzeStep(owner, context) {
        // Анализ на основе промпта
        console.log("Анализирую ситуацию...");
    }
    
    actionStep(owner, context) {
        // Действия на основе промпта
        console.log("Выполняю действия...");
        
        // Пример действия из промпта
        owner.setPower(4); // Полный ход
    }
}

return CustomAIStrategy;
            `;
            
        } catch (error) {
            console.error("Ошибка при генерации стратегии:", error);
            return null;
        }
    }
}
