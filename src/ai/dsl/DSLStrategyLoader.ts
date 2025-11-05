// src/ai/dsl/DSLStrategyLoader.ts
// Менеджер загрузки DSL стратегий из YAML файлов

import { MainScene } from '../../scenes/MainScene';
import { DSLStrategy } from './DSLStrategy';
import { AIStrategy } from '../strategies/AIStrategy';
import { UniversalLogger } from '../../utils/UniversalLogger';

/**
 * Интерфейс метаданных стратегии
 */
export interface DSLStrategyMetadata {
  name: string;
  description: string;
  filename: string;
  yamlContent: string;
}

/**
 * Менеджер загрузки DSL стратегий из файлов
 * Поддерживает загрузку стратегий из YAML файлов с кэшированием
 */
export class DSLStrategyLoader {
  private static instance: DSLStrategyLoader | null = null;
  private strategiesCache: Map<string, DSLStrategyMetadata> = new Map();
  private strategiesDirectory: string = 'ai/dsl/strategies/';
  private loaded: boolean = false;

  private constructor() {
    // Приватный конструктор для singleton
  }

  /**
   * Получить единственный экземпляр загрузчика
   */
  public static getInstance(): DSLStrategyLoader {
    if (!DSLStrategyLoader.instance) {
      DSLStrategyLoader.instance = new DSLStrategyLoader();
    }
    return DSLStrategyLoader.instance;
  }

  /**
   * Загружает стратегию по имени файла (без расширения .yaml)
   * @param strategyName Имя стратегии (соответствует имени файла без .yaml)
   * @returns YAML содержимое стратегии или null при ошибке
   */
  public async loadStrategy(strategyName: string): Promise<string | null> {
    try {
      // Проверяем кэш
      const cached = this.strategiesCache.get(strategyName);
      if (cached) {
        UniversalLogger.debug(`DSL стратегия '${strategyName}' загружена из кэша`, 'DSL_LOADER');
        return cached.yamlContent;
      }

      // Загружаем файл
      const filename = `${strategyName}.yaml`;
      const path = `${this.strategiesDirectory}${filename}`;
      
      UniversalLogger.debug(`Загрузка DSL стратегии из файла: ${path}`, 'DSL_LOADER');
      
      const response = await fetch(path);
      if (!response.ok) {
        UniversalLogger.warn(`Не удалось загрузить стратегию '${strategyName}': ${response.statusText}`, 'DSL_LOADER');
        return null;
      }

      const yamlContent = await response.text();
      
      // Парсим метаданные из YAML
      const metadata = this.parseMetadata(yamlContent, filename);
      if (metadata) {
        this.strategiesCache.set(strategyName, metadata);
        UniversalLogger.info(`DSL стратегия '${strategyName}' успешно загружена`, 'DSL_LOADER');
      }

      return yamlContent;
    } catch (error) {
      UniversalLogger.error(`Ошибка при загрузке стратегии '${strategyName}': ${error}`, 'DSL_LOADER');
      return null;
    }
  }

  /**
   * Загружает стратегию синхронно (если уже в кэше)
   * @param strategyName Имя стратегии
   * @returns YAML содержимое или null
   */
  public getStrategy(strategyName: string): string | null {
    const cached = this.strategiesCache.get(strategyName);
    return cached ? cached.yamlContent : null;
  }

  /**
   * Загружает все стратегии из директории
   * Предполагается, что есть список доступных стратегий
   * @param strategyNames Массив имен стратегий для загрузки
   */
  public async loadAllStrategies(strategyNames: string[]): Promise<void> {
    UniversalLogger.info(`Начало загрузки ${strategyNames.length} DSL стратегий`, 'DSL_LOADER');
    
    const loadPromises = strategyNames.map(name => this.loadStrategy(name));
    await Promise.all(loadPromises);
    
    this.loaded = true;
    UniversalLogger.info(`Загружено ${this.strategiesCache.size} DSL стратегий`, 'DSL_LOADER');
  }

  /**
   * Создает экземпляр DSL стратегии из загруженного YAML
   * @param strategyName Имя стратегии
   * @param scene Игровая сцена
   * @returns Экземпляр стратегии или null
   */
  public createStrategy(strategyName: string, scene: MainScene): AIStrategy | null {
    const yamlContent = this.getStrategy(strategyName);
    if (!yamlContent) {
      UniversalLogger.warn(`Стратегия '${strategyName}' не найдена в кэше. Используйте loadStrategy() сначала.`, 'DSL_LOADER');
      return null;
    }

    try {
      return new DSLStrategy(yamlContent, scene);
    } catch (error) {
      UniversalLogger.error(`Ошибка при создании стратегии '${strategyName}': ${error}`, 'DSL_LOADER');
      return null;
    }
  }

  /**
   * Получает список всех загруженных стратегий
   */
  public getLoadedStrategies(): string[] {
    return Array.from(this.strategiesCache.keys());
  }

  /**
   * Получает метаданные стратегии
   */
  public getStrategyMetadata(strategyName: string): DSLStrategyMetadata | null {
    return this.strategiesCache.get(strategyName) || null;
  }

  /**
   * Проверяет, загружена ли стратегия
   */
  public isStrategyLoaded(strategyName: string): boolean {
    return this.strategiesCache.has(strategyName);
  }

  /**
   * Проверяет, завершена ли загрузка всех стратегий
   */
  public isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Очищает кэш стратегий
   */
  public clearCache(): void {
    this.strategiesCache.clear();
    this.loaded = false;
    UniversalLogger.debug('Кэш DSL стратегий очищен', 'DSL_LOADER');
  }

  /**
   * Парсит метаданные из YAML содержимого
   */
  private parseMetadata(yamlContent: string, filename: string): DSLStrategyMetadata | null {
    try {
      // Простой парсинг для получения name и description
      // Полный парсинг будет выполнен DSLParser при создании стратегии
      const nameMatch = yamlContent.match(/^strategy:\s*["']?([^"'\n]+)["']?/m);
      const descMatch = yamlContent.match(/^description:\s*["']?([^"'\n]+)["']?/m);

      const name = nameMatch ? nameMatch[1].trim() : filename.replace('.yaml', '');
      const description = descMatch ? descMatch[1].trim() : '';

      return {
        name,
        description,
        filename,
        yamlContent
      };
    } catch (error) {
      UniversalLogger.warn(`Ошибка при парсинге метаданных для ${filename}: ${error}`, 'DSL_LOADER');
      return null;
    }
  }

  /**
   * Устанавливает путь к директории со стратегиями
   * По умолчанию: 'ai/dsl/strategies/'
   */
  public setStrategiesDirectory(path: string): void {
    this.strategiesDirectory = path.endsWith('/') ? path : `${path}/`;
    UniversalLogger.debug(`Путь к стратегиям установлен: ${this.strategiesDirectory}`, 'DSL_LOADER');
  }
}

