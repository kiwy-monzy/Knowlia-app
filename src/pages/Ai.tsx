import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { X, Server, Settings, TestTube, TrendingUp, AppWindow, Wrench, MessageSquare, Bird } from 'lucide-react';

// Import the actual React components
import ConfigForm from '@/components/ConfigForm';
import BanditStatsPanel from '@/components/BanditStatsPanel';
import CloseAppButton from '@/components/CloseAppButton';
import WindowInfoPanel from '@/components/WindowInfoPanel';
import ToolsManagement from '@/components/ToolsManagement';
import DeveloperSection from '@/components/DeveloperSection';
import AssistantEnabledIcon from '@/components/AssistantEnabledIcon';
import ChatHistory from '@/components/ChatHistory';
import UnderConstructionSection from '@/components/UnderConstructionSection';

const Ai: React.FC = () => {
  const [activeSection, setActiveSection] = useState("configuration");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [globalConfig, setGlobalConfig] = useState({
    enable_background_tasks: false,
    loadConfig: () => console.log('Loading config...')
  });

  const isAssistantEnabled = globalConfig.enable_background_tasks;

  useEffect(() => {
    globalConfig.loadConfig();
    console.log({ globalConfig });
    //invoke("create_avatar_window").catch((error) => {
    //  console.error("Failed to create avatar window:", error);
    //});
  }, []);

  return (
    <main className="flex h-screen">
      {/* Left Sidebar */}
      <div className="w-48 bg-gray-100 border-r border-gray-200 flex flex-col">
        <div className="relative px-4 pt-4 pb-0 border-b border-gray-200">
          <div className="relative flex items-center justify-between font-jersey15">
            <h1 className="text-4xl text-primary">Loyca.ai</h1>
          </div>
          <div className="flex items-center gap-0.5">
            <AssistantEnabledIcon isAssistantEnabled={isAssistantEnabled} />
            <p className="text-base text-muted-foreground font-pixelify">
              AI companion
            </p>
          </div>
          <img
            src="/loyca/logo.png"
            alt="logo"
            className="absolute right-0 bottom-0 pointer-events-none z-2 w-14"
          />
        </div>

        <nav className="relative flex-1 p-4">
          <ul className="space-y-2">
            <li className="w-40 absolute bottom-4 left-4 overflow-auto">
              <div className="border-b border-gray-300 w-full mb-4"></div>
              <Button
                variant="ghost"
                className={activeSection === "testing" ? "bg-gray-200 font-bold" : ""}
                onClick={() => setActiveSection("testing")}
              >
                <TestTube className="w-4 h-4 mr-1" />
                Developer
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className={activeSection === "configuration" ? "bg-gray-200 font-bold" : ""}
                onClick={() => setActiveSection("configuration")}
              >
                <Settings className="w-4 h-4 mr-1" />
                Configuration
              </Button>
            </li>
            <li className="border-b border-gray-300"></li>
            <li>
              <Button
                variant="ghost"
                className={activeSection === "window-info" ? "bg-gray-200 font-bold" : ""}
                onClick={() => setActiveSection("window-info")}
              >
                <AppWindow className="w-4 h-4 mr-1" />
                Window Info
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className={activeSection === "bandit" ? "bg-gray-200 font-bold" : ""}
                onClick={() => setActiveSection("bandit")}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Assistant Stats
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className={`activeSection === "mcp" ? "bg-gray-200 font-bold relative" : "relative`}
                onClick={() => setActiveSection("mcp")}
              >
                <div className="mr-4">
                  <Server className="absolute top-2 left-2 size-4" />
                  <Wrench className="absolute top-3 left-4 size-4" />
                </div>
                MCP/Tools
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className={activeSection === "chat-history" ? "bg-gray-200 font-bold" : ""}
                onClick={() => setActiveSection("chat-history")}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Chat History
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className={activeSection === "avatar-customization" ? "bg-gray-200 font-bold" : ""}
                onClick={() => setActiveSection("avatar-customization")}
              >
                <Bird className="w-4 h-4 mr-1" />
                Avatar
              </Button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          {activeSection === "configuration" && (
            <>
              <CloseAppButton
                open={showCloseModal}
                onOpenChange={(open: boolean) => setShowCloseModal(open)}
              />
              <div className="max-w-4xl mx-auto space-y-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">
                    Configuration
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Configure your AI settings and preferences
                  </p>
                </div>
                <ConfigForm />
              </div>
            </>
          )}
          {activeSection === "testing" && <DeveloperSection />}
          {activeSection === "window-info" && (
            <div className="max-w-6xl mx-auto space-y-8">
              <WindowInfoPanel />
            </div>
          )}
          {activeSection === "bandit" && (
            <div className="max-w-4xl mx-auto space-y-8">
              <BanditStatsPanel />
            </div>
          )}
          {activeSection === "mcp" && (
            <div className="max-w-3xl mx-auto space-y-8">
              <ToolsManagement />
            </div>
          )}
          {activeSection === "chat-history" && (
            <div className="h-full">
              <ChatHistory />
            </div>
          )}
          {activeSection === "avatar-customization" && (
            <div className="max-w-6xl mx-auto space-y-8">
              <UnderConstructionSection
                title="Avatar Customization"
                subtitle="Customize your avatar and make it unique."
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Ai;