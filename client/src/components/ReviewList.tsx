import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { StarIcon, ThumbsUp } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useUser } from "../hooks/use-user";
import type { Review } from "../../db/schema";


interface ReviewWithUser extends Review {
  user: {
    username: string;
    firstName: string;
    lastName: string;
  };
}

interface ReviewListProps {
  toolId: number;
}

export function ReviewList({ toolId }: ReviewListProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: reviews, isLoading } = useQuery<ReviewWithUser[]>({
    queryKey: ['/api/reviews/tool', toolId.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/reviews/tool/${toolId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      return response.json();
    },
  });

  const helpfulMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews/tool', toolId.toString()] });
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
    return <div>Loading reviews...</div>;
  }

  if (!reviews?.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No reviews yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {review.user.firstName} {review.user.lastName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`w-5 h-5 ${
                      i < review.rating ? "text-yellow-400" : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{review.content}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Pros</h4>
                <p className="text-sm text-muted-foreground">{review.pros}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Cons</h4>
                <p className="text-sm text-muted-foreground">{review.cons}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => user && helpfulMutation.mutate(review.id)}
                disabled={!user || helpfulMutation.isPending}
                className="flex items-center gap-2"
              >
                <ThumbsUp className="w-4 h-4" />
                {review.helpfulCount} Helpful
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
