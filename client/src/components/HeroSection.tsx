import { Building2 } from "lucide-react";

export default function HeroSection() {
  return (
    <div className="relative">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-background/95" />

      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      <div className="container mx-auto px-4 py-16 md:py-24 relative">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="flex justify-center mb-6">
            <Building2 className="h-16 w-16 text-primary" />
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Discover the Best Real Estate Tools
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground">
            Your curated directory of software solutions that power modern real estate professionals
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mt-8">
            <div className="flex flex-col items-center justify-center p-4 rounded-lg min-w-[120px]">
              <span className="block text-3xl font-bold text-primary">500+</span>
              <span className="text-sm text-muted-foreground">Tools Listed</span>
            </div>
            <div className="hidden md:block w-px h-12 bg-border" />
            <div className="flex flex-col items-center justify-center p-4 rounded-lg min-w-[120px]">
              <span className="block text-3xl font-bold text-primary">10+</span>
              <span className="text-sm text-muted-foreground">Categories</span>
            </div>
            <div className="hidden md:block w-px h-12 bg-border" />
            <div className="flex flex-col items-center justify-center p-4 rounded-lg min-w-[120px]">
              <span className="block text-3xl font-bold text-primary">24/7</span>
              <span className="text-sm text-muted-foreground">Updated Daily</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative bottom fade */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}