import React, { useCallback, useEffect, useState } from "react";

import "./styles.scss";

type TabId = "cheat";

interface Tab {
  id: TabId;
  label: string;
}

type CheatName = "noclip" | "fastMove";

interface CheatDef {
  id: CheatName;
  label: string;
}

const tabs: Tab[] = [
  { id: "cheat", label: "Cheat" },
];

const cheats: CheatDef[] = [
  { id: "noclip", label: "Noclip" },
  { id: "fastMove", label: "Fast Movement" },
];

const sendCheat = (cheat: CheatName, enabled: boolean) => {
  window.skyrimPlatform?.sendMessage?.(
    JSON.stringify({ type: "adminPanel", cheat, enabled }),
  );
};

interface CheatTabProps {
  state: Record<CheatName, boolean>;
  onToggle: (id: CheatName) => void;
}

const CheatTab = ({ state, onToggle }: CheatTabProps) => {
  return (
    <div className="adminPanel__tabContent">
      <div className="adminPanel__cheatList">
        {cheats.map((cheat) => (
          <button
            key={cheat.id}
            type="button"
            className={`adminPanel__cheatToggle ${state[cheat.id] ? "adminPanel__cheatToggle--on" : ""}`}
            onClick={() => onToggle(cheat.id)}
          >
            <span className="adminPanel__cheatLabel">{cheat.label}</span>
            <span className="adminPanel__cheatState">{state[cheat.id] ? "ON" : "OFF"}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const AdminPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("cheat");
  const [cheatState, setCheatState] = useState<Record<CheatName, boolean>>({
    noclip: false,
    fastMove: false,
  });

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const toggleCheat = (id: CheatName) => {
    const next = !cheatState[id];
    setCheatState({ ...cheatState, [id]: next });
    sendCheat(id, next);
  };

  useEffect(() => {
    window.addEventListener("openAdminPanel", handleOpen);
    window.addEventListener("closeAdminPanel", handleClose);
    return () => {
      window.removeEventListener("openAdminPanel", handleOpen);
      window.removeEventListener("closeAdminPanel", handleClose);
    };
  }, [handleOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="adminPanel">
      <div className="adminPanel__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`adminPanel__tab ${activeTab === tab.id ? "adminPanel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="adminPanel__body">
        {activeTab === "cheat" && <CheatTab state={cheatState} onToggle={toggleCheat} />}
      </div>
    </div>
  );
};

export default AdminPanel;
