'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  MessageSquare,
  Play,
  List,
  HelpCircle,
  DollarSign,
  Star,
  AlertCircle,
  Award,
  Flame,
  Bell,
} from 'lucide-react';

// Types
interface Task {
  id: string;
  client: string;
  sopType: string;
  dueTime: string;
  grainReward: number;
  urgency: 'high' | 'medium' | 'low';
}

interface Earning {
  id: string;
  taskName: string;
  timeAgo: string;
  grainEarned: number;
}

interface Notification {
  id: string;
  type: 'task' | 'message' | 'milestone';
  message: string;
  timeAgo: string;
}

interface Client {
  name: string;
  satisfaction: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export default function AgentDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mock Data
  const [stats] = useState({
    tasksDueToday: { count: 8, trend: '+2' },
    grainThisWeek: { amount: 1250, goal: 2000 },
    activeClients: { current: 10, max: 10 },
    efficiencyScore: 94,
  });

  const [urgentTasks] = useState<Task[]>([
    {
      id: '1',
      client: 'TechCorp',
      sopType: 'Candidate Outreach',
      dueTime: '30 min',
      grainReward: 150,
      urgency: 'high',
    },
    {
      id: '2',
      client: 'StartupXYZ',
      sopType: 'Interview Scheduling',
      dueTime: '1 hr',
      grainReward: 100,
      urgency: 'high',
    },
    {
      id: '3',
      client: 'MegaCorp',
      sopType: 'Resume Review',
      dueTime: '2 hrs',
      grainReward: 75,
      urgency: 'medium',
    },
    {
      id: '4',
      client: 'InnovateLabs',
      sopType: 'Client Update',
      dueTime: '3 hrs',
      grainReward: 50,
      urgency: 'medium',
    },
    {
      id: '5',
      client: 'FutureTech',
      sopType: 'Document Prep',
      dueTime: '4 hrs',
      grainReward: 60,
      urgency: 'low',
    },
  ]);

  const [recentEarnings] = useState<Earning[]>([
    { id: '1', taskName: 'Candidate Screening - DataCo', timeAgo: '15 min ago', grainEarned: 120 },
    { id: '2', taskName: 'Email Campaign - FinTech Inc', timeAgo: '1 hr ago', grainEarned: 150 },
    { id: '3', taskName: 'Interview Feedback - CloudSys', timeAgo: '2 hrs ago', grainEarned: 90 },
    { id: '4', taskName: 'Profile Update - AI Ventures', timeAgo: '3 hrs ago', grainEarned: 75 },
    { id: '5', taskName: 'Market Research - RetailHub', timeAgo: '5 hrs ago', grainEarned: 200 },
  ]);

  const [weeklyEarnings] = useState([180, 220, 195, 210, 185, 160, 100]);

  const [notifications] = useState<Notification[]>([
    { id: '1', type: 'task', message: 'New task assigned: Candidate Outreach', timeAgo: '5 min ago' },
    { id: '2', type: 'message', message: 'TechCorp sent you a message', timeAgo: '20 min ago' },
    { id: '3', type: 'milestone', message: 'You earned 1000 GRAIN this week!', timeAgo: '1 hr ago' },
  ]);

  const [atRiskClients] = useState<Client[]>([
    { name: 'RetailHub', satisfaction: 3.2, riskLevel: 'high' },
  ]);

  const [streak] = useState(14);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Authentication check
  useEffect(() => {
    if (isLoaded && (!user || !user.primaryEmailAddress?.emailAddress.endsWith('@wellsonyx.com'))) {
      router.push('/');
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getDailyTip = () => {
    const tips = [
      'Focus on high-GRAIN tasks during peak hours',
      'Maintain quality over speed for better client satisfaction',
      'Check your queue regularly for urgent updates',
      'Quick responses lead to higher efficiency scores',
      'Use AI assistance for complex SOPs',
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <List className="w-4 h-4 text-blue-400" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'milestone':
        return <Award className="w-4 h-4 text-yellow-400" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {getGreeting()}, {user.firstName || 'Agent'}
              </h1>
              <p className="text-gray-400 italic">{getDailyTip()}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 px-4 py-2 rounded-lg border border-orange-500/30">
                <Flame className="w-5 h-5 text-orange-400" />
                <div>
                  <div className="text-xs text-gray-400">Current Streak</div>
                  <div className="text-lg font-bold text-white">{streak} days</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Tasks Due Today */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                {stats.tasksDueToday.trend}
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.tasksDueToday.count}</div>
            <div className="text-sm text-gray-400">Tasks Due Today</div>
          </div>

          {/* GRAIN Earned This Week */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-yellow-500/20 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="text-xs text-gray-400">
                {Math.round((stats.grainThisWeek.amount / stats.grainThisWeek.goal) * 100)}% of goal
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.grainThisWeek.amount}</div>
            <div className="text-sm text-gray-400 mb-2">GRAIN This Week</div>
            <div className="w-full bg-gray-700/30 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((stats.grainThisWeek.amount / stats.grainThisWeek.goal) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Active Clients */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-500/20 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-xs text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                At Capacity
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats.activeClients.current}/{stats.activeClients.max}
            </div>
            <div className="text-sm text-gray-400">Active Clients</div>
          </div>

          {/* Efficiency Score */}
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-500/20 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                Excellent
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.efficiencyScore}%</div>
            <div className="text-sm text-gray-400">Efficiency Score</div>
          </div>
        </div>

        {/* Middle Row: Urgent Tasks & Recent Earnings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Urgent Tasks */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Urgent Tasks
              </h2>
              <button
                onClick={() => router.push('/ai-ops/queue')}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {urgentTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-white mb-1">{task.client}</div>
                      <div className="text-sm text-gray-400">{task.sopType}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs border ${getUrgencyColor(task.urgency)}`}>
                      {task.urgency}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span className="text-gray-300">Due in {task.dueTime}</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400 font-semibold">
                      <DollarSign className="w-4 h-4" />
                      {task.grainReward}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Earnings */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                Recent Earnings
              </h2>
              <button
                onClick={() => router.push('/ai-ops/earnings')}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                View Details <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              {recentEarnings.map((earning) => (
                <div key={earning.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/20 p-2 rounded">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{earning.taskName}</div>
                      <div className="text-xs text-gray-500">{earning.timeAgo}</div>
                    </div>
                  </div>
                  <div className="text-yellow-400 font-semibold">+{earning.grainEarned}</div>
                </div>
              ))}
            </div>

            {/* Mini Bar Chart */}
            <div className="border-t border-gray-700/50 pt-4">
              <div className="text-xs text-gray-400 mb-3">Last 7 Days</div>
              <div className="flex items-end justify-between gap-2 h-24">
                {weeklyEarnings.map((amount, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-gray-700/30 rounded-t relative" style={{ height: '100%' }}>
                      <div
                        className="w-full bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t absolute bottom-0"
                        style={{ height: `${(amount / Math.max(...weeklyEarnings)) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Client Satisfaction & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Satisfaction */}
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Client Satisfaction
              </h2>
              <button
                onClick={() => router.push('/ai-ops/clients')}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                Manage Clients <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Average Score */}
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-6 text-center flex-1">
                  <div className="text-4xl font-bold text-white mb-2">4.62</div>
                  <div className="text-sm text-gray-400">Average Score</div>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* At-Risk Clients */}
              <div>
                <div className="text-sm text-gray-400 mb-3">At-Risk Clients</div>
                {atRiskClients.length > 0 ? (
                  <div className="space-y-2">
                    {atRiskClients.map((client, index) => (
                      <div
                        key={index}
                        className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-white font-medium">{client.name}</div>
                          <div className="text-xs text-gray-400">Satisfaction: {client.satisfaction}/5</div>
                        </div>
                        <div className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                          Action Needed
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-400">All clients satisfied!</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Notifications */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push('/ai-ops/queue')}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg p-3 flex flex-col items-center gap-2 transition-all"
                >
                  <Play className="w-5 h-5" />
                  <span className="text-xs font-medium">Start Task</span>
                </button>
                <button
                  onClick={() => router.push('/ai-ops/queue')}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg p-3 flex flex-col items-center gap-2 transition-all"
                >
                  <List className="w-5 h-5" />
                  <span className="text-xs font-medium">Check Queue</span>
                </button>
                <button
                  onClick={() => router.push('/ai-ops/messages')}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg p-3 flex flex-col items-center gap-2 transition-all"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-xs font-medium">Messages</span>
                </button>
                <button
                  onClick={() => router.push('/ai-ops/ai-assist')}
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg p-3 flex flex-col items-center gap-2 transition-all"
                >
                  <HelpCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">AI Help</span>
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </h2>
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-3">
                    <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1">
                      <div className="text-sm text-white">{notification.message}</div>
                      <div className="text-xs text-gray-500">{notification.timeAgo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
