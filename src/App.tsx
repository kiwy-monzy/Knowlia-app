import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import { HeaderComponent } from "./components/layout/Header";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Map from "./pages/Map";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SiteProvider } from "./contexts/SiteContext";
import { ChatProvider } from "./contexts/ChatContext";
import Avatar from "./pages/Avatar";
import Storage from "./pages/Storage";
import Timetable from "./pages/Timetable";
import Tasks from "./pages/Tasks";
import BallTrail from "./components/common/BallTrail";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const location = useLocation();

  const toggleSidebarCollapse = () => setIsSidebarCollapsed((v) => !v);

  // Check if current route is avatar
  const isAvatarRoute = location.pathname === "/avatar";

  // If avatar route, render only the Avatar component wrapped in providers
  if (isAvatarRoute) {
    return (
      <SiteProvider>
        <ThemeProvider>
          <ChatProvider>
            <ErrorBoundary>
              <div className="relative h-screen w-screen">
                <BallTrail />
                <Avatar />
              </div>
            </ErrorBoundary>
          </ChatProvider>
        </ThemeProvider>
      </SiteProvider>
    );
  }

  return (
    <SiteProvider>
      <ThemeProvider>
        <ChatProvider>
          <div className="flex h-screen  overflow-hidden relative">
            <BallTrail />


            {/* Sidebar */}
            <Sidebar
              collapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapse}
            />

            {/* Main content area */}
            <div className="flex-1 flex flex-col bg-[#1a1a1a] min-w-0 min-h-0 h-full">
              {/* Header */}
              <div className="sticky top-0 z-30 w-full">
                <HeaderComponent
                  isMobileMenuOpen={false}
                  setIsMobileMenuOpen={() => {}}
                  collapsed={isSidebarCollapsed}
                  onToggleCollapse={toggleSidebarCollapse}
                />
              </div>

              {/* Page content */}
              <div className="flex-1 bg-[#fafafa] rounded-l-[2rem] overflow-hidden">
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/groups" element={<Chat />} />
                   {/* <Route path="/ai" element={<AI />} /> {/* Page content */}
                   {/* <Route path="/gpt" element={<Gpt />} /> {/* Page content */}
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/storage" element={<Storage />} />
                    <Route path="/timetable" element={<Timetable />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/map" element={<Map />} />
                    <Route path="*" element={<Dashboard />} />
                  </Routes>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </ChatProvider>
      </ThemeProvider>
    </SiteProvider>
  );
}

export default App;