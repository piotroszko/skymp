import {
  SpellCastEvent,
  Actor,
  Game,
  getAnimationVariablesFromActor,
  SpellType,
  SlotType,
  EquippedItemType,
} from "skyrimPlatform";

import { MsgType } from "../messages";
import { SpellCastMsgData } from "../types/messages/spellCastMessage";
import { UpdateAnimVariablesMessageMsgData } from "../types/messages/updateAnimVariablesMessage";
// TODO: refactor this out
import { localIdToRemoteId, remoteIdToLocalId } from "../view/worldViewMisc";
import { ClientListener, CombinedController, Sp } from "./clientListener";

export class MagicSyncService extends ClientListener {
  constructor(
    private sp: Sp,
    private controller: CombinedController,
  ) {
    super();
    this.controller.on("update", () => this.onUpdate());
    this.controller.on("spellCast", (e) => this.onSpellCast(e));

    this.sp.hooks.sendAnimationEvent.add(
      {
        enter: (_ctx) => {},
        leave: (ctx) => {
          this.onSendAnimationEventLeave(ctx);
        },
      },
      this.playerId,
      this.playerId,
    );
  }

  private onUpdate() {
    if (this.isAnyMagicStuffEquiped() === false) {
      return;
    }

    if (
      Date.now() - this.lastSendUpdateAnimationVariables <=
      this.sendUpdateAnimationVariablesRateMs
    ) {
      return;
    }

    this.lastSendUpdateAnimationVariables = Date.now();

    this.controller.once("update", () => {
      const ac = Game.getPlayer();

      if (!ac) {
        return;
      }

      const animVariables = this.getAnimationVariablesFromActorConverted(ac.getFormID());

      this.controller.emitter.emit("sendMessage", {
        message: {
          t: MsgType.UpdateAnimVariables,
          data: this.getUpdateAnimVariablesEventData(ac, animVariables),
        },
        reliability: "reliable",
      });
    });
  }

  private onSpellCast(event: SpellCastEvent) {
    const isInterruptCast = false;

    const msg: SpellCastMsgData = this.getSpellCastEventData(event, isInterruptCast);

    this.controller.emitter.emit("sendMessage", {
      message: { t: MsgType.SpellCast, data: msg },
      reliability: "reliable",
    });

    this.lastSpellCastEventMsg = msg;
  }

  private onSendAnimationEventLeave(ctx: { animEventName: string; animationSucceeded: boolean }) {
    if (!this.lastSpellCastEventMsg || !this.isInteraptSpellCastAnim(ctx.animEventName)) {
      return;
    }

    this.controller.once("update", () => {
      if (!this.lastSpellCastEventMsg || this.lastSpellCastEventMsg.interruptCast) {
        return;
      }

      let msg: SpellCastMsgData = this.lastSpellCastEventMsg;
      msg.interruptCast = true;
      msg.actorAnimationVariables = this.getAnimationVariablesFromActorConverted(
        remoteIdToLocalId(this.lastSpellCastEventMsg.caster),
      );

      this.controller.emitter.emit("sendMessage", {
        message: { t: MsgType.SpellCast, data: msg },
        reliability: "reliable",
      });
    });
  }

  private getSpellCastEventData(e: SpellCastEvent, isInterruptCast: boolean): SpellCastMsgData {
    const spellCastData: SpellCastMsgData = {
      caster: localIdToRemoteId(e.caster.getFormID(), true),
      target: e.target ? localIdToRemoteId(e.target.getFormID(), true) : 0,
      spell: e.spell ? e.spell.getFormID() : 0,
      interruptCast: isInterruptCast,
      isDualCasting: e.isDualCasting,
      castingSource: e.castingSource,
      aimAngle: e.aimAngle,
      aimHeading: e.aimHeading,
      actorAnimationVariables: this.getAnimationVariablesFromActorConverted(e.caster.getFormID()),
    };
    return spellCastData;
  }

  private getAnimationVariablesFromActorConverted(actorId: number) {
    const animVars = getAnimationVariablesFromActor(actorId);
    const booleans: ArrayBuffer = animVars.booleans;
    const floats: ArrayBuffer = animVars.floats;
    const integers: ArrayBuffer = animVars.integers;
    return {
      booleans: Array.from(new Uint8Array(booleans)),
      floats: Array.from(new Uint8Array(floats)),
      integers: Array.from(new Uint8Array(integers)),
    };
  }

  private getUpdateAnimVariablesEventData(
    ac: Actor,
    animVariables: UpdateAnimVariablesMessageMsgData["actorAnimationVariables"],
  ): UpdateAnimVariablesMessageMsgData {
    const animVarsData: UpdateAnimVariablesMessageMsgData = {
      actorRemoteId: localIdToRemoteId(ac.getFormID(), true),
      actorAnimationVariables: animVariables,
    };
    return animVarsData;
  }

  private isInteraptSpellCastAnim(animEventName: string): boolean {
    const eventName = animEventName.toLowerCase();
    return eventName === "mlh_equipped_event" || eventName === "mrh_equipped_event";
  }

  private isSpellCastAnim(animEventName: string): boolean {
    const eventName = animEventName.toLowerCase();

    const isSpellCastAnimForLeftHand =
      eventName === "mlh_spellaimedconcentrationstart" ||
      eventName === "mlh_spellaimedstart" ||
      eventName === "mlh_spellready_event" ||
      eventName === "mlh_spellrelease_event" ||
      eventName === "mlh_equipped_event";

    const isSpellCastAnimForRightHand =
      eventName === "mrh_spellaimedconcentrationstart" ||
      eventName === "mrh_spellaimedstart" ||
      eventName === "mrh_spellready_event" ||
      eventName === "mrh_spellrelease_event" ||
      eventName === "mrh_equipped_event";

    return isSpellCastAnimForLeftHand || isSpellCastAnimForRightHand;
  }

  private isAnyMagicStuffEquiped(): boolean {
    const ac = Game.getPlayer();

    if (!ac) {
      return false;
    }

    if (ac.getEquippedSpell(SpellType.Left) || ac.getEquippedSpell(SpellType.Right)) {
      return true;
    }

    if (ac.getEquippedSpell(SpellType.Voise) || ac.getEquippedSpell(SpellType.Instant)) {
      return true;
    }

    const leftHandEquipmentType = ac.getEquippedItemType(SlotType.Left);
    const rightHandEquipmentType = ac.getEquippedItemType(SlotType.Right);

    if (
      leftHandEquipmentType === 9 ||
      leftHandEquipmentType === EquippedItemType.Staff ||
      rightHandEquipmentType === 9 ||
      rightHandEquipmentType === EquippedItemType.Staff
    ) {
      return true;
    }

    return false;
  }

  private playerId = 0x14;
  private sendUpdateAnimationVariablesRateMs = 500;
  private lastSpellCastEventMsg: SpellCastMsgData | null = null;
  private lastSendUpdateAnimationVariables: number = 0;
}
