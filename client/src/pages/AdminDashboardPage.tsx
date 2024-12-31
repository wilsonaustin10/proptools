import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { NewTool } from "@db/schema";

const toolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  website: z.string().url("Must be a valid URL"),
  category: z.string().min(1, "Category is required"),
  logo: z.string().optional(),
});

type ToolForm = z.infer<typeof toolSchema>;

export default function AdminDashboardPage() {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  console.log("AdminDashboardPage:", { user, isLoading });

  const form = useForm<ToolForm>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      category: "",
      logo: "",
    },
  });

  const addToolMutation = useMutation({
    mutationFn: async (data: NewTool) => {
      const response = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tool added successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null;
  }

  const onSubmit = (data: ToolForm) => {
    addToolMutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Add New Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tool Name</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input id="website" {...form.register("website")} />
              {form.formState.errors.website && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.website.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" {...form.register("category")} />
              {form.formState.errors.category && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL (Optional)</Label>
              <Input id="logo" {...form.register("logo")} />
              {form.formState.errors.logo && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.logo.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                rows={5}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={addToolMutation.isPending}
              className="w-full"
            >
              {addToolMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add Tool
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}