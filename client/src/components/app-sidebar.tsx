import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "./role-badge";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Tags,
  Database,
  Radar,
  Users,
  Settings,
  LogOut,
  Lock,
  FileText,
  Image,
  Video,
  FileAudio,
  Languages,
  Building2,
  Wallet,
  Briefcase,
  Link as LinkIcon,
} from "lucide-react";
import type { UserRole } from "@shared/schema";

const modules = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    requiresRole: null,
  },
  {
    id: "nest_annotate",
    title: "NestAnnotate",
    icon: Tags,
    path: "/annotate",
    requiresRole: null,
    subItems: [
      { id: "text", title: "Text Label", icon: FileText, path: "/annotate/text" },
      { id: "image", title: "Image Label", icon: Image, path: "/annotate/image" },
      { id: "video", title: "Video Label", icon: Video, path: "/annotate/video" },
      { id: "transcription", title: "Transcription", icon: FileAudio, path: "/annotate/transcription" },
      { id: "translation", title: "Translation", icon: Languages, path: "/annotate/translation" },
    ],
  },
  {
    id: "data_nest",
    title: "DataNest",
    icon: Database,
    path: "/data",
    requiresRole: ["admin", "manager", "qa"],
    subItems: [
      { id: "firms", title: "Firms", icon: Building2, path: "/data/firms" },
      { id: "contacts", title: "Contacts", icon: Users, path: "/data/contacts" },
      { id: "funds", title: "Funds", icon: Wallet, path: "/data/funds" },
      { id: "deals", title: "Deals", icon: Briefcase, path: "/data/deals" },
    ],
  },
  {
    id: "extraction_engine",
    title: "Extraction Engine",
    icon: Radar,
    path: "/extraction",
    requiresRole: ["admin", "manager"],
  },
  {
    id: "contact_intelligence",
    title: "Contact Intelligence",
    icon: Users,
    path: "/intelligence",
    requiresRole: ["admin"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, hasModuleAccess } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            AN
          </div>
          <div>
            <h1 className="font-semibold text-lg">AnnoNest</h1>
            <p className="text-xs text-muted-foreground">Data Intelligence</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((module) => {
                const isLocked = module.requiresRole !== null && !hasModuleAccess(module.id);
                const isActive = location === module.path || location.startsWith(module.path + "/");

                return (
                  <SidebarMenuItem key={module.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive && !isLocked}
                      className={isLocked ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <Link
                        href={isLocked ? "#" : module.path}
                        onClick={(e) => isLocked && e.preventDefault()}
                        data-testid={`nav-${module.id}`}
                      >
                        <module.icon className="h-4 w-4" />
                        <span>{module.title}</span>
                        {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                      </Link>
                    </SidebarMenuButton>
                    {module.subItems && !isLocked && isActive && (
                      <div className="ml-6 mt-1 space-y-1">
                        {module.subItems.map((sub) => {
                          const subActive = location === sub.path;
                          return (
                            <SidebarMenuButton
                              key={sub.id}
                              asChild
                              isActive={subActive}
                              className="h-8"
                            >
                              <Link href={sub.path} data-testid={`nav-${module.id}-${sub.id}`}>
                                <sub.icon className="h-3 w-3" />
                                <span className="text-sm">{sub.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          );
                        })}
                      </div>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/settings" data-testid="nav-settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {user && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <RoleBadge role={user.role as UserRole} size="sm" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
