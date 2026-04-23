import React, { useCallback, useEffect, useState } from "react";
import { SkyrimFrame } from "@/components/SkyrimFrame/SkyrimFrame";
import { FrameButton } from "@/components/FrameButton/FrameButton";
import content, { levels } from "./content";
import "./styles.scss";
import { SkyrimHint } from "@/components/SkyrimHint/SkyrimHint";
import hoverSound from "./assets/OnCoursor.wav";
import quitSound from "./assets/Quit.wav";
import selectSound from "./assets/ButtonDown.wav";
import learnSound from "./assets/LearnSkill.wav";
import { IPlayerData } from "@/interfaces/skillMenu";

type Perk = {
  name: string;
  description: string;
  levelsPrice: number[];
  levelsDescription?: string[];
  icon: string;
};

const playAudio = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const audio = el.cloneNode(true) as HTMLAudioElement;
  void audio.play();
};

const setFullPageDisplay = (display: string) => {
  const el = document.getElementsByClassName("fullPage")[0] as HTMLElement | undefined;
  if (el) el.style.display = display;
};

const SkillsMenu = ({ send }: { send: (message: string) => void }) => {
  const [currentHeader, setCurrentHeader] = useState("abilities");
  const [currentLevel, setCurrentLevel] = useState(" ");
  const [currentDescription, setCurrentDescription] = useState(" ");
  const [selectedPerk, setSelectedPerk] = useState<Perk | null>(null);
  const [scale, setScale] = useState(1);
  const [pExp, setPExp] = useState(0);
  const [expHint, setExpHint] = useState(false);
  const [pMem, setPMem] = useState(0);
  const [memHint, setMemHint] = useState(false);
  const [playerData, setPlayerData] = useState<IPlayerData | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const fetchData = useCallback((event: Event) => {
    setFullPageDisplay("none");
    const newPlayerData = JSON.parse((event as CustomEvent).detail) as IPlayerData;
    setPlayerData(newPlayerData);
  }, []);

  const quitHandler = useCallback(() => {
    setFullPageDisplay("flex");
    try {
      playAudio("quitSound");
    } catch (e) {
      console.log("Error playing sound", e);
    }
    setPlayerData(null);
    send("/skill quit");
  }, [send]);

  const init = useCallback(() => {
    setConfirmDiscard(false);
    send("/skill init");
  }, [send]);

  useEffect(() => {
    window.addEventListener("updateSkillMenu", fetchData);
    window.addEventListener("initSkillMenu", init);
    window.addEventListener("skymp5-client:browserUnfocused", quitHandler);
    // !Important: Run commented code to dispatch event
    // window.dispatchEvent(
    //   new CustomEvent('updateSkillMenu', {
    //     detail: {
    //       exp: 800,
    //       mem: 1000,
    //       perks: {
    //         saltmaker: 1,
    //         weapon: 1,
    //         leather: 3,
    //         jewelry: 2,
    //         clother: 4
    //       }
    //     }
    //   })
    // );
    return () => {
      setPlayerData(null);
      window.removeEventListener("updateSkillMenu", fetchData);
      window.removeEventListener("initSkillMenu", init);
      window.removeEventListener("skymp5-client:browserUnfocused", quitHandler);
      setFullPageDisplay("flex");
    };
  }, [fetchData, init, quitHandler]);

  useEffect(() => {
    if (!playerData) return;
    setPExp(playerData.exp);
    setPMem(playerData.mem);
    setScale(window.innerWidth >= 1920 ? 1 : window.innerWidth / 2500);
  }, [playerData]);

  const hoverHandler = (perk: Perk) => {
    if (!playerData) return;
    setCurrentHeader(perk.description);
    playAudio("hoverSound");
    const playerLevel = playerData.perks[perk.name] || 0;
    setCurrentLevel(levels[playerLevel].name);
    setCurrentDescription("");
    if (!perk.levelsDescription) return;
    setCurrentDescription(perk.levelsDescription[playerLevel]);
  };

  const clickHandler = (perk: Perk) => {
    if (!playerData) return;
    const playerLevel = playerData.perks[perk.name] || 0;
    if (playerLevel === perk.levelsPrice.length) return;
    setCurrentLevel(levels[playerLevel + 1].name);
    if (perk.levelsDescription) {
      setCurrentDescription(perk.levelsDescription[playerLevel + 1]);
    } else {
      setCurrentDescription("");
    }
    playAudio("selectSound");
    if (perk.levelsPrice[playerLevel] > pExp) {
      setCurrentDescription(`${perk.levelsPrice[playerLevel] - pExp} experience short`);
      return;
    }
    if (perk.levelsPrice[playerLevel] > pMem) {
      setCurrentDescription("not enough memory");
      return;
    }
    setSelectedPerk(perk);
  };

  const learnHandler = () => {
    if (!playerData || !selectedPerk) return;
    const level = playerData.perks[selectedPerk.name] || 0;
    const price = selectedPerk.levelsPrice[level];
    // level index for skills array
    // 0 level for first level to craft
    send(`/skill ${selectedPerk.name} ${level}`);
    setPExp(pExp - price);
    setPMem(pMem - price);
    playerData.perks[selectedPerk.name] = level + 1;
    playAudio("learnSound");
  };

  const discardHandler = () => {
    send("/skill discard");
    setConfirmDiscard(false);
  };

  const confirmHandler = () => {
    setConfirmDiscard(true);
    setCurrentLevel("do you want to reset your progress?");
    setCurrentDescription(
      "by clicking \u201cyes\u201d you will fully reset all learned professions and get back half of the spent experience. You will also lose all learned spells.",
    );
  };

  if (!playerData) return null;

  return (
    <div className="skill-container">
      <div className="perks" style={{ transform: `scale(${scale})` }}>
        <div className="perks__content">
          <div className="perks__header">
            <span>{currentHeader}</span>
            <div
              className="perks__exp-container__line"
              onMouseEnter={() => setMemHint(true)}
              onMouseLeave={() => setMemHint(false)}
            >
              <SkyrimHint
                active="true"
                text={"memory is needed to learn new abilities"}
                isOpened={memHint}
                left={true}
              />
              <span>memory:</span>
              <span className="perks__exp-container__line__price">
                {pMem}
                <span className="perks__exp" style={{ opacity: 0 }} />
              </span>
            </div>
          </div>
          <div className="perks__list-container">
            <div className="perks__list">
              {content.map((category, cIndex) => (
                <ul className="perks__category" key={cIndex}>
                  {category.map((perk, index) => (
                    <div
                      className={`perks__perk perks__perk--level-${
                        (playerData.perks[perk.name] / perk.levelsPrice.length) * 4 || 0
                      } ${index > 7 ? "perks__perk--absolute" : ""} ${
                        index % 2 ? "perks__perk--right" : "perks__perk--left"
                      }
                        ${perk.levelsPrice.length < 4 ? "perks__perk--short" : ""}
                      `}
                      key={perk.name}
                      onMouseEnter={() => hoverHandler(perk)}
                      onClick={() => clickHandler(perk)}
                      onBlur={() => setSelectedPerk(null)}
                      tabIndex={0}
                    >
                      <div
                        className="perks__perk__icon"
                        dangerouslySetInnerHTML={{ __html: perk.icon }}
                      ></div>
                      {playerData.perks[perk.name] !== perk.levelsPrice.length && (
                        <p className="perks__perk__price">
                          <span>
                            {playerData.perks[perk.name]
                              ? perk.levelsPrice[playerData.perks[perk.name]]
                              : perk.levelsPrice[0]}
                          </span>
                          <span className="perks__exp" />
                        </p>
                      )}
                    </div>
                  ))}
                </ul>
              ))}
            </div>
            <div className="perks__footer">
              <div className="perks__footer__description">
                <p className="perks__footer__description__title">{currentLevel}</p>
                <p className="perks__footer__description__text">{currentDescription}</p>
              </div>
              <div className="perks__footer__buttons">
                <div className="perks__exp-container">
                  <div
                    className="perks__exp-container__line"
                    onMouseEnter={() => setExpHint(true)}
                    onMouseLeave={() => setExpHint(false)}
                  >
                    <SkyrimHint
                      text={"abilities can be upgraded with experience"}
                      isOpened={expHint}
                      active="true"
                      left={true}
                    />
                    <span>experience:</span>
                    <span className="perks__exp-container__line__price">
                      {pExp}
                      <span className="perks__exp" />
                    </span>
                  </div>
                </div>
                <FrameButton
                  text="learn"
                  name="learnBtn"
                  variant="DEFAULT"
                  width={242}
                  height={56}
                  disabled={
                    !selectedPerk ||
                    selectedPerk.levelsPrice[playerData.perks[selectedPerk.name] || 0] > pExp ||
                    (!playerData.perks[selectedPerk.name] && pMem === 0)
                  }
                  onMouseDown={() => learnHandler()}
                ></FrameButton>
                {confirmDiscard ? (
                  <div className="perks__footer__buttons__confirm">
                    <FrameButton
                      text="yes"
                      name="yesBtn"
                      variant="DEFAULT"
                      width={178}
                      height={56}
                      onMouseDown={() => discardHandler()}
                    ></FrameButton>
                    <FrameButton
                      text="no"
                      name="noBtn"
                      variant="DEFAULT"
                      width={178}
                      height={56}
                      onMouseDown={() => setConfirmDiscard(false)}
                    ></FrameButton>
                  </div>
                ) : (
                  <FrameButton
                    text="reset"
                    name="discardBtn"
                    variant="DEFAULT"
                    width={242}
                    height={56}
                    onMouseDown={() => confirmHandler()}
                  ></FrameButton>
                )}
              </div>
              <div className="perks__footer__exit-button">
                <FrameButton
                  name="extBtn"
                  text="exit"
                  variant="DEFAULT"
                  width={242}
                  height={56}
                  onClick={() => quitHandler()}
                ></FrameButton>
              </div>
            </div>
          </div>
        </div>
        <SkyrimFrame width={1720} height={1004} name="perkSystem" />
        <audio id="hoverSound">
          <source src={hoverSound}></source>
        </audio>
        <audio id="learnSound">
          <source src={learnSound}></source>
        </audio>
        <audio id="selectSound">
          <source src={selectSound}></source>
        </audio>
        <audio id="quitSound">
          <source src={quitSound}></source>
        </audio>
      </div>
    </div>
  );
};

export default SkillsMenu;
