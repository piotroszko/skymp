import React, { useCallback, useEffect, useState } from "react";

import "./styles.scss";

type TabId = "cheat";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "cheat", label: "Cheat" },
];

const CheatTab = () => {
  return (
    <div className="adminPanel__tabContent">
      <p className="adminPanel__placeholder">Cheat tools coming soon.</p>
    </div>
  );
};

const AdminPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("cheat");

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

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
        {activeTab === "cheat" && <CheatTab />}
      </div>
    </div>
  );
};

export default AdminPanel;
