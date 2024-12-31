import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/hooks/use-user";
import { Building2, Shield } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const { login, register } = useUser();
  const [, setLocation] = useLocation();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: isAdminLogin ? "admin@proptools.co" : "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  const handleSubmit = async (data: LoginForm | RegisterForm) => {
    try {
      if (isLogin) {
        const response = await login(data as LoginForm);
        if (response.ok) {
          setLocation("/admin");
        }
      } else {
        await register(data as RegisterForm);
        setLocation("/admin");
      }
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            {isAdminLogin ? (
              <Shield className="h-12 w-12 text-primary" />
            ) : (
              <Building2 className="h-12 w-12 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl text-center font-bold">
            {isLogin
              ? isAdminLogin
                ? "Admin Login"
                : "Sign in to PropTools"
              : "Create an account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={
            isLogin 
              ? loginForm.handleSubmit(handleSubmit)
              : registerForm.handleSubmit(handleSubmit)
          } className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                {isAdminLogin ? "Admin Username" : "Username"}
              </Label>
              <Input
                id="username"
                {...(isLogin ? loginForm : registerForm).register("username")}
                className={isAdminLogin ? "border-primary" : ""}
                defaultValue={isAdminLogin ? "admin@proptools.co" : ""}
              />
              {(isLogin ? loginForm : registerForm).formState.errors.username && (
                <p className="text-sm text-red-500">
                  {(isLogin ? loginForm : registerForm).formState.errors.username?.message}
                </p>
              )}
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    {...registerForm.register("firstName")}
                  />
                  {registerForm.formState.errors.firstName && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.firstName?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    {...registerForm.register("lastName")}
                  />
                  {registerForm.formState.errors.lastName && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.lastName?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.email?.message}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">
                {isAdminLogin ? "Admin Password" : "Password"}
              </Label>
              <Input
                id="password"
                type="password"
                {...(isLogin ? loginForm : registerForm).register("password")}
                className={isAdminLogin ? "border-primary" : ""}
              />
              {(isLogin ? loginForm : registerForm).formState.errors.password && (
                <p className="text-sm text-red-500">
                  {(isLogin ? loginForm : registerForm).formState.errors.password?.message}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className={`w-full ${isAdminLogin ? "bg-primary hover:bg-primary/90" : ""}`}
            >
              {isLogin ? (isAdminLogin ? "Admin Sign In" : "Sign In") : "Sign Up"}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {!isAdminLogin && (
              <Button
                variant="link"
                onClick={() => {
                  setIsLogin(!isLogin);
                  loginForm.reset();
                  registerForm.reset();
                }}
                className="text-sm"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </Button>
            )}

            {isLogin && (
              <Button
                variant="link"
                onClick={() => {
                  setIsAdminLogin(!isAdminLogin);
                  loginForm.reset({
                    username: !isAdminLogin ? "admin@proptools.co" : "",
                    password: "",
                  });
                }}
                className="text-sm text-muted-foreground"
              >
                {isAdminLogin ? "Switch to User Login" : "Admin Login"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}