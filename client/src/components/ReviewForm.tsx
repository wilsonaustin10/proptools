import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "../hooks/use-toast";
import { StarIcon } from "lucide-react";

interface ReviewFormProps {
  toolId: number;
  onSuccess?: () => void;
}

export function ReviewForm({ toolId, onSuccess }: ReviewFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolId,
          rating,
          content,
          pros,
          cons,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews/tool', toolId.toString()] });
      toast({
        title: "Review submitted",
        description: "Thank you for your review!",
      });
      setRating(0);
      setContent("");
      setPros("");
      setCons("");
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a rating",
      });
      return;
    }
    reviewMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`p-1 rounded-full transition-colors ${
                    value <= rating ? "text-yellow-400" : "text-gray-300"
                  }`}
                >
                  <StarIcon className="w-6 h-6" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Review</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your experience with this tool..."
              required
              minLength={10}
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pros</label>
            <Input
              value={pros}
              onChange={(e) => setPros(e.target.value)}
              placeholder="What did you like about this tool?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Cons</label>
            <Input
              value={cons}
              onChange={(e) => setCons(e.target.value)}
              placeholder="What could be improved?"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={reviewMutation.isPending}
            className="w-full"
          >
            Submit Review
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
