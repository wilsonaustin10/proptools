import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import HeroSection from "@/components/HeroSection";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import ToolCard from "@/components/ToolCard";
import { Tool } from "@db/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type SortOption = "upvotes" | "newest" | "featured";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("upvotes");

  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["tools", selectedCategory, searchQuery, sortBy],
    queryFn: async () => {
      let url = "/api/tools";
      if (selectedCategory) {
        url = `/api/tools/category/${selectedCategory}`;
      }
      if (searchQuery) {
        url = `/api/tools/search?q=${encodeURIComponent(searchQuery)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch tools");
      }
      const data = await response.json();
      
      // Sort the tools based on the selected option
      return data.sort((a: Tool, b: Tool) => {
        switch (sortBy) {
          case "upvotes":
            return (b.upvotes ?? 0) - (a.upvotes ?? 0);
          case "newest":
            return (new Date(b.createdAt || Date.now()).getTime()) - 
                   (new Date(a.createdAt || Date.now()).getTime());
          case "featured":
            return (b.featured === a.featured) ? 0 : (b.featured ? -1 : 1);
          default:
            return 0;
        }
      });
    },
  });

  return (
    <div className="min-h-screen">
      <HeroSection />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="w-full md:w-1/2">
            <SearchBar onSearch={setSearchQuery} />
          </div>
          <div className="w-full md:w-1/4">
            <CategoryFilter
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>
          <div className="w-full md:w-1/4">
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upvotes">Most Upvoted</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {tools.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No tools found. Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                  <ToolCard 
                    key={tool.id} 
                    tool={tool}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
