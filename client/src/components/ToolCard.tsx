import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Trophy } from "lucide-react";
import type { Tool } from "@db/schema";
import { TOOL_CATEGORIES } from "@/lib/constants";
import { useUser } from "@/hooks/use-user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface VoteResponse {
  message: string;
}

interface VoteError {
  error: string;
}

interface ToolCardProps {
  tool: Tool;
}

export default function ToolCard({ tool }: ToolCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const voteMutation = useMutation<VoteResponse, Error, { category: string; voteType: boolean }>({
    mutationFn: async ({ category, voteType }) => {
      const response = await fetch(`/api/tools/${tool.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, voteType }),
      });
      if (!response.ok) {
        const errorData = (await response.json()) as VoteError;
        throw new Error(errorData.error || "Failed to vote");
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
            <div className="flex flex-wrap gap-1">
              {tool.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
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
          <div className="flex flex-col gap-2">
            {tool.categories.map((category) => (
              <div key={category} className="flex items-center justify-between gap-2">
                <Badge variant="outline">{category}</Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      user && voteMutation.mutate({ category, voteType: true });
                    }}
                    disabled={!user || voteMutation.isPending}
                    className="h-8 w-8 p-0"
                    title="Upvote"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      user && voteMutation.mutate({ category, voteType: false });
                    }}
                    disabled={!user || voteMutation.isPending}
                    className="h-8 w-8 p-0"
                    title="Downvote"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
