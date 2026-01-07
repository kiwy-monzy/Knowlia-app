import StatusCard from "@/components/home/statusCard";
import Card from "@/components/home/card";
import Cal from "@/components/home/cal";
import Paper from "@/components/home/paper";
import FollowPathCanvas from "@/components/home/FollowPathCanvas";
import Watch from "@/components/home/Watch";
import { useState, useEffect } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import NewsCard from '@/components/home/NewsCard';
import { ScrollArea } from '@/components/ui/scroll-area';
//import Snowfall from "react-snowfall";
import React from "react";
import { GroupMemberList } from '@/components/group/GroupMemberList';

export interface NewsArticle {
  title: string;
  url: string;
  image: string;
  date: string;
  category: string;
  summary: string;
}

export interface NewsArticleDetail {
  title: string;
  url: string;
  image: string;
  date: string;
  category: string;
  content: string;
  author: string;
}

interface ScrapeResult {
  articles: NewsArticle[];
}

function Dashboard() {
  const { totalGroups, directChats, totalUnreadMessages, loading, currentChannel } = useChatContext();

  // News fetching logic using the same pattern as SiteContext, inlined here
  const [news, setUdsmNews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const [selectedArticle, setSelectedArticle] = useState<NewsArticleDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <ScrollArea className="h-full rounded-l-[2rem]  w-full bg-[#fafafa] justify-center items-center">
      {/* ==== Background Grid Overlay ==== */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#1a1a1a,transparent_1px),linear-gradient(to_bottom,#1a1a1a33_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
          {/* Snowfall effect 
          <div className="fixed inset-0 pointer-events-none z-50 hidden">
            <Snowfall 
              snowflakeCount={100}
              enable3DRotation={true}
              wind={[-0.2, 0.2]}
              style={{
                position: 'fixed',
                width: '100vw',
                height: '100vh',
              }}
            />
          </div>*/}
      <div className="relative z-10 w-full flex flex-col items-center">
          {/* ===================== HEADER ===================== */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-center font-luckiest-guy text-[#1a1a1a]">
            Dashboard
          </h1>
          <p className="mt-2 text-4xl md:text-5xl text-[#e10600] font-sister-spray">
            COICT
          </p>

          {/* ========== MAIN GRID (Moodle Details & Calendar) ========== */}
          <div className="w-full max-w-6xl mt-8 mb-8 grid gap-6 justify-items-center grid-cols-1 lg:grid-cols-[400px_1fr]">
            {/* ----- Moodle Details (Left) ----- */}
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              <div className="flex flex-col gap-4 w-full">
                <h1 className="text-2xl font-bold text-start font-luckiest-guy text-[#1a1a1a]">Info:</h1>
                
                {/* StatusCards */}
                <StatusCard 
                  id="groups" 
                  name="Total Groups" 
                  count={!loading ? totalGroups : 0} 
                  color="#1a1a1a" 
                />
                
                <StatusCard 
                  id="chats" 
                  name="Direct Chats" 
                  count={!loading ? directChats : 0} 
                  color="#1a1a1a" 
                />
                
                <StatusCard 
                  id="unread" 
                  name="Unread Messages" 
                  count={!loading ? totalUnreadMessages : 0} 
                  color="#1a1a1a" 
                />
              </div>
              
              {/* Group Members List */}
              {currentChannel && currentChannel.members && currentChannel.members.length > 0 && (
                <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
                  <h2 className="text-lg font-bold mb-3 text-[#1a1a1a]">Group Members</h2>
                  <GroupMemberList members={currentChannel.members} />
                </div>
              )}
              
              <div className="mt-8 flex flex-col items-center">
                {/* Analog Watch */}
                <div className="ml-28 -mt-6">
                  <h1 className="text-2xl font-bold ml-10 font-luckiest-guy text-[#1a1a1a]">Time:</h1>
                  <Watch />
                </div>
              </div>
            </div>

            {/* ----- Calendar Events (Right) ----- */}
            <div className="flex items-start justify-center gap-4 w-full">
              <div className="w-full">
                <h1 className="text-2xl font-bold text-start font-luckiest-guy text-[#1a1a1a]">Calendar:</h1>
                <Cal />
              </div>
            </div>

          </div>{/* END MAIN GRID */}

          {/* ========== DESIGN & VISUALS SECTION (currently hidden) ========== */}
          <div className="flex flex-col justify-center bg-[#1a1a1a] w-full items-center mt-20 mb-20 hidden">
            {/* You can enable this section if needed for visuals/models/cards */}
            <Card />
            <FollowPathCanvas />
            <Paper />
          </div>

          {/* ==== If you want to add more sections, follow this separator/comment pattern ==== */}
        </div>
      </ScrollArea>
    );
}

export default Dashboard;

