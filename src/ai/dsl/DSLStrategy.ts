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

/**
 * Очищает YAML строку от BOM и других проблемных символов
 */
function cleanYamlString(yamlStr: string): string {
  // Удаляем BOM (Byte Order Mark) если присутствует
  if (yamlStr.charCodeAt(0) === 0xFEFF) {
    yamlStr = yamlStr.slice(1);
  }
  
  // Удаляем все невидимые символы в начале строки (кроме пробелов и переносов)
  yamlStr = yamlStr.replace(/^[\u200B-\u200D\uFEFF\u00A0]+/, '');
  
  // Удаляем ведущие и завершающие пробелы/переносы строк
  yamlStr = yamlStr.trim();
  
  return yamlStr;
}

export class DSLStrategy implements AIStrategy {
  public readonly name: string;
  public readonly description: string;

  private analyzeFunction: (owner: Vehicle, context: DSLContext) => void;
  private actionFunction: (owner: Vehicle, context: DSLContext) => void;
  private dslContext: DSLContext;

  constructor(dslYaml: string, scene: MainScene) {
    // Очищаем YAML от BOM и проблемных символов
    const cleanedYaml = cleanYamlString(dslYaml);
    
    // Логируем входные данные для отладки
    console.log(`[DSLStrategy] Конструктор вызван. Исходная длина: ${dslYaml.length}, очищенная: ${cleanedYaml.length}`);
    console.log(`[DSLStrategy] Первые 200 символов очищенного YAML: "${cleanedYaml.substring(0, 200)}"`);
    
    // Проверяем, что YAML не пустой после очистки
    if (!cleanedYaml || cleanedYaml.length === 0) {
      throw new Error(`DSL YAML is empty after cleaning. Original length: ${dslYaml.length}`);
    }
    
    let dslConfig: any;
    try {
      dslConfig = yaml.load(cleanedYaml) as any;
      console.log(`[DSLStrategy] yaml.load успешно. Результат:`, dslConfig);
    } catch (error: any) {
      console.error(`[DSLStrategy] Ошибка при парсинге YAML:`, error);
      console.error(`[DSLStrategy] Первые 500 символов очищенного YAML:`, cleanedYaml.substring(0, 500));
      throw new Error(`Failed to parse DSL YAML: ${error.message}. YAML length: ${cleanedYaml.length}, first 200 chars: "${cleanedYaml.substring(0, 200)}"`);
    }
    
    if (!dslConfig) {
      console.error(`[DSLStrategy] yaml.load вернул null/undefined. YAML length: ${cleanedYaml.length}`);
      throw new Error(`Failed to load or parse DSL YAML. The file might be empty or malformed. YAML length: ${cleanedYaml.length}`);
    }
    
    this.name = dslConfig.strategy || 'Unnamed DSL Strategy';
    this.description = dslConfig.description || 'A strategy defined by DSL.';

    // Парсим DSL один раз при создании стратегии (используем очищенный YAML)
    const parsedFunctions = parser.parse(cleanedYaml);
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