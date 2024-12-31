import { Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from "@/contexts/user";
import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import SubmitToolPage from "@/pages/SubmitToolPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import NavBar from "@/components/NavBar";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <div className="min-h-screen bg-background">
          <NavBar />
          <main>
            <Route path="/" component={HomePage} />
            <Route path="/auth" component={AuthPage} />
            <Route path="/submit" component={SubmitToolPage} />
            <Route path="/admin" component={AdminDashboardPage} />
          </main>
          <Toaster />
        </div>
      </UserProvider>
    </QueryClientProvider>
  );
}