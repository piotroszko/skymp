import {
  CreateActorMessageMainProps,
  CreateActorMessageAdditionalProps,
} from "src/types/messages/createActorMessage";

import { Movement } from "../sync/movement";

// Own properties (not inherited) are being assigned locally
export interface FormModel extends CreateActorMessageAdditionalProps, CreateActorMessageMainProps {
  idx?: number;
  movement?: Movement;
  numMovementChanges?: number;
  numAppearanceChanges?: number;
  isMyClone?: boolean;
}

export interface WorldModel {
  forms: Array<FormModel | undefined>;
  playerCharacterFormIdx: number;
  playerCharacterRefrId: number;
}
