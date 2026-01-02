import { useState } from 'react';
import { ArrowLeft, Users, Clock, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChatContext } from '@/contexts/ChatContext';
import NoContent from '@/components/NoContent';
import { MeshGradient } from "@paper-design/shaders-react";

const RequestPage = () => {
  const { setCurrentView, invitations, invitationsLoading, replyToInvitation, allUsers } = useChatContext();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const handleReply = async (groupId: string, accept: boolean) => {
    setProcessingIds(prev => new Set(prev).add(groupId));
    
    try {
      await replyToInvitation(groupId, accept);
      
      // Add a small delay to show the processing state before the UI updates
      setTimeout(() => {
        setProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(groupId);
          return newSet;
        });
      }, 500);
    } catch (error) {
      console.error('Failed to reply to invitation:', error);
      // Remove from processing even on error
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatReceivedTime = (timestamp: number) => {
    const now = new Date();
    const date = new Date(timestamp * 1000);
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatGroupId = (groupId: number[] | string | any): string => {
    // Handle different types of group_id
    if (Array.isArray(groupId)) {
      return groupId.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof groupId === 'string') {
      // If it's already a string, return it as-is
      return groupId;
    } else if (groupId && typeof groupId === 'object') {
      // Handle case where groupId might be an object with array-like structure
      try {
        const idStr = String(groupId);
        return idStr;
      } catch {
        return 'unknown';
      }
    }
    return 'unknown';
  };

  const bytesToBase58 = (bytes: number[]): string => {
    // Simple base58 encoding for PeerId bytes
    // This is a basic implementation - for production use, consider using a proper base58 library
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(0);
    
    // Convert bytes to a big number
    for (let i = 0; i < bytes.length; i++) {
      num = (num << BigInt(8)) + BigInt(bytes[i]);
    }
    
    // Convert to base58
    let result = '';
    while (num > 0n) {
      const remainder = num % BigInt(58);
      result = alphabet[Number(remainder)] + result;
      num = num / BigInt(58);
    }
    
    return result || '1';
  };

  const getSenderName = (invitation: any) => {
    // First try to find sender in group members with multiple ID format checks
    let senderMember = invitation.group.members.find((member: any) => {
      // Check if member.user_id matches sender_id (handle different formats)
      if (Array.isArray(member.user_id) && Array.isArray(invitation.sender_id)) {
        // Compare arrays byte by byte
        return member.user_id.length === invitation.sender_id.length &&
               member.user_id.every((byte: number, index: number) => byte === invitation.sender_id[index]);
      } else if (typeof member.user_id === 'string' && typeof invitation.sender_id === 'string') {
        // Compare strings directly
        return member.user_id === invitation.sender_id;
      } else if (Array.isArray(member.user_id) && typeof invitation.sender_id === 'string') {
        // Convert member.user_id array to hex string and compare
        const memberHex = member.user_id.map((b: number) => b.toString(16).padStart(2, '0')).join('');
        return memberHex === invitation.sender_id;
      } else if (typeof member.user_id === 'string' && Array.isArray(invitation.sender_id)) {
        // Convert invitation.sender_id array to hex string and compare
        const senderHex = invitation.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('');
        return member.user_id === senderHex;
      }
      return false;
    });
    
    if (senderMember?.name && senderMember.name !== 'Unknown User') {
      return senderMember.name;
    }

    // Try multiple approaches to find sender in allUsers
    let sender = null;
    
    // Method 1: Try base58 conversion of sender_id
    if (Array.isArray(invitation.sender_id)) {
      const senderIdBase58 = bytesToBase58(invitation.sender_id);
      sender = allUsers.find((user: any) => user.id === senderIdBase58);
    }
    
    // Method 2: Try hex string conversion
    if (!sender && Array.isArray(invitation.sender_id)) {
      const senderIdHex = invitation.sender_id.map((b: number)=> b.toString(16).padStart(2, '0')).join('');
      sender = allUsers.find((user: any) => user.id === senderIdHex || user.q8id === senderIdHex);
    }
    
    // Method 3: Try direct string comparison
    if (!sender && typeof invitation.sender_id === 'string') {
      sender = allUsers.find((user: any) => user.id === invitation.sender_id || user.q8id === invitation.sender_id);
    }
    
    // Method 4: Try to find by name in group members as fallback
    if (!sender && senderMember?.name) {
      return senderMember.name;
    }
    
    return sender?.name || senderMember?.name || 'Unknown User';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden hover:bg-muted/50  "
            onClick={() => setCurrentView('chat')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-foreground">Group Invitations</h1>
              <p className="text-xs text-muted-foreground">
                {invitationsLoading ? 'Loading invitations...' : `${invitations.length} pending invitation${invitations.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Invitations List */}
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6">
          {invitationsLoading ? (
            <NoContent title="LOADING" className="h-64" />
          ) : invitations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitations.map((invitation) => {
                const groupId = formatGroupId(invitation.group.group_id);
                const isProcessing = processingIds.has(groupId);
                const senderName = getSenderName(invitation);
                
                return (
                  <Card key={groupId} className="bg-cyan-600 hover:bg-cyan-500  duration-200 border-cyan-500 hover:border-cyan-400 shadow-lg hover:shadow-xl">
                    <div className="p-4">
                      <div className="flex flex-col h-full">
                        {/* Sender Avatar */}
                        <div className="flex justify-center mb-3">
                          <Avatar className="h-12 w-12 ring-2 ring-white/20">
                            <AvatarFallback className="bg-white/20 text-white font-semibold text-sm border border-white/30">
                              {'IG'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        {/* Content */}
                        <div className="text-center space-y-2 flex-1">
                          <p className="text-white font-medium text-sm leading-tight">
                            You've been invited to join
                          </p>
                          <p className="text-white font-bold text-base truncate">
                            {invitation.group.group_name}
                          </p>
                          <p className="text-cyan-100 text-xs">
                            {formatReceivedTime(invitation.received_at)}
                          </p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-9 bg-white text-cyan-600 hover:bg-cyan-50 font-medium text-xs  "
                            onClick={() => handleReply(groupId, true)}
                            disabled={isProcessing}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {isProcessing ? 'Processing...' : 'Accept'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 bg-white/10 text-white border-white/30 hover:bg-white/20 font-medium text-xs  "
                            onClick={() => handleReply(groupId, false)}
                            disabled={isProcessing}
                          >
                            <X className="h-3 w-3 mr-1" />
                            {isProcessing ? 'Processing...' : 'Deny'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <NoContent title="EMPTY" className="h-64" />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RequestPage;