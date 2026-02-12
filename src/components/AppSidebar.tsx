import { MessageSquare, FileText, Briefcase, Gamepad2, User, LogOut, Home, ArrowLeft, Youtube } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Study Chat", url: "/study/chat", icon: MessageSquare },
  { title: "Content Generator", url: "/study/content", icon: FileText },
  { title: "Mock Interview", url: "/study/interview", icon: Briefcase },
  { title: "Learning Games", url: "/study/games", icon: Gamepad2 },
  { title: "Video Notes", url: "/study/video-notes", icon: Youtube },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b">
        {!isCollapsed && (
          <Link
            to="/dashboard"
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm font-medium mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        )}
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <h2 className="font-semibold text-sm">Ascendia Study</h2>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className={`h-5 w-5 ${isCollapsed ? "mx-auto" : "mr-3"}`} />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!isCollapsed && (
        <div className="p-4 border-t mt-auto">
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </Sidebar>
  );
}
