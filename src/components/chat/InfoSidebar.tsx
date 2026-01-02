import { X, Bell, BellOff, Search, Image, File, Link, Users, Trash2, UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useChatContext } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MeshGradient } from "@paper-design/shaders-react";

interface InfoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  showMembers?: boolean;
}

const InfoSidebar = ({ isOpen, onClose, showMembers = false }: InfoSidebarProps) => {
  const { currentChannel, messages, deleteAllGroupMessages, deleteLoading, leaveGroup } = useChatContext();
  const [activeTab, setActiveTab] = useState<'info' | 'members'>(showMembers ? 'members' : 'info');
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Load all users on mount - ALWAYS call hooks first
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        const allUsersData = await invoke<string>('get_all_users');
        const parsedUsers = JSON.parse(allUsersData);
        setAllUsers(parsedUsers);
      } catch (error) {
        //console.error('Failed to load all users:', error);
      }
    };
    
    loadAllUsers();
  }, []);

  // Early return AFTER all hooks
  if (!currentChannel || !isOpen) return null;
  
  // Calculate media counts from actual message data
  const mediaCounts = messages.reduce((counts, message) => {
    if (message.message_type === 'file') {
      // Check if it's an image based on file extension or content
      const extension = message.content.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
        counts.photos++;
      } else {
        counts.files++;
      }
    } else if (message.message_type === 'text') {
      // Simple URL detection for links
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const links = message.content.match(urlRegex);
      if (links) {
        counts.links += links.length;
      }
    }
    return counts;
  }, { photos: 0, files: 0, links: 0 });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDeleteChat = async () => {
    if (!currentChannel) return;
    
    try {
      await deleteAllGroupMessages(currentChannel.id);
      setShowDeleteConfirm(false);
      onClose(); // Close the sidebar after successful deletion
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentChannel) return;
    
    try {
      await leaveGroup(currentChannel.id);
      setShowLeaveConfirm(false);
      onClose(); // Close the sidebar after successful leave
    } catch (error) {
      console.error('Failed to leave group:', error);
    }
  };

  const handleInviteUsers = async () => {
    if (!currentChannel || selectedUsers.length === 0) return;
    
    try {
      // Send invites to all selected users
      for (const userId of selectedUsers) {
        await invoke('invite_to_group', { groupId: currentChannel.id, userId });
      }
      
      // Reset and close modal
      setSelectedUsers([]);
      setShowInviteModal(false);
    } catch (error) {
      console.error('Failed to invite users:', error);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getAvailableUsers = () => {
    if (!currentChannel) return [];
    
    // Filter out users who are already in the group
    const memberIds = currentChannel.members?.map(m => m.id) || [];
    
    // Get all users from allUsers and filter out existing members
    const availableUsers = allUsers.filter(user => !memberIds.includes(user.base?.id || user.id));
    
    // Map to the expected format with proper profile data from actual API response
    return availableUsers.map(user => ({
      id: user.base?.id || user.id,
      name: user.base?.name || 'Unknown User',
      avatar: user.base?.profile, // API uses 'base.profile' field
      isOnline: user.is_online === true, // API uses 'is_online' field
      lastActive: user.last_seen,
      about: user.base?.about || 'No status',
      status: undefined,
    }));
  };

  const filteredAvailableUsers = getAvailableUsers().filter(user =>
    user.name.toLowerCase().includes(inviteSearch.toLowerCase())
  );

  return (
    <div 
      className={cn(
        'w-80 h-full bg-chat-sidebar border-l border-border flex flex-col duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="h-[48px] px-6 flex items-center justify-between border-b border-border">
        <h3 className="font-semibold text-foreground">
          {currentChannel.type === 'dm' ? 'Contact Info' : 'Group Info'}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs for Groups */}
      {currentChannel.type === 'group' && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              'flex-1 py-3 text-sm font-medium  ',
              activeTab === 'info'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'flex-1 py-3 text-sm font-medium  ',
              activeTab === 'members'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Members ({currentChannel.members?.length || 0})
          </button>
        </div>
      )}

      <ScrollArea className="flex-1">
        {activeTab === 'info' && (
          <div className="p-4 space-y-6">
            {/* Profile Section */}
            <div className="text-center">
              <div className="relative inline-block mb-4">
                {currentChannel.type === 'dm' ? (
                  <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                      {getInitials(currentChannel.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-24 w-24 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                {currentChannel.name}
              </h2>
              {currentChannel.type === 'dm' && currentChannel.members?.[0]?.college && (
                <p className="text-sm text-muted-foreground font-medium">
                  {currentChannel.members[0].college}
                </p>
              )}
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {muteNotifications ? (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Mute Notifications</span>
                </div>
                <Switch
                  checked={muteNotifications}
                  onCheckedChange={setMuteNotifications}
                />
              </div>
            </div>

            <Separator />

            {/* Media & Files */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Media & Files
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <button className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted  ">
                  <Image className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Photos</span>
                  <span className="text-sm font-semibold text-foreground">{mediaCounts.photos}</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted  ">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Files</span>
                  <span className="text-sm font-semibold text-foreground">{mediaCounts.files}</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted  ">
                  <Link className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Links</span>
                  <span className="text-sm font-semibold text-foreground">{mediaCounts.links}</span>
                </button>
              </div>
            </div>

            <Separator />

            {/* Group specific actions */}
            {currentChannel.type === 'group' && (
              <div className="space-y-2">
                <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-foreground">
                      <UserPlus className="h-4 w-4" />
                      Add Participants
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-[500px] bg-[#004FE5] border-0 shadow-2xl">
                    <DialogTitle className="sr-only">Add Participants</DialogTitle>
                    <DialogDescription className="sr-only">Invite users to join this group chat</DialogDescription>
                    <div className="relative">
                      {/* Mesh Gradient Background */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit]">
                        <MeshGradient
                          speed={1}
                          colors={["#2452F1", "#022474", "#163DB9", "#0B1D99"]}
                          distortion={0.8}
                          swirl={0.1}
                          grainMixer={0}
                          grainOverlay={0}
                          className="inset-0 sticky top-0"
                          style={{ height: "100%", width: "100%" }}
                        />
                      </div>
                      
                      {/* Content */}
                      <div className="relative z-10 flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4">
                          <div className="flex-1">
                            <h2 className="text-2xl font-semibold text-white leading-none tracking-[-0.03em]">
                              Add Participants
                            </h2>
                            <p className="text-sm text-white/80 mt-2 leading-normal">
                              Search and select users to add to this group
                            </p>
                          </div>
                          
                          {/* Close Button */}
                          <button
                            onClick={() => setShowInviteModal(false)}
                            className="flex h-8 w-8 items-center justify-center text-white/80 hover:text-white hover:bg-white/10   duration-200 rounded-lg"
                            aria-label="Close"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Form Content */}
                        <div className="flex-1 px-6 pb-6 overflow-y-auto space-y-4">
                          {/* Search */}
                          <div>
                            <label className="block text-[10px] font-mono font-normal text-white mb-2 tracking-[0.5px] uppercase">
                              Search Users *
                            </label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                              <input
                                placeholder="Search for users to invite..."
                                value={inviteSearch}
                                onChange={(e) => setInviteSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#001F63]/80 border border-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20   text-sm h-10"
                              />
                            </div>
                          </div>

                          {/* Users List */}
                          <div>
                            <label className="block text-[10px] font-mono font-normal text-white mb-2 tracking-[0.5px] uppercase">
                              Available Users
                            </label>
                            <ScrollArea className="h-64 rounded-lg bg-[#001F63]/30 border border-white/10">
                              <div className="p-2 space-y-2">
                                {filteredAvailableUsers.length === 0 ? (
                                  <p className="text-center text-white/60 py-8 text-sm">
                                    {inviteSearch ? 'No users found' : 'No available users to invite'}
                                  </p>
                                ) : (
                                  filteredAvailableUsers.map((user) => (
                                    <div
                                      key={user.id}
                                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10   cursor-pointer"
                                      onClick={() => toggleUserSelection(user.id)}
                                    >
                                      <div className="relative">
                                        <Avatar className="h-8 w-8">
                                          {user.avatar ? (
                                            <img 
                                              src={user.avatar} 
                                              alt={user.name}
                                              className="w-full h-full object-cover rounded-full"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                              }}
                                            />
                                          ) : null}
                                          <AvatarFallback className={cn(
                                            "bg-white/20 text-white text-xs",
                                            user.avatar && "hidden"
                                          )}>
                                            {getInitials(user.name)}
                                          </AvatarFallback>
                                        </Avatar>
                                        {user.isOnline && (
                                          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white/20" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                          {user.name}
                                        </p>
                                        <p className="text-xs text-white/70">
                                          {user.isOnline ? 'Online' : 'Offline'}
                                        </p>
                                      </div>
                                      <div className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center",
                                        selectedUsers.includes(user.id)
                                          ? "bg-white border-white"
                                          : "border-white/50"
                                      )}>
                                        {selectedUsers.includes(user.id) && (
                                          <Check className="h-3 w-3 text-[#004FE5]" />
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowInviteModal(false)}
                              className="flex-1 px-6 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20   tracking-[-0.03em] border border-white/20"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleInviteUsers}
                              disabled={selectedUsers.length === 0}
                              className="flex-1 px-6 py-3 rounded-lg bg-white text-[#004FE5] font-medium hover:bg-white/90   tracking-[-0.03em] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                            >
                              Invite {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Danger Zone */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete Chat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Chat</DialogTitle>
                  <DialogDescription>Are you sure you want to delete this chat? This action cannot be undone.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to permanently delete this chat? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteChat}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete Chat'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Leave Group - Only for groups, not DMs */}
            {currentChannel.type === 'group' && (
              <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-3 text-orange-600 hover:text-orange-600">
                    <Users className="h-4 w-4" />
                    Leave Group
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Leave Group</DialogTitle>
                    <DialogDescription>Are you sure you want to leave this group? You will need to be re-invited to join again.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Are you sure you want to leave this group? You will no longer receive messages from this group, but the group will remain for other members.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleLeaveGroup}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? 'Leaving...' : 'Leave Group'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {activeTab === 'members' && currentChannel.type === 'group' && (
          <div className="p-4 space-y-4">
            {/* Search Members */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search members..."
                className="w-full pl-9 pr-4 py-2 bg-muted/50 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Members List */}
            <div className="space-y-1">
              {currentChannel.members?.map((member) => {
                // Try to get full user details from allUsers using the actual API structure
                const fullUserDetails = allUsers.find(u => (u.base?.id || u.id) === member.id);
                const displayName = fullUserDetails?.base?.name || member.name || `Unknown User (${member.id.slice(0, 8)}...)`;
                const avatar = fullUserDetails?.base?.profile || member.profilePic || member.avatar;
                const isUnknown = displayName.includes('Unknown User');
                const memberRole = member.role || 0; // Default to 0 (regular member) if no role
                
                // Role mapping
                const getRoleName = (role: number) => {
                  switch (role) {
                    case 255: return 'Admin';
                    case 128: return 'Moderator';
                    case 1: return 'Member';
                    default: return 'Member';
                  }
                };
                
                const getRoleColor = (role: number) => {
                  switch (role) {
                    case 255: return 'bg-red-500/10 text-red-500 border-red-500/20';
                    case 128: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
                    default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
                  }
                };

                return (
                  <div
                    key={member.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50   cursor-pointer"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        {avatar ? (
                          <img 
                            src={avatar} 
                            alt={displayName}
                            className={cn(
                              "w-full h-full object-cover rounded-full",
                              isUnknown && "blur-lg"
                            )}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <AvatarFallback className={cn(
                          "text-sm",
                          avatar && "hidden"
                        )}>
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            "text-sm font-medium flex-1"
                          )}>
                            {displayName}
                          </p>
                          <Badge variant="outline" className={cn("text-xs px-2 py-0.5 flex-shrink-0", getRoleColor(memberRole))}>
                            {getRoleName(memberRole)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default InfoSidebar;
