// DSLParser.ts
// @ts-ignore - js-yaml не имеет типов, но работает корректно
import * as yaml from 'js-yaml';
import Phaser from 'phaser';
import { Vehicle } from '../../objects/Vehicle';
import { Ship } from '../../objects/Ship';
import { AIWorldContext } from '../strategies/AIStrategy';
import { BaseAIStrategy } from '../strategies/BaseAIStrategy';
import { MainScene } from '../../scenes/MainScene';
import { AILogger } from '../../utils/AILogger';
import { Constants } from '../../utils/Constants';
import { CoordUtils } from '../../utils/CoordUtils';
import { DetectionState } from '../../utils/DetectionState';

export interface DSLContext extends AIWorldContext {
  [key: string]: any;
}

// Простой наследник BaseAIStrategy для доступа к protected методам
class DSLHelperStrategy extends BaseAIStrategy {
  public readonly name: string = "DSL Helper";
  public readonly description: string = "Helper strategy for DSL parser";
  
  public analyzeStep(owner: Vehicle, context: AIWorldContext): void {}
  public actionStep(owner: Vehicle, context: AIWorldContext): void {}
  
  // Публичные обертки для protected методов
  public findTarget(vehicle: Vehicle, context: AIWorldContext, filter: any): number | null {
    return this.findTargetByFilter(vehicle, context, filter);
  }
  
  public calculateEscape(fromPos: Phaser.Math.Vector2, threatPos: Phaser.Math.Vector2, escapeDistance: number = 800) {
    return this.calculateEscapeDirection(fromPos, threatPos, escapeDistance);
  }
  
  public calculateApproach(fromPos: Phaser.Math.Vector2, targetPos: Phaser.Math.Vector2, approachDistance: number = 500, angleOffset: number = 0) {
    return this.calculateApproachDirection(fromPos, targetPos, approachDistance, angleOffset);
  }
  
  public setManeuver(vehicle: Vehicle, x: number, y: number, type: number, autoStart: boolean, clearPrevious: boolean) {
    return this.setManeuverWaypoint(vehicle, x, y, type, autoStart, clearPrevious);
  }
  
  public fireTorpedo(ship: Ship, target: Vehicle, weaponType: number, context: AIWorldContext, options: any) {
    return this.fireTorpedoAtTarget(ship, target, weaponType, context, options);
  }
  
  public isInitialized(): boolean {
    return this.owner !== null;
  }
}

// --- ЭТОТ КЛАСС ОСТАЕТСЯ ВНУТРИ ФАЙЛА И НЕ ЭКСПОРТИРУЕТСЯ ---
class DSLParser {
  // Ссылка на экземпляр BaseAIStrategy для вызова общих методов
  private baseStrategy: DSLHelperStrategy;

  private weaponMap: Record<string, number> = {
    'weapon_I': 1, 'weapon_II': 2, 'weapon_III': 3,
  };

  constructor() {
    // Создаем экземпляр наследника для доступа к protected методам
    this.baseStrategy = new DSLHelperStrategy();
  }

  public parse(dslYaml: string): { 
    analyzeFunction: (owner: Vehicle, context: DSLContext) => void;
    actionFunction: (owner: Vehicle, context: DSLContext) => void;
  } {
    const dsl = yaml.load(dslYaml) as any;
    // В YAML лучше использовать массивы для действий, чтобы сохранить порядок
    const analyzeBlock = dsl['ON ANALYZE'] || [];
    const actionBlock = dsl['ON ACTION'];

    // Функция для фазы ANALYZE
    const analyzeFunction = (owner: Vehicle, context: DSLContext) => {
      // Инициализируем baseStrategy для доступа к методам
      if (!this.baseStrategy.isInitialized()) {
        this.baseStrategy.initialize(owner, context.scene);
      }
      
      // --- ФАЗА ANALYZE ---
      for (const instruction of analyzeBlock) {
        if (instruction.FIND) {
          const targetVar = Object.keys(instruction.FIND)[0];
          const params = instruction.FIND[targetVar];
          // ВЫЗОВ РЕАЛЬНОЙ ФУНКЦИИ:
          const targetId = this.baseStrategy.findTarget(owner, context, {
            requireDetectionLevel: params.detection_zone !== undefined ? (params.detection_zone as number) : DetectionState.ZONE_1_UNCERTAIN,
            requireType: params.type || 'any',
            maxDistance: params.range,
            maxSpeedFilter: params.speed !== undefined ? params.speed : undefined,
          });
          
          // Сохраняем информацию о цели
          if (targetId !== null) {
            const targetVehicle = this.getVehicleById(context.scene, targetId);
            if (targetVehicle) {
              const targetInfo = owner.perceivedTargets.get(targetId);
              context[targetVar] = {
                id: targetId,
                vehicle: targetVehicle,
                position: targetVehicle.getPosition(),
                detectionState: targetInfo?.detectionState || DetectionState.NO_CONTACT,
              };
            } else {
              context[targetVar] = null;
            }
          } else {
            context[targetVar] = null;
          }
        } else if (instruction.SET) {
          const varName = Object.keys(instruction.SET)[0];
          context[varName] = instruction.SET[varName];
        }
      }
    };

    // Функция для фазы ACTION
    const actionFunction = (owner: Vehicle, context: DSLContext) => {
      // Инициализируем baseStrategy для доступа к методам
      if (!this.baseStrategy.isInitialized()) {
        this.baseStrategy.initialize(owner, context.scene);
      }
      
      // --- ФАЗА ACTION ---
      this.executeIfBlock(actionBlock, owner, context);
    };

    return { analyzeFunction, actionFunction };
  }

  private executeIfBlock(block: any, owner: Vehicle, context: DSLContext): void {
    if (block.IF) {
      const condition = this.evalCondition(block.IF.condition, context, owner);
      if (condition) {
        this.executeActions(block.IF.actions, owner, context);
        return;
      }
    }
    if (block['ELSE IF']) {
      this.executeIfBlock(block['ELSE IF'], owner, context);
    } else if (block.ELSE) {
      this.executeActions(block.ELSE.actions, owner, context);
    }
  }

  // Выполняет одно или несколько действий
  private executeActions(actions: any, owner: Vehicle, context: DSLContext): void {
    if (!actions) return;
    const actionList = Array.isArray(actions) ? actions : [actions];

    for (const action of actionList) {
        if (action.Action) {
            this.execSingleAction(action.Action, owner, context);
        } else if (action.Log) {
            this.logMessage(action.Log, context, owner);
        } else if (action.SET) {
            const varName = Object.keys(action.SET)[0];
            context[varName] = action.SET[varName];
        }
    }
  }

  private execSingleAction(action: any, owner: Vehicle, context: DSLContext): void {
    const actionType = Object.keys(action)[0];
    const params = action[actionType];

    switch (actionType) {
      case 'EVADE':
        const threatVar = params.FROM || params.from;
        const threat = context[threatVar];
        if (threat && threat.vehicle) {
          const threatPos = threat.position || threat.vehicle.getPosition();
          const escapePoint = this.baseStrategy.calculateEscape(owner.getPosition(), threatPos, params.distance || 800);
          const escapeLogicalPos = CoordUtils.phaserToLogical(escapePoint.point);
          this.baseStrategy.setManeuver(
            owner,
            escapeLogicalPos.x,
            escapeLogicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
          );
          owner.setPower(params.power || 6);
        }
        break;
      case 'ATTACK':
        const targetVar = params.WITH || params.with || 'best_target';
        const target = context[targetVar];
        if (target && target.vehicle && owner instanceof Ship) {
          const weaponType = this.mapWeaponNameToType(params.torpedo || 'weapon_I');
          this.baseStrategy.fireTorpedo(
            owner,
            target.vehicle,
            weaponType,
            context,
            { predictLeadTime: params.predict_lead_time || 10 }
          );
        }
        break;
      case 'CHASE':
        const chaseTargetVar = params.TARGET || params.target || 'best_target';
        const chaseTarget = context[chaseTargetVar];
        if (chaseTarget && chaseTarget.vehicle) {
          const targetPos = chaseTarget.position || chaseTarget.vehicle.getPosition();
          const ownerPos = owner.getPosition();
          const approachDistance = params.distance || 500;
          const angleOffset = params.angle_offset || 0; // 0 = прямо к цели
          
          const approachInfo = this.baseStrategy.calculateApproach(ownerPos, targetPos, approachDistance, angleOffset);
          const approachLogicalPos = CoordUtils.phaserToLogical(approachInfo.point);
          
          this.baseStrategy.setManeuver(
            owner,
            approachLogicalPos.x,
            approachLogicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
          );
          
          owner.setPower(params.power || 4);
          
          // Для подводных лодок можно установить глубину
          if (params.depth !== undefined && 'setDepth' in owner) {
            (owner as any).setDepth(params.depth);
          }
        }
        break;
      case 'PATROL':
        // Простая логика патрулирования - добавляем точку патрулирования
        if (params.route) {
          // TODO: Реализовать маршруты патрулирования
          console.warn('PATROL route not implemented yet');
        }
        owner.setPower(params.power || 3);
        break;
      case 'DIVE':
        if ('setDepth' in owner) { // Проверяем, что это подлодка
            (owner as any).setDepth(params.to_depth);
        }
        break;
      case 'HOLD_POSITION':
        owner.stopMoveOnWayPoint();
        owner.setPower(0);
        break;
      default:
        console.warn(`Unknown Action: ${actionType}`);
    }
  }

  private logMessage(logStr: string, context: DSLContext, owner: Vehicle): void {
    const msg = logStr.replace(/{([^}]+)}/g, (match: string, varName: string) => {
        // Попробуем достать вложенные свойства, например, closest_torpedo.id
        const parts = varName.split('.');
        let value = context;
        for (const part of parts) {
            value = value ? value[part] : undefined;
        }
        return value?.toString() || '?';
    });
    AILogger.log(owner, context.strategyName || 'DSLStrategy', 'Decision', msg);
  }

  // Основной метод оценки условий
  public evalCondition(condStr: string, context: DSLContext, owner: Vehicle): boolean {
    const orParts = condStr.split(' OR ');
    for (const orPart of orParts) {
      const andParts = orPart.split(' AND ');
      let isAndBlockTrue = true;
      for (const andPart of andParts) {
        if (!this.evalSingleCondition(andPart.trim(), context, owner)) {
          isAndBlockTrue = false;
          break;
        }
      }
      if (isAndBlockTrue) {
        return true;
      }
    }
    return false;
  }

  private evalSingleCondition(part: string, context: DSLContext, owner: Vehicle): boolean {
    // 1. IS_PRESENT / IS_NOT_PRESENT
    if (part.endsWith(' IS_PRESENT')) {
      const varName = part.split(' ')[0];
      return !!context[varName];
    }
    if (part.endsWith(' IS_NOT_PRESENT')) {
      const varName = part.split(' ')[0];
      return !context[varName];
    }
   
    // 2. IS_READY
    if (part.endsWith(' IS_READY')) {
      const weaponName = part.split(' ')[0];
      const weaponType = this.mapWeaponNameToType(weaponName);
      // isWeaponReady доступен только у Ship
      if (owner instanceof Ship) {
        return owner.isWeaponReady(weaponType);
      }
      return false;
    }
   
    // 3. Сравнения
    const comparisonRegex = /([\w\(\)]+)\s*([<>=!]+)\s*(\w+)/;
    const match = part.match(comparisonRegex);
    if (match) {
      const [, leftExpr, operator, rightValStr] = match;
      const leftVal = this.evaluateExpression(leftExpr, context, owner);
      const rightVal = parseFloat(rightValStr);
     
      switch (operator) {
        case '<': return leftVal < rightVal;
        case '>': return leftVal > rightVal;
        case '<=': return leftVal <= rightVal;
        case '>=': return leftVal >= rightVal;
        case '==': return leftVal == rightVal;
        case '!=': return leftVal != rightVal;
        default: return false;
      }
    }
    return false;
  }

  // Маппинг оружия
  private mapWeaponNameToType(weaponName: string): number {
    return this.weaponMap[weaponName] || 0;
  }

  private evaluateExpression(expr: string, context: DSLContext, owner: Vehicle): number {
    if (expr.startsWith('distance_to(')) {
      const targetVar = expr.substring(11, expr.length - 1);  // Убираем 'distance_to(' и ')'
      return this._distanceTo(targetVar, owner, context);
    }
    // Расширение: context[expr] или registry
    return context[expr as any] || 0;
  }

  private _distanceTo(targetVar: string, owner: Vehicle, context: DSLContext): number {
    const target = context[targetVar];
    if (!target) return Infinity;
    
    // Если target это объект с vehicle или position
    let targetPos: Phaser.Math.Vector2;
    if (target.vehicle) {
      targetPos = target.vehicle.getPosition();
    } else if (target.position) {
      targetPos = target.position;
    } else if (typeof target === 'number') {
      // Если это ID, получаем Vehicle
      const targetVehicle = this.getVehicleById(context.scene, target);
      if (!targetVehicle) return Infinity;
      targetPos = targetVehicle.getPosition();
    } else {
      return Infinity;
    }
    
    return Phaser.Math.Distance.BetweenPoints(owner.getPosition(), targetPos);
  }

  // Вспомогательный метод для получения Vehicle по ID
  private getVehicleById(scene: MainScene, id: number): Vehicle | null {
    // Ищем Vehicle среди всех объектов сцены
    const children = scene.children.list as Vehicle[];
    return children.find(v => v instanceof Vehicle && v.id === id) || null;
  }
}

export { DSLParser };