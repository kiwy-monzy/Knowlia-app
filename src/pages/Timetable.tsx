import { TimetableSidebar } from '@/components/timetable/TimetableSidebar';
import TimetableView from '@/components/timetable/TimetableView';

function TimetableContent() {
  const renderContent = () => {
    // Always show weekly timetable view
    return <TimetableView />;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block h-full bg-[#fafafa] relative">
        <TimetableSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

export default TimetableContent;
