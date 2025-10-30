import { Ship } from '../../objects/Ship';
import { Submarine } from '../../objects/Submarine';
import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { DetectionState } from '../../utils/DetectionState';
import { BaseAIStrategy } from './BaseAIStrategy';
import { AIWorldContext } from './AIStrategy';
import { CoordUtils } from '../../utils/CoordUtils';
import { AILogger } from '../../utils/AILogger';
import { LogLevel } from '../../utils/UniversalLogger';
import * as Phaser from 'phaser';

/**
 * Стратегия "Тихий Охотник" для подводной лодки.
 * Охота на одиночный торговый корабль: stealth-подход с минимальным шумом,
 * разведка перископом, точная атака торпедами (Type I или III), быстрый отход.
 * Фазы: Разведка → Погоня → Подход → Атака → Отход.
 */
export class SilentHunterStrategy extends BaseAIStrategy {
    public readonly name: string = "Тихий Охотник";
    public readonly description: string = "Охота подводной лодки на торговый корабль: разведка, погоня, stealth-подход, атака торпедами, отход с погружением.";

    private targetId: number | null = null;
    private currentPhase: 'RECON' | 'CHASE' | 'APPROACH' | 'ENGAGE' | 'DISENGAGE' = 'RECON';
    private patrolWaypoints: Phaser.Math.Vector2[] = [];
    private lastPeriscopeCheck: number = 0;
    private readonly periscopeInterval: number = 30000; // Проверка перископом каждые 30 сек
    private readonly stealthPower: number = Vehicle.POWER_1; // Минимальная мощность для stealth
    private readonly chasePower: number = Vehicle.POWER_4; // Повышенная мощность для погони
    private readonly approachPower: number = Vehicle.POWER_2; // Для подхода
    private readonly evasionDepth: number = 200; // Макс. глубина для отхода
    private readonly chaseDepth: number = 150; // Средняя глубина для погони
    private lastKnownTargetPos: Phaser.Math.Vector2 | null = null;

    protected onInitialize(): void {
        // Инициализация патрульных точек: квадрат 1000x1000 вокруг стартовой позиции
        if (this.owner && this.scene) {
            const startPos = new Phaser.Math.Vector2(this.owner.x, this.owner.y);
            this.patrolWaypoints = [
                startPos.clone().add(new Phaser.Math.Vector2(-500, -500)),
                startPos.clone().add(new Phaser.Math.Vector2(500, -500)),
                startPos.clone().add(new Phaser.Math.Vector2(500, 500)),
                startPos.clone().add(new Phaser.Math.Vector2(-500, 500))
            ];
            this.logDecision("Patrol Initialized", `4 waypoints set around ${startPos.x.toFixed(0)}, ${startPos.y.toFixed(0)}`);
        }
        // Начать на глубине 100м для снижения шума
        if (this.owner instanceof Submarine) {
            this.owner.setSubmDepth(100);
        }
    }

    /**
     * Фаза анализа: поиск цели, оценка дистанции, определение фазы
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        if (!owner.active || !(owner instanceof Submarine)) return;

        const sub = owner as Submarine;
        this.logDecision("Analyze Step", `Phase: ${this.currentPhase}, Targets: ${sub.perceivedTargets.size}`);

        // Периодическое логирование статуса ИИ (общая функция)
        this.logPeriodicStatus(sub, context, {
            currentPhase: this.currentPhase,
            currentTarget: this.targetId
        });

        // Поиск торговой цели (предпочтительно Ship с низкой скоростью)
        this.findTarget(sub, context);

        const currentTime = context.gameTime;

        if (this.targetId !== null) {
            const targetInfo = sub.perceivedTargets.get(this.targetId);
            if (targetInfo && targetInfo.targetVehicle.active) {
                const distance = Phaser.Math.Distance.Between(sub.x, sub.y, targetInfo.targetVehicle.x, targetInfo.targetVehicle.y);
                this.lastKnownTargetPos = new Phaser.Math.Vector2(targetInfo.targetVehicle.x, targetInfo.targetVehicle.y);

                // Определение фазы по дистанции и детекции
                if (distance > 2000 || targetInfo.detectionState < DetectionState.ZONE_1_UNCERTAIN) {
                    // Слишком далеко или слабое обнаружение - патруль
                    this.currentPhase = 'RECON';
                } else if (distance > 1500) {
                    // Дистанция 1500-2000м - активная погоня за целью
                    this.currentPhase = 'CHASE';
                } else if (distance > 800) {
                    // Дистанция 800-1500м - stealth подход под углом
                    this.currentPhase = 'APPROACH';
                } else if (distance <= 800 && targetInfo.detectionState >= DetectionState.ZONE_2_LOCALIZED) {
                    // Близко и локализовано - атака
                    this.currentPhase = 'ENGAGE';
                } else if (this.currentPhase === 'ENGAGE') {
                    // После атаки - отход
                    this.currentPhase = 'DISENGAGE';
                }
            } else {
                this.targetId = null;
                this.currentPhase = 'RECON';
            }
        } else {
            this.currentPhase = 'RECON';
        }

        // Проверка перископа для разведки (если не в ENGAGE/DISENGAGE)
        if (this.currentPhase === 'RECON' || this.currentPhase === 'CHASE' || this.currentPhase === 'APPROACH') {
            if (currentTime - this.lastPeriscopeCheck > this.periscopeInterval) {
                this.lastPeriscopeCheck = currentTime;
                sub.raisePeriscope(); // Поднять на 10-20 сек (логика в Submarine)
                this.logDecision("Periscope Check", "Raised periscope for visual scan.");
            }
        }
    }

    /**
     * Фаза действия: выполнение по текущей фазе
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        if (!owner.active || !(owner instanceof Submarine) || !this.scene) return;

        const sub = owner as Submarine;
        this.logDecision("Action Step", `Executing phase: ${this.currentPhase}`);

        switch (this.currentPhase) {
            case 'RECON':
                this.performRecon(sub, context);
                break;
            case 'CHASE':
                this.performChase(sub, context);
                break;
            case 'APPROACH':
                this.stealthApproach(sub, context);
                break;
            case 'ENGAGE':
                this.engageTarget(sub, context);
                break;
            case 'DISENGAGE':
                this.disengage(sub, context);
                break;
        }

        // Общее: управление waypoints, если нужно
        if (sub.getWayPoints().length > 0 && !sub.getIsMovingOnWayPoint()) {
            sub.startMoveOnWP();
        }
    }

    /**
     * Поиск торговой цели (Ship с низкой скоростью, не боевой)
     * Использует общую функцию findTargetByFilter
     */
    private findTarget(sub: Submarine, context: AIWorldContext): void {
        const oldTargetId = this.targetId;
        
        // Используем общую функцию для поиска торговых кораблей (медленные)
        this.targetId = this.findTargetByFilter(sub, context, {
            requireType: 'Ship',
            maxSpeedFilter: 105, // ФАКТИЧЕСКИ ВЫКЛЮЧАЕМ Низкая скорость = торговый корабль
            requireDetectionLevel: DetectionState.ZONE_1_UNCERTAIN,
            excludeAllies: false  // Если цель в конвое, включи
        });

        // Логируем только при изменении цели
        if (this.targetId !== oldTargetId && this.targetId !== null) {
            const targetInfo = sub.perceivedTargets.get(this.targetId);
            if (targetInfo) {
                const distance = Phaser.Math.Distance.Between(
                    sub.x, sub.y,
                    targetInfo.targetVehicle.x, targetInfo.targetVehicle.y
                );
                AILogger.log(
                    sub,
                    this.name,
                    "Target Acquired",
                    `Merchant ship ID ${this.targetId} at ${distance.toFixed(0)}m, Zone ${targetInfo.detectionState}`,
                    LogLevel.INFO,
                    { targetId: this.targetId, distance, detectionState: targetInfo.detectionState }
                );
            }
        }
    }

    /**
     * Фаза 1: Разведка - патрулирование по waypoints
     * Использует общую функцию setManeuverWaypoint
     */
    private performRecon(sub: Submarine, context: AIWorldContext): void {
        // Выбираем случайную патрульную точку
        const nextWP = this.patrolWaypoints[Math.floor(Math.random() * this.patrolWaypoints.length)];
        
        // Устанавливаем waypoint через общую функцию
        this.setManeuverWaypoint(
            sub,
            nextWP.x,
            nextWP.y,
            Constants.WP_TYPE_SEARCH,
            true,
            true
        );

        // Stealth: низкая мощность, средняя глубина
        sub.setPower(this.stealthPower);
        sub.setSubmDepth(100);

        this.logDecision("Recon Patrol", `Moving to WP ${nextWP.x.toFixed(0)}, ${nextWP.y.toFixed(0)} at low power.`);
    }

    /**
     * Фаза 2: Погоня - активное сближение с целью
     * Использует общую функцию calculateApproachDirection для прямого движения к цели
     */
    private performChase(sub: Submarine, context: AIWorldContext): void {
        if (this.targetId === null || !this.lastKnownTargetPos) return;

        const subPos = new Phaser.Math.Vector2(sub.x, sub.y);
        
        // Вычисляем направление приближения ПРЯМО к цели (angleOffset = 0)
        const chaseInfo = this.calculateApproachDirection(
            subPos,
            this.lastKnownTargetPos,
            700, // Приближаемся на 700м к цели
            0 // 0° = прямо, без зигзага
        );
        
        // Конвертируем в логические координаты и устанавливаем waypoint
        const logicalPos = CoordUtils.phaserToLogical(chaseInfo.point);
        this.setManeuverWaypoint(
            sub,
            logicalPos.x,
            logicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
        );

        // Погоня: повышенная мощность, средняя глубина (быстрее и менее заметно чем на поверхности)
        sub.setPower(this.chasePower);
        sub.setSubmDepth(this.chaseDepth);

        const distance = Phaser.Math.Distance.Between(subPos.x, subPos.y, this.lastKnownTargetPos.x, this.lastKnownTargetPos.y);
        this.logDecision("Chase Target", `Pursuing target at ${distance.toFixed(0)}m, power ${this.chasePower}, depth ${this.chaseDepth}m.`);
        
        AILogger.log(
            sub,
            this.name,
            "Active Chase",
            `Closing distance to merchant target: ${distance.toFixed(0)}m remaining`,
            LogLevel.INFO,
            {
                ...context,
                targetId: this.targetId,
                distance: distance,
                power: this.chasePower,
                depth: this.chaseDepth,
                targetPosition: { x: this.lastKnownTargetPos.x, y: this.lastKnownTargetPos.y }
            }
        );
    }

    /**
     * Фаза 3: Скрытный подход - stealth сближение под углом 90°
     * Использует общую функцию calculateApproachDirection
     */
    private stealthApproach(sub: Submarine, context: AIWorldContext): void {
        if (this.targetId === null || !this.lastKnownTargetPos) return;

        const subPos = new Phaser.Math.Vector2(sub.x, sub.y);
        
        // Вычисляем направление приближения под углом 90° (stealth)
        const approachInfo = this.calculateApproachDirection(
            subPos,
            this.lastKnownTargetPos,
            500,
            Math.PI / 2 // 90° для скрытности
        );
        
        // Конвертируем в логические координаты и устанавливаем waypoint
        const logicalPos = CoordUtils.phaserToLogical(approachInfo.point);
        this.setManeuverWaypoint(
            sub,
            logicalPos.x,
            logicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
        );

        // Stealth: минимальная мощность, max глубина
        sub.setPower(this.stealthPower);
        sub.setSubmDepth(200);
        sub.lowerPeriscope(); // Опущен для тишины

        this.logDecision("Stealth Approach", `Maneuvering to intercept at 90° angle, depth 200m.`);
    }

    /**
     * Фаза 4: Атака - прицеливание и выстрел
     * Использует общую функцию fireTorpedoAtTarget с предсказанием движения цели
     */
    private engageTarget(sub: Submarine, context: AIWorldContext): void {
        if (this.targetId === null) return;

        const targetInfo = sub.perceivedTargets.get(this.targetId);
        if (!targetInfo || !(targetInfo.targetVehicle instanceof Ship)) return;

        const target = targetInfo.targetVehicle as Ship;
        const distance = Phaser.Math.Distance.Between(sub.x, sub.y, target.x, target.y);
        
        // Выбор типа торпеды: Type I для близких, Type III для дальних
        const weaponType = distance < 500 ? Constants.WEAPON_SELECT_TORP_I : Constants.WEAPON_SELECT_TORP_III;
        
        // Попытка выстрела через общую функцию с упреждением
        const torpedo = this.fireTorpedoAtTarget(
            sub,
            target,
            weaponType,
            context,
            {
                predictLeadTime: 20, // Предсказание на 20 секунд вперёд
                requireDistance: weaponType === Constants.WEAPON_SELECT_TORP_I ? 
                    Settings.TRP_I_DIST_EXECUTION : 3000, // Type III дальнобойные
                requireAngle: 30, // Подлодка может стрелять под большим углом
                logAttempt: false // Не логируем каждую попытку
            }
        );

        if (torpedo) {
            // Выстрел успешен - переходим в отход
            this.currentPhase = 'DISENGAGE';
        } else {
            // Не смогли выстрелить - корректируем позицию
            const targetPos = new Phaser.Math.Vector2(target.x, target.y);
            const angleInfo = this.calculateAngleToTarget(sub, targetPos);
            
            // Корректировка руля для лучшего угла
            sub.setRudder(angleInfo.diff > 0 ? 1 : -1);
            this.logDecision("Adjust Angle", `Weapon reloading, rudder ${angleInfo.diff > 0 ? '+' : '-'} for better shot.`);
        }

        // Поднять перископ для корректировки
        sub.raisePeriscope();
    }

    /**
     * Фаза 5: Отход - погружение и зигзаг
     * Использует общую функцию calculateApproachDirection для зигзага
     */
    private disengage(sub: Submarine, context: AIWorldContext): void {
        // Резкий отход: max мощность, максимальная глубина
        sub.setPower(Vehicle.POWER_4);
        sub.setSubmDepth(this.evasionDepth);

        const subPos = new Phaser.Math.Vector2(sub.x, sub.y);
        const targetPos = this.lastKnownTargetPos || new Phaser.Math.Vector2(sub.x, sub.y);
        
        // Зигзаг: отход под углом 90° от последней известной позиции цели
        const evasionInfo = this.calculateApproachDirection(
            subPos,
            targetPos,
            1000,
            Math.PI / 2 // 90° зигзаг
        );
        
        // Конвертируем в логические координаты и устанавливаем waypoint
        const logicalPos = CoordUtils.phaserToLogical(evasionInfo.point);
        this.setManeuverWaypoint(
            sub,
            logicalPos.x,
            logicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
        );

        this.logDecision("Disengage", `Zigzag evasion at depth ${this.evasionDepth}m, power 4.`);

        // Через 10 сек (в analyze) сбросить в RECON
    }
}