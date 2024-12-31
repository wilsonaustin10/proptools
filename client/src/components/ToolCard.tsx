import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp } from "lucide-react";
import type { Tool } from "@db/schema";
import { useUser } from "@/hooks/use-user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ToolCardProps {
  tool: Tool;
}

export default function ToolCard({ tool }: ToolCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tools/${tool.id}/upvote`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => setLocation(`/tools/${tool.id}`)}
    >
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {tool.logo && (
              <img
                src={tool.logo}
                alt={`${tool.name} logo`}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <h3 className="font-semibold text-lg">{tool.name}</h3>
              <Badge variant="secondary">{tool.category}</Badge>
            </div>
          </div>
          {tool.featured && (
            <Badge variant="default" className="bg-primary">
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-muted-foreground mb-4">{tool.description}</p>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(tool.website, "_blank");
            }}
          >
            Visit Website
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              user && upvoteMutation.mutate();
            }}
            disabled={!user || upvoteMutation.isPending}
            className="flex items-center gap-2"
          >
            <ThumbsUp className="w-4 h-4" />
            <span>{tool.upvotes}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}