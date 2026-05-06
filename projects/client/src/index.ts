import { Game, Utility, once } from "skyrimPlatform";
import * as sp from "skyrimPlatform";

import { ActivationService } from "./services/activationService";
import { AdminPanelService } from "./services/adminPanelService";
import { AnimDebugService } from "./services/animDebugService";
import { AuthService } from "./services/authService";
import { BlockedAnimationsService } from "./services/blockedAnimationsService";
import { BlockPapyrusEventsService } from "./services/blockPapyrusEventsService";
import { BrowserService } from "./services/browserService";
import { ConsoleCommandsService } from "./services/consoleCommandsService";
import { ContainersService } from "./services/containersService";
import { CraftService } from "./services/craftService";
import { DeathService } from "./services/deathService";
import { DisableDifficultySelectionService } from "./services/disableDifficultySelectionService";
import { DisableFastTravelService } from "./services/disableFastTravelService";
import { DisableSkillAdvanceService } from "./services/disableSkillAdvanceService";
import { DropItemService } from "./services/dropItemService";
import { EnforceLimitationsService } from "./services/enforceLimitationsService";
import { FrontHotReloadService } from "./services/frontHotReloadService";
import { GamemodeEventSourceService } from "./services/gamemodeEventSourceService";
import { GamemodeUpdateService } from "./services/gamemodeUpdateService";
import { HitService } from "./services/hitService";
import { KeyboardEventsService } from "./services/keyboardEventsService";
import { LastInvService } from "./services/lastInvService";
import { LoadGameService } from "./services/loadGameService";
import { LoadOrderVerificationService } from "./services/loadOrderVerificationService";
import { MagicSyncService } from "./services/magicSyncService";
import { NetInfoService } from "./services/netInfoService";
import { NetworkingService } from "./services/networkingService";
import { PlayerBowShotService } from "./services/playerBowShotService";
import { ProfilingService } from "./services/profilingService";
import { RagdollService } from "./services/ragdollService";
import { RemoteServer } from "./services/remoteServer";
import { SendInputsService } from "./services/sendInputsService";
import { ServerJsVerificationService } from "./services/serverJsVerificationService";
import { SettingsService } from "./services/settingsService";
import { SinglePlayerService } from "./services/singlePlayerService";
import { SkympClient } from "./services/skympClient";
import { SpApiInteractor } from "./services/spApiInteractor";
import { SpSnippetService } from "./services/spSnippetService";
import { SpVersionCheckService } from "./services/spVersionCheckService";
import { SweetCameraEnforcementService } from "./services/sweetCameraEnforcementService";
import { SweetTaffyDynamicPerksService } from "./services/sweetTaffyDynamicPerksService";
import { SweetTaffyEvalService } from "./services/sweetTaffyEvalService";
import { SweetTaffyNicknamesService } from "./services/sweetTaffyNicknamesService";
import { SweetTaffyPlayerCombatService } from "./services/sweetTaffyPlayerCombatService";
import { SweetTaffySkillMenuService } from "./services/sweetTaffySkillMenuService";
import { SweetTaffyStaticPerksService } from "./services/sweetTaffyStaticPerksService";
import { SweetTaffySweetCantDropService } from "./services/sweetTaffySweetCantDropService";
import { TimersService } from "./services/timersService";
import { TimeService } from "./services/timeService";
import { WorldCleanerService } from "./services/worldCleanerService";
import { WorldView } from "./view/worldView";

once("update", () => {
  Utility.setINIBool("bAlwaysActive:General", true);
  Game.setGameSettingInt("iDeathDropWeaponChance", 0);
  Utility.setINIFloat("fAutoVanityModeDelay:Camera", 3600);
});

const main = () => {
  // TODO: handle setup failure. will output to game console by default
  const controller = SpApiInteractor.getControllerInstance();

  const listeners = [
    new BlockPapyrusEventsService(sp, controller),
    new LoadGameService(sp, controller),
    new SinglePlayerService(sp, controller),
    new EnforceLimitationsService(sp, controller),
    new SendInputsService(sp, controller),
    new SkympClient(sp, controller),
    new TimeService(sp, controller),
    new SpVersionCheckService(sp, controller),
    new ConsoleCommandsService(sp, controller),
    new LastInvService(sp, controller),
    new ActivationService(sp, controller),
    new CraftService(sp, controller),
    new DropItemService(sp, controller),
    new HitService(sp, controller),
    new RagdollService(sp, controller),
    new DeathService(sp, controller),
    new ContainersService(sp, controller),
    new NetworkingService(sp, controller),
    new RemoteServer(sp, controller),
    new SpSnippetService(sp, controller),
    new SettingsService(sp, controller),
    new SweetTaffyDynamicPerksService(sp, controller),
    new SweetTaffyStaticPerksService(sp, controller),
    new SweetTaffySweetCantDropService(sp, controller),
    new SweetTaffyPlayerCombatService(sp, controller),
    new SweetTaffySkillMenuService(sp, controller),
    new SweetCameraEnforcementService(sp, controller),
    new SweetTaffyEvalService(sp, controller),
    new DisableSkillAdvanceService(sp, controller),
    new DisableFastTravelService(sp, controller),
    new DisableDifficultySelectionService(sp, controller),
    new WorldCleanerService(sp, controller),
    new LoadOrderVerificationService(sp, controller),
    new BrowserService(sp, controller),
    new AuthService(sp, controller),
    new NetInfoService(sp, controller),
    new AnimDebugService(sp, controller),
    new TimersService(sp, controller),
    new PlayerBowShotService(sp, controller),
    new GamemodeEventSourceService(sp, controller),
    new GamemodeUpdateService(sp, controller),
    new FrontHotReloadService(sp, controller),
    new BlockedAnimationsService(sp, controller),
    new WorldView(sp, controller),
    new KeyboardEventsService(sp, controller),
    new MagicSyncService(sp, controller),
    new ProfilingService(sp, controller),
    new SweetTaffyNicknamesService(sp, controller),
    new ServerJsVerificationService(sp, controller),
    new AdminPanelService(sp, controller),
    // new EventLoggerService(sp, controller), # uncomment for testing purposes, will cause performance issues
  ];
  SpApiInteractor.setup(listeners);
};

// [18.08.2023]
// I saw "attempt to call hooks.add while in hook context" error
// I'm not sure if it's a C++ bug in SkyrimPlatform or an artifact of webpack+hotreload
// But let's for now ensure that "main" executes inside tick context
once("tick", main);
