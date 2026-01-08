import StatusCard from "@/components/home/statusCard";
import Card from "@/components/home/card";
import Cal from "@/components/home/cal";
import Paper from "@/components/home/paper";
import FollowPathCanvas from "@/components/home/FollowPathCanvas";
import Watch from "@/components/home/Watch";
import { useState, useEffect } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { invoke } from '@tauri-apps/api/core';
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

  // Focus state tracking
  const [isAppFocused, setIsAppFocused] = useState(true);

  // Debug logging to track real-time updates
  useEffect(() => {
    console.log('Dashboard data updated:', {
      totalGroups,
      directChats,
      totalUnreadMessages,
      loading
    });
  }, [totalGroups, directChats, totalUnreadMessages, loading]);

  // Track app focus/blur events
  useEffect(() => {
    const handleFocus = () => {
      setIsAppFocused(true);
      console.log('App gained focus - background sync active');
    };

    const handleBlur = () => {
      setIsAppFocused(false);
      console.log('App lost focus - background sync paused');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Start background data sync service
  useEffect(() => {
    const startBackgroundService = async () => {
      try {
        await invoke('start_background_data_sync_service');
        console.log('Background data sync service started');
      } catch (error) {
        console.error('Failed to start background data sync service:', error);
      }
    };
    
    startBackgroundService();
  }, []);

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

          {/* ========== HORIZONTAL STATUS CARDS ========== */}
          <div className="w-full max-w-6xl mt-8 mb-6">
            <div className="flex flex-wrap gap-4 justify-center items-center">
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
          </div>

          {/* ========== MAIN GRID (Calendar & Clock) ========== */}
          <div className="w-full max-w-6xl mt-6 grid gap-4 justify-items-center grid-cols-1 lg:grid-cols-[280px_1fr] lg:items-start">
            {/* ----- Clock (Left) ----- */}
            <div className="flex flex-col items-center justify-center">
              <div className="-mt-6">
                <h1 className="text-2xl font-bold font-luckiest-guy text-[#1a1a1a] text-center">Time:</h1>
                <Watch />
              </div>
            </div>

            {/* ----- Calendar Events (Right) ----- */}
            <div className="w-full">
              <h1 className="text-2xl font-bold text-start font-luckiest-guy text-[#1a1a1a] mb-4">Calendar:</h1>
              <Cal />
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

