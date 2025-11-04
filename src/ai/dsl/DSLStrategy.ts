// src/ai/dsl/DSLStrategy.ts
// @ts-ignore - js-yaml не имеет типов, но работает корректно
import * as yaml from 'js-yaml';
import { Vehicle } from '../../objects/Vehicle';
import { AIStrategy, AIWorldContext } from '../strategies/AIStrategy';
import { DSLParser, DSLContext } from './DSLParser';
import { MainScene } from '../../scenes/MainScene';
import { AILogger } from '../../utils/AILogger';
import { LogLevel } from '../../utils/UniversalLogger';

// Создание DSLStrategy.ts (Класс-обертка)
// Этот класс будет "мостом" между движком игры и парсером.

// Единственный экземпляр парсера, чтобы не создавать его каждый раз
const parser = new DSLParser();

export class DSLStrategy implements AIStrategy {
  public readonly name: string;
  public readonly description: string;

  private analyzeFunction: (owner: Vehicle, context: DSLContext) => void;
  private actionFunction: (owner: Vehicle, context: DSLContext) => void;
  private dslContext: DSLContext;

  constructor(dslYaml: string, scene: MainScene) {
    const dslConfig = yaml.load(dslYaml) as any;
    this.name = dslConfig.strategy || 'Unnamed DSL Strategy';
    this.description = dslConfig.description || 'A strategy defined by DSL.';

    // Парсим DSL один раз при создании стратегии
    const parsedFunctions = parser.parse(dslYaml);
    this.analyzeFunction = parsedFunctions.analyzeFunction;
    this.actionFunction = parsedFunctions.actionFunction;
    
    // Инициализируем контекст
    this.dslContext = {
        scene: scene,
        gameTime: 0,
        perceivedTargets: new Map(),
        strategyName: this.name, // Добавляем имя для логов
    };
  }

  public initialize(owner: Vehicle, scene: MainScene): void {
    // Обновляем контекст с правильной сценой и владельцем
    this.dslContext.scene = scene;
    // Можно добавить логику инициализации из DSL, если потребуется
  }

  // analyzeStep и actionStep теперь правильно разделены
  public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
    AILogger.log(owner, this.name, "DSL Analyze", "Start", LogLevel.DEBUG, { targetCount: owner.perceivedTargets.size });
    this.updateContext(owner, context);
    // Выполняем блок ANALYZE из DSL
    this.analyzeFunction(owner, this.dslContext);
    AILogger.log(owner, this.name, "DSL Analyze", "End", LogLevel.DEBUG, { best_target: this.dslContext['best_target'] ? this.dslContext['best_target'].id : 'null' });
  }

  public actionStep(owner: Vehicle, context: AIWorldContext): void {
    AILogger.log(owner, this.name, "DSL Action", "Start", LogLevel.DEBUG, { best_target: this.dslContext['best_target'] ? this.dslContext['best_target'].id : 'null' });
    this.updateContext(owner, context);
    // Выполняем блок ACTION из DSL
    this.actionFunction(owner, this.dslContext);
    AILogger.log(owner, this.name, "DSL Action", "End", LogLevel.DEBUG);
  }

  private updateContext(owner: Vehicle, context: AIWorldContext): void {
    this.dslContext.perceivedTargets = context.perceivedTargets;
    this.dslContext.gameTime = context.gameTime;
    // Копируем переменные из предыдущего шага, чтобы сохранить состояние (например, cooldown)
    Object.assign(this.dslContext, context);
  }
}