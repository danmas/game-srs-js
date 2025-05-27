import Phaser from 'phaser';
import { Ship } from '../objects/Ship';
import { MainScene } from '../scenes/MainScene';
import { Constants } from '../utils/Constants';
import { Settings } from '../utils/Settings';
import { DetectionState } from '../utils/DetectionState';
import { Vehicle } from '../objects/Vehicle';

export class AIWeaponControl {
    private owner: Ship;
    private mainScene: MainScene;

    constructor(owner: Ship, scene: MainScene) {
        this.owner = owner;
        this.mainScene = scene;
    }

    public evaluateAndFire(): void {
        if (!this.owner || !this.mainScene || !this.owner.active) {
            return;
        }

        let targetCandidate: Vehicle | null = null;

        for (const perceivedInfo of this.owner.perceivedTargets.values()) {
            if (perceivedInfo.targetVehicle.active && 
                perceivedInfo.targetVehicle.getForces() !== this.owner.getForces() &&
                (perceivedInfo.detectionState === DetectionState.ZONE_2_LOCALIZED || 
                 perceivedInfo.detectionState === DetectionState.ZONE_3_IDENTIFIED)) {
                
                if (perceivedInfo.targetVehicle instanceof Ship) {
                    targetCandidate = perceivedInfo.targetVehicle;
                    break; 
                }
            }
        }

        if (!targetCandidate) {
            return; 
        }
        
        if (!(targetCandidate instanceof Ship)) {
            return;
        }

        const target: Ship = targetCandidate;

        const weaponReady = this.owner.isWeaponReady(Constants.WEAPON_SELECT_TORP_I);
        const targetTruePosition = target.getTruePositionBeforeSensorEffects();
        const distanceToTarget = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, targetTruePosition.x, targetTruePosition.y);
        const angleToTargetRad = Phaser.Math.Angle.Between(this.owner.x, this.owner.y, targetTruePosition.x, targetTruePosition.y);
        let angleToTargetDeg = (Phaser.Math.RadToDeg(angleToTargetRad) + 90 + 360) % 360;
        const diffAngle = Phaser.Math.Angle.ShortestBetween(this.owner.getDirection(), angleToTargetDeg);

        const distanceOk = distanceToTarget < Settings.TRP_I_DIST_EXECUTION;
        
        const angleOk = Math.abs(diffAngle) < Settings.TRP_ATACK__ANGLE_WARNING;

        if (weaponReady && distanceOk && angleOk) {
            console.log(`   >>> AI Ship ${this.owner.id}: УСЛОВИЯ ВЫПОЛНЕНЫ! СТРЕЛЯЮ Торпедой I по Цели ${target.id} (Реальные координаты: X:${targetTruePosition.x.toFixed(0)}, Y:${targetTruePosition.y.toFixed(0)})`);
            this.mainScene.fireTorpedo(this.owner, Constants.WEAPON_SELECT_TORP_I, targetTruePosition.x, targetTruePosition.y);
        }
    }
} 