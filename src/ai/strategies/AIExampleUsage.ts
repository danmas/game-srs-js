import { Ship } from '../../objects/Ship';
import { Torpedo } from '../../objects/Torpedo';
import { MainScene } from '../../scenes/MainScene';
import { AICodeGenerator } from './AICodeGenerator';
import { AIStrategyFactory } from './AIStrategyFactory';

/**
 * Примеры использования системы ИИ
 */
export class AIExampleUsage {
    /**
     * Демонстрирует назначение стандартных стратегий
     * @param scene Игровая сцена
     */
    public static assignStandardStrategies(scene: MainScene): void {
        // Получаем все корабли
        const redShips = scene.getRedShips();
        const whiteShips = scene.getWhiteShips();
        
        // Назначаем агрессивную стратегию первому красному кораблю
        if (redShips.length > 0) {
            AIStrategyFactory.assignStrategy('aggressive_ship', redShips[0], scene);
            console.log(`Агрессивная стратегия назначена кораблю ${redShips[0].id}`);
        }
        
        // Назначаем стандартную стратегию остальным красным кораблям
        for (let i = 1; i < redShips.length; i++) {
            AIStrategyFactory.assignStrategy('default_ship', redShips[i], scene);
            console.log(`Стандартная стратегия назначена кораблю ${redShips[i].id}`);
        }
    }
    
    /**
     * Демонстрирует создание и назначение пользовательской стратегии из кода
     * @param scene Игровая сцена
     */
    public static createCustomStrategy(scene: MainScene): void {
        const whiteShips = scene.getWhiteShips();
        if (whiteShips.length === 0) return;
        
        // Создаем пользовательскую стратегию
        const customCode = `
class PatrolStrategy {
    constructor() {
        this.name = "Патрульный ИИ";
        this.description = "Патрулирует заданный маршрут и атакует цели на дистанции";
        this.patrolPoints = [
            { x: 500, y: 500 },
            { x: -500, y: 500 },
            { x: -500, y: -500 },
            { x: 500, y: -500 }
        ];
        this.currentPatrolIndex = 0;
    }
    
    initialize(owner, scene) {
        this.owner = owner;
        this.scene = scene;
        
        // Устанавливаем начальную точку патрулирования
        owner.clearWayPoints();
        const point = this.patrolPoints[this.currentPatrolIndex];
        owner.addWayPoint(point.x, point.y);
        owner.startMoveOnWP();
    }
    
    analyzeStep(owner, context) {
        // Проверяем, достигли ли мы текущей точки патрулирования
        if (owner.wayPoints.length === 0) {
            // Переходим к следующей точке
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            const point = this.patrolPoints[this.currentPatrolIndex];
            owner.addWayPoint(point.x, point.y);
            owner.startMoveOnWP();
        }
    }
    
    actionStep(owner, context) {
        // Ищем цель для атаки
        let targetToAttack = null;
        let minDistance = Infinity;
        
        for (const [id, targetInfo] of owner.perceivedTargets.entries()) {
            if (targetInfo.detectionState >= 1 && // Зона 2 или выше
                targetInfo.targetVehicle.active &&
                targetInfo.targetVehicle.getForces() !== owner.getForces()) {
                
                const distance = Phaser.Math.Distance.Between(
                    owner.x, owner.y,
                    targetInfo.targetVehicle.x, targetInfo.targetVehicle.y
                );
                
                if (distance < minDistance && distance < 800) {
                    minDistance = distance;
                    targetToAttack = targetInfo.targetVehicle;
                }
            }
        }
        
        // Атакуем, если нашли цель
        if (targetToAttack && owner.isWeaponReady(1)) { // 1 = торпеда типа I
            const targetPos = targetToAttack.getPosition();
            context.scene.fireTorpedo(owner, 1, targetPos.x, targetPos.y);
        }
        
        // Устанавливаем среднюю скорость для патрулирования
        if (owner.power !== 3) {
            owner.setPower(3);
        }
    }
}

return PatrolStrategy;
        `;
        
        // Назначаем стратегию первому белому кораблю
        AICodeGenerator.createAndAssignStrategy(customCode, whiteShips[0], scene);
    }
    
    /**
     * Демонстрирует клонирование стратегии от одного корабля к другому
     * @param scene Игровая сцена
     */
    public static cloneStrategy(scene: MainScene, sourceShipId: number, targetShipId: number): boolean {
        // Находим корабли по ID
        const allShips = [...scene.getRedShips(), ...scene.getWhiteShips()];
        const sourceShip = allShips.find(ship => ship.id === sourceShipId);
        const targetShip = allShips.find(ship => ship.id === targetShipId);
        
        if (!sourceShip || !targetShip || !sourceShip.aiStrategy) {
            console.error("Не удалось найти корабли или у исходного корабля нет стратегии");
            return false;
        }
        
        // Получаем имя стратегии исходного корабля
        const strategyName = sourceShip.aiStrategy.name;
        console.log(`Клонирование стратегии "${strategyName}" с корабля ${sourceShipId} на корабль ${targetShipId}`);
        
        // Для стандартных стратегий используем фабрику
        for (const id of AIStrategyFactory.getAvailableStrategies()) {
            const strategy = AIStrategyFactory.createStrategy(id);
            if (strategy && strategy.name === strategyName) {
                strategy.initialize(targetShip, scene);
                targetShip.aiStrategy = strategy;
                return true;
            }
        }
        
        // Для пользовательских стратегий нужно сохранять их код
        // В реальной реализации здесь нужно хранить код всех созданных стратегий
        console.error("Клонирование пользовательских стратегий пока не реализовано");
        return false;
    }
    
    /**
     * Демонстрирует генерацию стратегии с помощью LLM
     * @param scene Игровая сцена
     * @param prompt Описание желаемого поведения
     */
    public static async generateStrategyFromPrompt(scene: MainScene, prompt: string, targetShipId: number): Promise<boolean> {
        // Находим корабль по ID
        const allShips = [...scene.getRedShips(), ...scene.getWhiteShips()];
        const targetShip = allShips.find(ship => ship.id === targetShipId);
        
        if (!targetShip) {
            console.error(`Корабль с ID ${targetShipId} не найден`);
            return false;
        }
        
        // Генерируем стратегию с помощью LLM
        const apiKey = "YOUR_API_KEY"; // В реальном коде нужно получать из конфигурации
        const generatedCode = await AICodeGenerator.generateStrategyFromPrompt(prompt, apiKey);
        
        if (!generatedCode) {
            console.error("Не удалось сгенерировать стратегию");
            return false;
        }
        
        // Назначаем сгенерированную стратегию кораблю
        return AICodeGenerator.createAndAssignStrategy(generatedCode, targetShip, scene);
    }
}
