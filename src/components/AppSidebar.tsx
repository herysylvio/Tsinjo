import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeftRight, MessageCircle, Settings, LogOut, Target, PiggyBank, Crown } from 'lucide-react';
import tsinjoLogo from '@/assets/tsinjo-logo.png';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/transactions', icon: ArrowLeftRight, labelKey: 'nav.transactions' },
  { path: '/budgets', icon: Target, labelKey: 'nav.budgets' },
  { path: '/savings', icon: PiggyBank, labelKey: 'nav.savings' },
  { path: '/chat', icon: MessageCircle, labelKey: 'nav.chat' },
  
  { path: '/premium', icon: Crown, labelKey: 'premium.title' },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { isPremium } = useSubscription();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  const initials = (profile?.display_name || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5">
          <img src={tsinjoLogo} alt="Tsinjo" className="h-9 w-9 shrink-0 rounded-lg animate-scale-in" />
          {!collapsed && (
            <span className="text-lg font-heading font-bold text-foreground tracking-tight">
              Tsinjo
            </span>
          )}
        </div>

        {/* Account switcher */}
        <div className="px-2 pb-2">
          <AccountSwitcher collapsed={collapsed} />
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                const isPremiumHighlight = item.path === '/premium' && !isPremium && !isActive;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.path}
                        end
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary/15 text-primary'
                            : isPremiumHighlight
                              ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 text-amber-500 animate-glow-pulse'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`}
                        activeClassName="bg-primary/15 text-primary"
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${isPremiumHighlight ? 'text-amber-500' : ''}`} />
                        {!collapsed && <span>{t(item.labelKey)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {/* Profile banner */}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-3 w-full rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors text-left"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.display_name || t('settings.profile')}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          )}
        </button>

        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start gap-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{t('auth.sign_out')}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
