import { MainScene } from '../scenes/MainScene';
import { Scenario } from './Scenario';
import { Scenario1 } from './Scenario1';
import { Scenario_2 } from './Scenario_2_P_Kashin';
import { Scenario_test_1 } from './Scenario_test_1';

/**
 * Класс для управления сценариями игры
 */
export class ScenarioManager {
  private scene: MainScene;
  private currentScenario: Scenario | null = null;
  
  /**
   * Конструктор
   * @param scene Ссылка на основную сцену игры
   */
  constructor(scene: MainScene) {
    this.scene = scene;
  }
  
  /**
   * Очищает текущий сценарий и все его ресурсы
   */
  public clearScenario(): void {
    if (this.currentScenario) {
      this.currentScenario.clean();
      this.currentScenario = null;
    }
  }
  
  /**
   * Загружает сценарий по его имени
   * @param scenarioName Имя сценария для загрузки
   */
  public loadScenario(scenarioName: string): Scenario | null {
    // Очищаем текущий сценарий, если он есть
    this.clearScenario();
    
    console.log(`Попытка загрузить сценарий: ${scenarioName}`);
    
    // Создаем новый сценарий в зависимости от имени
    switch (scenarioName.toLowerCase()) {
      case 'scenario1':
        console.log('Создаем Scenario1');
        this.currentScenario = new Scenario1(this.scene);
        break;
        
        case 'scenario_2':
          console.log('Создаем Scenario_2');
          this.currentScenario = new Scenario_2(this.scene);
          break;
          
        case 'scenario_test_1':
        console.log('Создаем Scenario_test_1');
        this.currentScenario = new Scenario_test_1(this.scene);
        break;
        
      // В будущем можно добавить другие сценарии:
      // case 'scenario2':
      //   this.currentScenario = new Scenario2(this.scene);
      //   break;
      
      default:
        console.warn(`Сценарий ${scenarioName} не найден`);
        return null;
    }
    
    // Инициализируем новый сценарий
    if (this.currentScenario) {
      console.log('Инициализация сценария');
      this.currentScenario.init();
      console.log('Сценарий инициализирован');
    } else {
      console.error('Сценарий не создан');
    }
    
    return this.currentScenario;
  }
  
  /**
   * Получает текущий активный сценарий
   */
  public getCurrentScenario(): Scenario | null {
    return this.currentScenario;
  }
  
  /**
   * Проверяет условия окончания игры для текущего сценария
   */
  public checkGameOver(): number {
    if (this.currentScenario) {
      return this.currentScenario.checkGameOver();
    }
    return Scenario.GAME_CONTINUE;
  }
  
  /**
   * Завершает игру с указанным результатом
   * @param result Результат игры (успех/провал)
   */
  public gameOver(result: number): void {
    if (this.currentScenario) {
      this.currentScenario.gameOver(result);
    }
  }
  
  /**
   * Показывает цель текущего сценария
   */
  public showMissionGoal(): void {
    if (this.currentScenario) {
      this.currentScenario.showMissinGoal();
    }
  }
} 