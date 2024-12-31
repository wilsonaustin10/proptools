import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, Trophy } from "lucide-react";
import type { Tool } from "@db/schema";
import { useUser } from "@/hooks/use-user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
      className={cn(
        "overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative",
        tool.featured && "border-primary"
      )}
      onClick={() => setLocation(`/tools/${tool.id}`)}
    >
      {tool.featured && (
        <div className="absolute top-2 right-2">
          <Badge variant="default" className="bg-primary flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            Featured
          </Badge>
        </div>
      )}
      <CardHeader className="p-4">
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
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-muted-foreground mb-4 line-clamp-2">{tool.description}</p>
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
            variant={tool.upvotes && tool.upvotes > 0 ? "default" : "ghost"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              user && upvoteMutation.mutate();
            }}
            disabled={!user || upvoteMutation.isPending}
            className="flex items-center gap-2"
          >
            <ThumbsUp className={cn(
              "w-4 h-4",
              tool.upvotes && tool.upvotes > 0 && "text-white"
            )} />
            <span>{tool.upvotes ?? 0}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}