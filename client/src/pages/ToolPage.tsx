import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, ThumbsUp } from "lucide-react";
import type { Tool } from "@db/schema";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ToolPage({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tool, isLoading } = useQuery<Tool>({
    queryKey: ['/api/tools', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/tools/${params.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tool details');
      }
      return response.json();
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tools/${params.id}/upvote`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tools', params.id] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Tool not found</p>
            <Button
              variant="link"
              className="mt-4 mx-auto block"
              onClick={() => setLocation('/')}
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {tool.logo && (
                <img
                  src={tool.logo}
                  alt={`${tool.name} logo`}
                  className="w-16 h-16 rounded-lg"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold">{tool.name}</h1>
                <Badge variant="secondary" className="mt-2">
                  {tool.category}
                </Badge>
              </div>
            </div>
            {tool.featured && (
              <Badge variant="default" className="bg-primary">
                Featured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose max-w-none">
            <p className="text-lg text-muted-foreground">{tool.description}</p>
          </div>

          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              size="lg"
              onClick={() => window.open(tool.website, "_blank")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Website
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => user && upvoteMutation.mutate()}
              disabled={!user || upvoteMutation.isPending}
              className="flex items-center gap-2"
            >
              <ThumbsUp className="w-4 h-4" />
              {tool.upvotes} Upvotes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
