import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card } from './SimpleCard';
import { Button } from '@/components/ui/button';
import { TrendingUp, Brain, Target, Zap } from 'lucide-react';

interface BanditStat {
  id: string;
  user_state: string;
  user_action: string;
  reward: number;
  created_at: string;
  to_assist: boolean;
}

const BanditStatsPanel: React.FC = () => {
  const [banditStats, setBanditStats] = useState<BanditStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Computed statistics
  const totalStats = banditStats.length;
  const avgReward = totalStats > 0 
    ? banditStats.reduce((sum, stat) => sum + stat.reward, 0) / totalStats 
    : 0;
  const assistRate = totalStats > 0 
    ? (banditStats.filter((stat) => stat.to_assist).length / totalStats) * 100 
    : 0;
  const userStates = Array.from(new Set(banditStats.map((stat) => stat.user_state)));

  
  const loadBanditStats = async () => {
    setIsLoading(true);
    setError("");
    try {
      const stats = await invoke<BanditStat[]>("get_bandit_stats");
      setBanditStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to load bandit stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  const getActionColor = (action: string): string => {
    switch (action.toLowerCase()) {
      case "accept":
        return "text-green-600 bg-green-50";
      case "dismiss":
        return "text-red-600 bg-red-50";
      case "omit":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-blue-600 bg-blue-50";
    }
  };

  const getRewardColor = (reward: number): string => {
    if (reward > 0.5) return "text-green-600";
    if (reward > 0) return "text-yellow-600";
    return "text-red-600";
  };

  useEffect(() => {
    loadBanditStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            Assistant Statistics
          </h2>
          <p className="text-muted-foreground">
            Performance metrics and history of the assistant (contextual bandit)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadBanditStats}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card.Root>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Total Stats
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="text-2xl font-bold">{totalStats}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Assist Rate
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="text-2xl font-bold">{assistRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {banditStats.filter(s => s.to_assist).length} assisted
            </p>
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Avg Reward
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="text-2xl font-bold">{avgReward.toFixed(3)}</div>
            <p className="text-xs text-muted-foreground">Performance</p>
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              User States
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="text-2xl font-bold">{userStates.length}</div>
            <p className="text-xs text-muted-foreground">Unique states</p>
          </Card.Content>
        </Card.Root>
      </div>

      {/* Recent Stats Table */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Recent Activity</Card.Title>
          <Card.Description>
            Latest assistant interactions and user responses
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">State</th>
                  <th className="text-left p-2">Action</th>
                  <th className="text-left p-2">Reward</th>
                  <th className="text-left p-2">Assist</th>
                </tr>
              </thead>
              <tbody>
                {banditStats.slice(0, 10).map((stat, index) => (
                  <tr key={stat.id || index} className="border-b">
                    <td className="p-2">{formatDate(stat.created_at)}</td>
                    <td className="p-2">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                        {stat.user_state}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(stat.user_action)}`}>
                        {stat.user_action}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`font-mono text-sm ${getRewardColor(stat.reward)}`}>
                        {stat.reward.toFixed(3)}
                      </span>
                    </td>
                    <td className="p-2">
                      {stat.to_assist ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-gray-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {banditStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No statistics available yet
              </div>
            )}
          </div>
        </Card.Content>
      </Card.Root>

      {/* User State Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {userStates.map((state) => {
          const stateStats = banditStats.filter(s => s.user_state === state);
          const stateAvgReward = stateStats.length > 0 
            ? stateStats.reduce((sum, s) => sum + s.reward, 0) / stateStats.length 
            : 0;
          
          return (
            <Card.Root key={state}>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium">{state}</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="text-lg font-bold">{stateStats.length}</div>
                <p className="text-xs text-muted-foreground">
                  Avg reward: {stateAvgReward.toFixed(3)}
                </p>
              </Card.Content>
            </Card.Root>
          );
        })}
      </div>
    </div>
  );
};

export default BanditStatsPanel;
