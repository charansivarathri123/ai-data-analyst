"use client";

import React, { useState } from "react";
import { ThemeProvider } from "@/components/ThemeContext";
import { AuthProvider } from "@/components/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { AuthModal } from "@/components/AuthModal";
import { InfoModals, InfoModalType } from "@/components/InfoModals";

function AppShellContent() {
  const [resetChatTrigger, setResetChatTrigger] = useState(0);
  const [activeInfoModal, setActiveInfoModal] = useState<InfoModalType>(null);

  const handleNewChat = () => {
    setResetChatTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas font-sans antialiased text-primaryText">
      {/* 1. Left Vertical Fixed Sidebar */}
      <Sidebar
        onNewChat={handleNewChat}
        onOpenInfoModal={(type) => setActiveInfoModal(type)}
      />

      {/* 2. Main Content Area with Chat Interface */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <ChatInterface resetTrigger={resetChatTrigger} />
      </main>

      {/* 3. Authentication Modal (Mobile OTP, Email OTP, Google Sign-In) */}
      <AuthModal />

      {/* 4. Information Modals (Agent Squad, Architecture, Power BI & TMDL) */}
      <InfoModals
        activeModal={activeInfoModal}
        onClose={() => setActiveInfoModal(null)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShellContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
