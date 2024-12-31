import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { Tool } from "@db/schema";
import { useLocation } from "wouter";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const debouncedSearch = useDebouncedCallback(
    (value) => {
      onSearch(value);
    },
    300
  );

  const { data: searchResults, isLoading } = useQuery<Tool[]>({
    queryKey: ["toolSearch", searchTerm],
    queryFn: async () => {
      if (!searchTerm) return [];
      const response = await fetch(`/api/tools/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: searchTerm.length > 0,
  });

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  return (
    <div className="relative w-full">
      <Command className="rounded-lg border shadow-md">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <CommandInput
            placeholder="Search for tools..."
            value={searchTerm}
            onValueChange={(value) => {
              setSearchTerm(value);
              setOpen(true);
            }}
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {open && searchTerm && (
          <CommandList className="max-h-[300px] overflow-y-auto p-2">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Tools">
              {searchResults?.map((tool) => (
                <CommandItem
                  key={tool.id}
                  onSelect={() => {
                    setLocation(`/tools/${tool.id}`);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {tool.logo && (
                    <img
                      src={tool.logo}
                      alt={tool.name}
                      className="w-6 h-6 rounded"
                    />
                  )}
                  <div>
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {tool.category}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  );
}