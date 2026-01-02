import React, { useState } from 'react';

interface SimpleTabsProps {
  defaultValue: string;
  children: React.ReactNode;
}

interface SimpleTabsListProps {
  children: React.ReactNode;
}

interface SimpleTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  onClick?: () => void;
}

interface SimpleTabsContentProps {
  value: string;
  children: React.ReactNode;
}

const SimpleTabs: React.FC<SimpleTabsProps> & {
  List: React.FC<SimpleTabsListProps>;
  Trigger: React.FC<SimpleTabsTriggerProps>;
  TabsContent: React.FC<SimpleTabsContentProps>;
} = ({ defaultValue, children }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <div>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

const SimpleTabsList: React.FC<SimpleTabsListProps & { activeTab?: string; setActiveTab?: (value: string) => void }> = ({ 
  children, 
  activeTab, 
  setActiveTab 
}) => {
  return (
    <div className="flex border-b border-gray-200">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

const SimpleTabsTrigger: React.FC<SimpleTabsTriggerProps & { activeTab?: string; setActiveTab?: (value: string) => void }> = ({ 
  value, 
  children, 
  activeTab, 
  setActiveTab,
  onClick 
}) => {
  const isActive = activeTab === value;
  
  return (
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        isActive 
          ? 'border-blue-500 text-blue-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
      onClick={() => {
        setActiveTab?.(value);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
};

const SimpleTabsContent: React.FC<SimpleTabsContentProps & { activeTab?: string }> = ({ 
  value, 
  children, 
  activeTab 
}) => {
  if (activeTab !== value) return null;
  
  return (
    <div className="pt-4">
      {children}
    </div>
  );
};

SimpleTabs.List = SimpleTabsList;
SimpleTabs.Trigger = SimpleTabsTrigger;
SimpleTabs.TabsContent = SimpleTabsContent;

export { SimpleTabs };
export default SimpleTabs;
