import { AppLayout } from "@/components/AppLayout";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-12 sm:py-24 px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground text-center">{title}</h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground text-center">Esta seção será desenvolvida em breve.</p>
      </div>
    </AppLayout>
  );
}
