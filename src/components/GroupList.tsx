// GroupList.tsx
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, Clock, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import WebSocket from '@tauri-apps/plugin-websocket';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MeshGradient } from "@paper-design/shaders-react";

interface GroupSummaryPayload {
  id: string;
  name: string;
  group_type: string;
  status: string;
  member_count: number;
  unread_messages: number;
  created_at: number;
  last_message_at: number;
  last_message_sender?: string | null;
  last_message_preview?: string | null;
}

interface NodeInfo {
  id_base58: string;
  addresses: string[];
}

export function GroupList() {
  const [groups, setGroups] = useState<GroupSummaryPayload[]>([]);
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupSummaryPayload | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);
  const [groupDecodeError, setGroupDecodeError] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const setup = async () => {
      try {
        ws = await WebSocket.connect('ws://127.0.0.1:8765');
        wsRef.current = ws;
        setWsConnected(true);
        //console.log('✅ Connected to WebSocket server');

        ws.addListener((message) => {
          try {
            let messageText: string;
            if (typeof message === 'string') {
              messageText = message;
            } else if (message && typeof message === 'object' && 'data' in message) {
              messageText = (message as any).data;
            } else {
              messageText = JSON.stringify(message);
            }

            const msg = JSON.parse(messageText);
            //console.log('📨 WebSocket message received:', msg);
            if (msg.module === 'Node') {
              handleNodeMessage(msg);
            } else if (msg.module === 'Group') {
              handleGroupMessage(msg);
            } else if (msg.module === 'Chat') {
              handleChatMessage(msg);
            }
          } catch (e) {
            console.error('❌ Failed to parse WebSocket message:', e);
          }
        });
      } catch (e) {
        console.error('❌ Failed to connect to WebSocket:', e);
        setWsConnected(false);
      }
    };

    const handleNodeMessage = (msg: any) => {
      try {
        // Decode base64 data
        const dataBytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
        console.log('🖥️  Node data bytes length:', dataBytes.length);

        // Decode Node protobuf
          // Node message structure: oneof message { bool get_node_info = 1; NodeInformation info = 2; }
            if (dataBytes.length > 0) {
              const firstByte = dataBytes[0];
          const wireType = firstByte & 0x7;
          const fieldNumber = firstByte >> 3;

              if (fieldNumber === 2 && wireType === 2) {
            // This is NodeInformation (info field)
                let offset = 1;
                let length = 0;
                let shift = 0;
                while (offset < dataBytes.length) {
                  const byte = dataBytes[offset++];
                  length |= (byte & 0x7F) << shift;
                  if ((byte & 0x80) === 0) break;
                  shift += 7;
                }
                
                const infoBytes = dataBytes.slice(offset, offset + length);
                let infoOffset = 0;
                let nodeId = '';
                const addresses: string[] = [];
                
                while (infoOffset < infoBytes.length) {
                  const tag = infoBytes[infoOffset++];
                  const fieldNum = tag >> 3;
                  const wireType = tag & 0x7;
                  
              if (wireType === 2) {
                    let strLength = 0;
                    let strShift = 0;
                    while (infoOffset < infoBytes.length) {
                      const byte = infoBytes[infoOffset++];
                      strLength |= (byte & 0x7F) << strShift;
                      if ((byte & 0x80) === 0) break;
                      strShift += 7;
                    }
                    
                    const strBytes = infoBytes.slice(infoOffset, infoOffset + strLength);
                    const str = new TextDecoder().decode(strBytes);
                    infoOffset += strLength;
                    
                    if (fieldNum === 1) {
                      nodeId = str;
                    } else if (fieldNum === 2) {
                      addresses.push(str);
                    }
                  }
                }
                
            const nodeInfo: NodeInfo = {
                  id_base58: nodeId,
                  addresses: addresses,
            };

            console.log('🖥️  Decoded Node Info:', nodeInfo);
            setNodeInfo(nodeInfo);
              }
            }
          } catch (e) {
        console.error('❌ Failed to decode Node message:', e);
      }
    };

    const handleGroupMessage = (msg: any) => {
      try {
        if (msg.decoded && msg.decoded.type === 'GroupListResponse' && Array.isArray(msg.decoded.groups)) {
          const summaries: GroupSummaryPayload[] = msg.decoded.groups.map((raw: any) => normalizeSummary(raw));
          setGroups(summaries);
          setGroupDecodeError(false);
          return;
        }

        // Decode base64 data (fallback)
        const dataBytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
        console.log('[DEBUG] Raw incoming group base64 decoded (top):', dataBytes);
        if (dataBytes.length > 0) {
          const firstByte = dataBytes[0];
          const wireType = firstByte & 0x7;
          const fieldNumber = firstByte >> 3;

          if (fieldNumber === 1 && wireType === 2) {
            let offset = 1;
            let length = 0;
            let shift = 0;
            while (offset < dataBytes.length) {
              const byte = dataBytes[offset++];
              length |= (byte & 0x7F) << shift;
              if ((byte & 0x80) === 0) break;
              shift += 7;
            }
            const responseBytes = dataBytes.slice(offset, offset + length);
            console.log('[DEBUG] GroupListResponse envelope payload:', responseBytes);
            const groups = decodeGroupListResponse(responseBytes);
            console.log('[DEBUG] Decoded groups:', groups);
            setGroups(groups);
            setGroupDecodeError(groups.length === 0);
            return;
          }
        }

        console.warn('[WARN] Unable to decode group message');
        setGroupDecodeError(true);
      } catch (e) {
        setGroupDecodeError(true);
        console.error('❌ Failed to decode Group message:', e);
      }
    };

    // Handle Chat/ConversationList messages from backend
    const handleChatMessage = (msg: any) => {
      try {
        const dataBytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
        if (!selectedGroup) return;
        // 1st byte: field number & wire type for ConversationList (field 4, wiretype 2)
        let offset = 0;
        const fieldKey = dataBytes[offset++] || 0;
        if ((fieldKey >> 3) === 4 && (fieldKey & 0x7) === 2) {
          // Length-delimited ConversationList
          let length = 0, shift = 0;
          while (offset < dataBytes.length) {
            const byte = dataBytes[offset++];
            length |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
          }
          const convoBytes = dataBytes.slice(offset, offset+length);
          // Start parsing convoBytes for message_list (field 2)
          let convoOffset = 0;
          let msgs: any[] = [];
          while (convoOffset < convoBytes.length) {
            const tag = convoBytes[convoOffset++];
            const fieldNum = tag >> 3;
            const wireType = tag & 0x7;
            if (fieldNum === 2 && wireType === 2) {
              // ChatMessage
              let l=0, sh=0;
              while (convoOffset < convoBytes.length) {
                const byte = convoBytes[convoOffset++];
                l |= (byte & 0x7F) << sh;
                if ((byte & 0x80) === 0) break;
                sh += 7;
              }
              const msgBytes = convoBytes.slice(convoOffset, convoOffset+l);
              convoOffset += l;
              // For now just show plain hex/raw content - see message proto fields in chat.proto
              msgs.push(parseChatMessage(msgBytes));
            } else {
              // skip unknown
              break;
            }
          }
          setMessages(msgs);
        }
      } catch (e) {
        console.error('Failed to decode conversation', e);
      }
      setLoadingMessages(false);
    };

    function parseChatMessage(bytes: Uint8Array): any {
      let offset = 0;
      let index = 0;
      let sender_id = '';
      let sent_at = 0;
      let content = '';
      while (offset < bytes.length) {
        const tag = bytes[offset++];
        const fieldNum = tag >> 3;
        const wireType = tag & 0x7;
        if (wireType === 0) {
          // Varint
          let value = 0, shift = 0;
          while (offset < bytes.length) {
            const byte = bytes[offset++];
            value |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
          }
          if (fieldNum === 1) index = value;
          else if (fieldNum === 6) sent_at = value;
        } else if (wireType === 2) {
          let len = 0, lshift = 0;
          while (offset < bytes.length) {
            const byte = bytes[offset++];
            len |= (byte & 0x7F) << lshift;
            if ((byte & 0x80) === 0) break;
            lshift += 7;
          }
          const data = bytes.slice(offset, offset+len);
          offset += len;
          if (fieldNum === 2) sender_id = Array.from(data).map(b => String.fromCharCode(b)).join('');
          else if (fieldNum === 8) content = new TextDecoder().decode(data);
        }
      }
      return { index, sender_id, sent_at, content };
    }

    const decodeGroupListResponse = (bytes: Uint8Array): GroupSummaryPayload[] => {
      const groups: GroupSummaryPayload[] = [];
      let offset = 0;

      // Decode repeated GroupInfo (field 1 in GroupListResponse)
      while (offset < bytes.length) {
        const tag = bytes[offset++];
        const fieldNum = tag >> 3;
        const wireType = tag & 0x7;

        if (fieldNum === 1 && wireType === 2) {
          // This is a GroupInfo message
          let groupLength = 0;
          let shift = 0;
          while (offset < bytes.length) {
            const byte = bytes[offset++];
            groupLength |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
          }

          const groupBytes = bytes.slice(offset, offset + groupLength);
          const group = decodeGroupInfo(groupBytes);
          if (group) {
            groups.push(group);
          }
          offset += groupLength;
        } else {
          break;
        }
      }

      return groups;
    };

    const decodeGroupInfo = (bytes: Uint8Array): GroupSummaryPayload | null => {
      try {
        let offset = 0;
        let groupIdBytes: number[] = [];
        let name = '';
        let createdAt = 0;
        let members: string[] = [];
        let isDirectChat = false;
        let status = 0;
        let unreadMessages = 0;
        let lastMessageAt = 0;
        let lastMessageSenderId = '';

        while (offset < bytes.length) {
          const tag = bytes[offset++];
          const fieldNum = tag >> 3;
          const wireType = tag & 0x7;

          if (wireType === 2) {
            let length = 0;
            let shift = 0;
            while (offset < bytes.length) {
              const byte = bytes[offset++];
              length |= (byte & 0x7F) << shift;
              if ((byte & 0x80) === 0) break;
              shift += 7;
            }

            const data = bytes.slice(offset, offset + length);
            offset += length;

            if (fieldNum === 1) {
              groupIdBytes = Array.from(data);
            } else if (fieldNum === 2) {
              // group_name (string)
              name = new TextDecoder().decode(data);
            } else if (fieldNum === 3) {
              // created_at (uint64)
              createdAt = decodeVarint(data);
            } else if (fieldNum === 4) {
              // members (repeated)
              // This is a nested message, decode it
              const memberId = Array.from(data).map(b => String.fromCharCode(b)).join('');
              members.push(memberId);
            } else if (fieldNum === 5) {
              // is_direct_chat (bool)
              isDirectChat = data[0] !== 0;
            } else if (fieldNum === 6) {
              // status (enum)
              status = decodeVarint(data);
            } else if (fieldNum === 7) {
              // unread_messages (uint32)
              unreadMessages = decodeVarint(data);
            } else if (fieldNum === 8) {
              // last_message_at (uint64)
              lastMessageAt = decodeVarint(data);
            } else if (fieldNum === 9) {
              // last_message_sender_id (bytes)
              lastMessageSenderId = Array.from(data).map(b => String.fromCharCode(b)).join('');
            }
          } else if (wireType === 0) {
            // Varint
            let value = 0;
            let shift = 0;
            while (offset < bytes.length) {
              const byte = bytes[offset++];
              value |= (byte & 0x7F) << shift;
              if ((byte & 0x80) === 0) break;
              shift += 7;
            }

            if (fieldNum === 3) {
              createdAt = value;
            } else if (fieldNum === 6) {
              status = value;
            } else if (fieldNum === 7) {
              unreadMessages = value;
            } else if (fieldNum === 8) {
              lastMessageAt = value;
            }
          }
        }

        const id = groupIdBytes.length ? encodeIdBytes(groupIdBytes) : '';

        return {
          id,
          name: name || 'Unnamed Group',
          created_at: createdAt,
          group_type: isDirectChat ? 'Direct' : 'Group',
          status: statusToString(status),
          member_count: members.length,
          unread_messages: unreadMessages,
          last_message_at: lastMessageAt,
          last_message_sender: lastMessageSenderId || null,
          last_message_preview: null,
        };
      } catch (e) {
        console.error('❌ Failed to decode GroupInfo:', e);
        return null;
      }
    };

    const decodeVarint = (bytes: Uint8Array): number => {
      let value = 0;
      let shift = 0;
      for (let i = 0; i < bytes.length; i++) {
        value |= (bytes[i] & 0x7F) << shift;
        if ((bytes[i] & 0x80) === 0) break;
        shift += 7;
      }
      return value;
    };

    const normalizeSummary = (raw: any): GroupSummaryPayload => {
      return {
        id: typeof raw.id === 'string' ? raw.id : '',
        name: typeof raw.name === 'string' ? raw.name : 'Unnamed Group',
        group_type: typeof raw.group_type === 'string' ? raw.group_type : (raw.direct_chat ? 'Direct' : 'Group'),
        status: typeof raw.status === 'string' ? raw.status : statusToString(raw.status ?? 0),
        member_count: typeof raw.member_count === 'number' ? raw.member_count : (raw.members_count ?? 0),
        unread_messages: typeof raw.unread_messages === 'number' ? raw.unread_messages : 0,
        created_at: typeof raw.created_at === 'number' ? raw.created_at : 0,
        last_message_at: typeof raw.last_message_at === 'number' ? raw.last_message_at : 0,
        last_message_sender: raw.last_message_sender ?? raw.last_message_sender_id ?? null,
        last_message_preview: raw.last_message_preview ?? null,
      };
    };

    const encodeIdBytes = (bytes: number[]): string => {
      if (bytes.length === 16) {
        const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    };

    const statusToString = (value: number): string => {
      switch (value) {
        case 0:
          return 'Active';
        case 1:
          return 'Invite Accepted';
        case 2:
          return 'Deactivated';
        default:
          return 'Unknown';
      }
    };

    setup();
    return () => {
      if (ws) {
        ws.disconnect();
        setWsConnected(false);
      }
    };
  }, [selectedGroup]);

  // Function to request messages for group
  const fetchGroupMessages = (group: GroupSummaryPayload) => {
    setLoadingMessages(true);
    setSelectedGroup(group);
    setMessages([]);
    const group_id_bytes = idStringToBytes(group.id);
    const req = buildConversationRequest(group_id_bytes, 0);
    if (wsRef.current && wsRef.current.send) {
      // Option 1: Base64 encode (if backend tolerates it as string). Replace with binary if needed.
      const payload = uint8ToBase64(req);
      wsRef.current.send(payload);
    } else if (wsRef.current) {
      // fallback: try sending as a string (may not work if binary expected)
      wsRef.current.send(JSON.stringify(Array.from(req)));
    }
  };

  function base58ToBytes(str: string): Uint8Array {
    // Minimal base58 decode for ASCII
    // You can improve (use a package) if needed. Here we assume ASCII mapping for minimal demo.
    // Real impl: npm bs58 for non-demo.
    const alpha = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n = BigInt(0);
    for (let c of str) {
      let p = BigInt(alpha.indexOf(c));
      if (p === -1n) continue;
      n = n * 58n + p;
    }
    let out: number[] = [];
    while (n > 0) {
      out.push(Number(n % 256n));
      n = n / 256n;
    }
    return new Uint8Array(out.reverse());
  }

  function buildConversationRequest(group_id_bytes: Uint8Array, last_index: number) {
    // See chat.proto: Chat{ oneof msg { ConversationRequest: field 3 } }
    // field 3, wire=2; value = [group_id_bytes, last_index = 0u64]
    let arr = [ (3<<3)|2 ]; // field 3, wire 2
    // GroupID field (field 1, wire type 2):
    arr.push((1<<3)|2);
    arr.push(group_id_bytes.length);
    arr = arr.concat(Array.from(group_id_bytes));
    // last_index field (field 2, wire type 0):
    arr.push((2<<3)|0);
    let n = last_index;
    do {
      let b = n & 0x7F;
      n >>>= 7;
      if (n !== 0) b |= 0x80;
      arr.push(b);
    } while (n !== 0);
    // wrap with Chat envelope: field 3 (ConversationRequest)
    // not strictly proper proto (for working demo, replace with backend rpc if needed)
    return new Uint8Array(arr);
  }

  function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunk)));
    }
    return btoa(binary);
  }

  function idStringToBytes(id: string): Uint8Array {
    if (!id) return new Uint8Array();
    if (id.includes('-')) {
      return uuidStringToBytes(id);
    }
    return base58ToBytes(id);
  }

  function uuidStringToBytes(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32) return new Uint8Array();
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  // UI with Node info and Groups
  return (
    <div className="w-full h-full bg-background p-6">
      {/* Node Information Display */}
      {nodeInfo && (
        <Card className="mb-6 border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Addresses ({nodeInfo.addresses.length}):</span>
              <ul className="list-disc list-inside space-y-1 mt-1">
                {nodeInfo.addresses.map((addr, idx) => (
                  <li key={idx} className="text-sm font-mono">{addr}</li>
                ))}
              </ul>
            </div>
          </CardHeader>
        </Card>
      )}

      {groupDecodeError && (
        <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-red-800 mb-4 text-sm">
          Error: Group list could not be decoded from backend proto! See console for details and check backend group proto envelope matches expected GroupListResponse.
        </div>
      )}

      {/* Groups Display */}
      <div className="flex flex-row w-full gap-8">
        <div className="flex-1">
          {groups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">No groups yet</p>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Groups you join or create will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <Card
                  key={group.id}
                  className={
                    'hover:shadow-md transition-all duration-200 cursor-pointer border hover:border-primary/50' +
                    (selectedGroup?.id === group.id
                      ? ' border-2 border-blue-600 ring-2 ring-blue-200 bg-blue-50'
                      : '')
                  }
                  onClick={() => fetchGroupMessages(group)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold text-foreground line-clamp-1">
                        {group.name}
                      </CardTitle>
                      {group.unread_messages > 0 && (
                        <Badge variant="default" className="ml-2 bg-primary text-primary-foreground font-semibold min-w-[1.5rem] justify-center">
                          {group.unread_messages > 99 ? '99+' : group.unread_messages}
                        </Badge>
                      )}
                    </div>
                    {group.group_type === 'Direct' && (
                      <Badge variant="outline" className="mt-2 w-fit text-xs">Direct Chat</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</span>
                    </div>
                    {group.last_message_at > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(group.last_message_at)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={group.status === 'Active' ? "default" : "secondary"}
                          className={cn(group.status === 'Active' && "bg-green-500 hover:bg-green-600", "text-white")}>
                          {group.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        {/* Right pane: Conversation if selected */}
        {selectedGroup && (
          <div className="flex-[2] max-w-2xl bg-popover border rounded-xl ml-4 p-4 relative">
            <h2 className="font-bold text-lg mb-2">Conversation: {selectedGroup.name}</h2>
            {loadingMessages && <div className="text-sm">Loading messages...</div>}
            {!loadingMessages && <ScrollArea className="h-[50vh]">
              <div className="flex flex-col gap-3">
                {messages.length === 0 && <span className="text-sm">No messages yet.</span>}
                {messages.map((msg, i) => (
                  <div key={i} className="rounded p-2 border bg-background mb-1">
                    <span className="font-mono text-xs text-muted-foreground mr-2">{msg.sender_id.slice(0,8)}</span>
                    <span>{msg.content}</span>
                    <span className="block text-xs text-right text-muted-foreground">{msg.sent_at > 0 ? formatDate(msg.sent_at) : ''}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>}
          </div>
        )}
      </div>
    </div>
  );
}

// Keep your formatDate function exactly as you had it
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}