import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/user";
import { loginSchema, type LoginForm } from "@/lib/validations/auth";
import { registerSchema, type RegisterForm } from "@/lib/validations/auth";
import { useToast } from "@/components/ui/use-toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, register } = useUser();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  // Get verification status from URL
  const searchParams = new URLSearchParams(window.location.search);
  const isVerified = searchParams.get('verified');
  const verificationMessage = searchParams.get('message');

  useEffect(() => {
    if (isVerified === 'true') {
      toast({
        title: "Email verified",
        description: "You can now log in to your account",
      });
      // Clear the URL parameters
      window.history.replaceState({}, '', '/auth');
    } else if (isVerified === 'false' && verificationMessage) {
      toast({
        title: "Verification failed",
        description: decodeURIComponent(verificationMessage),
        variant: "destructive",
      });
      // Clear the URL parameters
      window.history.replaceState({}, '', '/auth');
    }
  }, [isVerified, verificationMessage, toast]);

  const handleSubmit = async (data: LoginForm | RegisterForm) => {
    try {
      if (isLogin) {
        const response = await login(data as LoginForm);
        if (response.ok) {
          toast({
            title: "Success",
            description: "Logged in successfully",
          });
          setLocation("/");
        } else {
          toast({
            title: "Error",
            description: response.message || "Invalid username or password",
            variant: "destructive",
          });
        }
      } else {
        const response = await register(data as RegisterForm);
        if (response.ok) {
          toast({
            title: "Registration successful",
            description: "Please check your email for verification instructions",
          });
          // Don't redirect immediately after registration
          // Wait for email verification
        } else {
          toast({
            title: "Error",
            description: response.message || "Registration failed",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center font-bold">
            {isLogin ? "Sign in to PropTools" : "Create an account"}
          </CardTitle>
          <div className="flex justify-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
            >
              Back to Home
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={
              isLogin
                ? loginForm.handleSubmit(handleSubmit)
                : registerForm.handleSubmit(handleSubmit)
            }
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...(isLogin 
                  ? loginForm.register("username")
                  : registerForm.register("username")
                )}
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...(isLogin 
                  ? loginForm.register("password")
                  : registerForm.register("password")
                )}
              />
              {(isLogin ? loginForm : registerForm).formState.errors.password && (
                <p className="text-sm text-red-500">
                  {(isLogin ? loginForm : registerForm).formState.errors.password?.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full">
              {isLogin ? "Sign In" : "Sign Up"}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}