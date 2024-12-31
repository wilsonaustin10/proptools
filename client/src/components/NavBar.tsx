import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { User } from "@db/schema";
import { useUser } from "@/hooks/use-user";

interface NavBarProps {
  user: User | null;
}

export default function NavBar({ user }: NavBarProps) {
  const [, setLocation] = useLocation();
  const { logout } = useUser();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setLocation("/")}>
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">PropTools</span>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Button 
                  variant="outline"
                  onClick={() => setLocation("/admin")}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Submit Tool
                </Button>
                <span className="text-sm text-muted-foreground">
                  Welcome, {user.username}
                </span>
                <Button variant="ghost" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button onClick={() => setLocation("/auth")}>Sign In</Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}