import { Vehicle } from '../../objects/Vehicle';
import { PerceivedTargetInfo } from '../../interfaces/PerceivedTargetInfo';
import { MainScene } from '../../scenes/MainScene';

/**
 * Контекст мира, который видит ИИ.
 * Содержит всю информацию, доступную для принятия решений.
 */
export interface AIWorldContext {
    /** Объекты, обнаруженные сенсорами */
    perceivedTargets: Map<number, PerceivedTargetInfo>;
    
    /** Ссылка на основную сцену для доступа к игровому миру */
    scene: MainScene;
    
    /** Текущее игровое время */
    gameTime: number;
}

/**
 * Интерфейс для любой стратегии ИИ.
 * Представляет собой "мозг" для игрового объекта.
 */
export interface AIStrategy {
    /**
     * Уникальное имя стратегии, например "Агрессивный охотник v1"
     */
    readonly name: string;
    
    /**
     * Описание стратегии и ее поведения
     */
    readonly description: string;
    
    /**
     * Фаза анализа - сбор информации и оценка ситуации
     * @param owner - объект, которым управляет этот ИИ
     * @param context - вся информация о мире, доступная ИИ
     */
    analyzeStep(owner: Vehicle, context: AIWorldContext): void;
    
    /**
     * Фаза действия - принятие решений и выполнение действий
     * @param owner - объект, которым управляет этот ИИ
     * @param context - вся информация о мире, доступная ИИ
     */
    actionStep(owner: Vehicle, context: AIWorldContext): void;
    
    /**
     * Инициализация стратегии при назначении объекту
     * @param owner - объект, которому назначается стратегия
     * @param scene - игровая сцена
     */
    initialize(owner: Vehicle, scene: MainScene): void;
}
