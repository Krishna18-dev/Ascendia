import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  Bookmark,
  Calendar,
  Trophy,
  Clock,
  ExternalLink,
  Trash2,
  BookOpen,
  Target,
  Sparkles,
  Bell,
} from "lucide-react";
import { mockSavedWorks } from "@/lib/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AchievementsWidget } from "@/components/Dashboard/AchievementsWidget";
import { StatisticsChart } from "@/components/Dashboard/StatisticsChart";
import { RecentActivity } from "@/components/Dashboard/RecentActivity";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const savedWorks = mockSavedWorks;
  const [profile, setProfile] = useState<{ full_name: string; learning_goals: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAchievementsCount();
      fetchStreak();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, learning_goals")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievementsCount = async () => {
    try {
      const { count } = await supabase
        .from("user_achievements")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user?.id);
      
      setTotalAchievements(count || 0);
    } catch (error) {
      console.error("Error fetching achievements count:", error);
    }
  };

  const fetchStreak = async () => {
    try {
      const { data, error } = await supabase
        .from("user_statistics")
        .select("date")
        .eq("user_id", user?.id)
        .order("date", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setStreak(0);
        return;
      }

      let count = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < data.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const entryDate = new Date(data[i].date + "T00:00:00");
        if (entryDate.getTime() === expected.getTime()) {
          count++;
        } else {
          break;
        }
      }
      setStreak(count);
    } catch (error) {
      console.error("Error fetching streak:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">
            Welcome back, <span className="text-primary">{profile?.full_name || "Learner"}</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Continue your learning journey and track your progress
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <Card className="p-4 sm:p-6 border hover:shadow-md transition-all">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Projects</p>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bookmark className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-display font-bold">{savedWorks.length}</p>
              <p className="text-xs text-muted-foreground">Active projects</p>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 border hover:shadow-md transition-all">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Skills</p>
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-display font-bold">{profile?.learning_goals?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Learning goals</p>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 border hover:shadow-md transition-all">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Streak</p>
                <div className="p-2 rounded-lg bg-accent/10">
                  <Calendar className="h-4 w-4 text-accent" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-display font-bold">{streak}</p>
              <p className="text-xs text-muted-foreground">Day streak</p>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 border hover:shadow-md transition-all">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Badges</p>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-display font-bold">{totalAchievements}</p>
              <p className="text-xs text-muted-foreground">Achievements</p>
            </div>
          </Card>
        </div>

        {/* Statistics and Achievements Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <StatisticsChart />
          <AchievementsWidget />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Saved Work and Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold">Your Projects</h2>
              <Button variant="outline" size="sm" onClick={() => navigate("/learn")}>
                View All
              </Button>
            </div>

            <div className="space-y-4">
              {savedWorks.map((work) => (
                <Card key={work.id} className="p-6 border hover:shadow-md transition-all">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1 truncate">{work.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span>Last modified: {formatDate(work.metadata.lastModified)}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize flex-shrink-0">
                        {work.tool}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Progress</span>
                        <span className="font-semibold">{work.progress}%</span>
                      </div>
                      <Progress value={work.progress} className="h-2" />
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => navigate(`/study/${work.tool}`)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Continue
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toast.info("Export feature coming soon!")}>
                        Export
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toast.info("Delete feature coming soon!")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {savedWorks.length === 0 && (
                <Card className="p-12 text-center border-dashed">
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto">
                      <Bookmark className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">No projects yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start creating amazing projects with AI tools
                      </p>
                    </div>
                    <Button onClick={() => navigate("/learn")}>Explore Tools</Button>
                  </div>
                </Card>
              )}
            </div>

            {/* Recent Activity */}
            <RecentActivity />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-6 border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/learn")}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Start New Course
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/study/games")}>
                  <Target className="mr-2 h-4 w-4" />
                  Practice Skills
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate("/roadmap")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  View Roadmap
                </Button>
              </div>
            </Card>

            {/* Skills */}
            <Card className="p-6 border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Your Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile?.learning_goals && profile.learning_goals.length > 0 ? (
                  profile.learning_goals.map((goal, index) => (
                    <Badge key={index} variant="secondary">
                      {goal}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No learning goals set yet</p>
                )}
              </div>
            </Card>

            {/* Learning Goals */}
            <Card className="p-6 border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Learning Goals
              </h3>
              <ul className="space-y-3">
                {profile?.learning_goals && profile.learning_goals.length > 0 ? (
                  profile.learning_goals.map((goal, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-sm text-foreground">{goal}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">
                    Set your learning goals in your profile
                  </li>
                )}
              </ul>
            </Card>

            {/* AI Recommendation */}
            <Card className="p-6 bg-gradient-primary text-white border-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-semibold">Recommended for You</h3>
                </div>
                <p className="text-sm text-white/90 leading-relaxed">
                  Based on your progress, we suggest exploring advanced video editing 
                  techniques this week!
                </p>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate("/study/content")}>
                  Explore Now
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
