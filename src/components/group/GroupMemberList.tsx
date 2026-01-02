import React from 'react';

// Match the actual member structure from Channel interface
interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
  role: number;
  joinedAt: number;
  state: number;
  lastMessageIndex: number;
  regNo: string;
  college?: string;
  profilePic: string;
  about: string;
}

interface GroupMemberListProps {
  members: GroupMember[];
}

export const GroupMemberList: React.FC<GroupMemberListProps> = ({ members }) => {
  const formatLastSeen = (timestamp?: number | null): string => {
    if (!timestamp) return 'a long time ago';
    
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const diff = now - timestamp;
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div className="space-y-4">
      {members.map((member) => (
        <div key={member.id} className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
          <div className="relative mr-3">
            <img 
              src={member.profilePic || member.avatar || '/default-avatar.svg'} 
              alt={member.name}
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                // Fallback to default avatar if image fails to load
                const target = e.target as HTMLImageElement;
                target.src = '/default-avatar.svg';
              }}
            />
            {member.isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            )}
          </div>
          <div>
            <div className="font-medium text-gray-900">{member.name}</div>
            <div className={`text-sm ${member.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
              {member.isOnline ? 'Online' : 'Offline'}
            </div>
            {member.college && (
              <div className="text-xs text-gray-400">{member.college}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
