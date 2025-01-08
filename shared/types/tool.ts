export interface Tool {
  id: number;
  name: string;
  description: string;
  website: string;
  category: string;
  logo: string | null;
  upvotes: number | null;
  featured: boolean | null;
  createdAt: Date | null;
}
