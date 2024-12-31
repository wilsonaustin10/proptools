import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ToolPage from "./pages/ToolPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import { useUser } from "./hooks/use-user";
import NavBar from "./components/NavBar";
import { Loader2 } from "lucide-react";

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar user={user} />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/tools/:id">
          {(params) => <ToolPage params={params} />}
        </Route>
        <Route path="/admin" component={AdminDashboardPage} />
      </Switch>
      <Toaster />
    </div>
  );
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}