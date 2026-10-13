import { useEffect } from "react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import i18next from "i18next";
import AppLayout from "./components/AppLayout";
import AnimatedRoutes from "./components/AnimatedRoutes";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import ChatAI from "./pages/ChatAI";

import Settings from "./pages/Settings";
import Budgets from "./pages/Budgets";
import Savings from "./pages/Savings";
import Premium from "./pages/Premium";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import "./i18n/config";

const isJwtError = (error: any) => {
  const msg = error?.message || error?.error_description || '';
  return msg.includes('JWT expired') || msg.includes('jwt expired') || error?.status === 401;
};

let globalSignOut: (() => void) | null = null;
export const setGlobalSignOut = (fn: () => void) => { globalSignOut = fn; };

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (isJwtError(error) && globalSignOut) {
        globalSignOut();
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (count, error: any) => {
        if (isJwtError(error)) return false;
        return count < 3;
      },
    },
    mutations: {
      onError: (error: any) => {
        if (isJwtError(error) && globalSignOut) {
          globalSignOut();
        }
      },
    },
  },
});

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-onboarding', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />;

  return (
    <AppLayout>
      <AnimatedRoutes>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/chat" element={<ChatAI />} />
          
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatedRoutes>
    </AppLayout>
  );
};

const AppRoutes = () => {
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    setGlobalSignOut(() => {
      signOut();
      toast({ title: i18next.t('auth.session_expired') });
    });
    return () => { globalSignOut = null; };
  }, [signOut]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/confidentialite" element={<PrivacyPolicy />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/auth" replace />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
