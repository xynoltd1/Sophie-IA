export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div>
        <p className="font-display text-hero font-semibold">Sophie IA</p>
        <p className="mt-2 text-ink-soft">
          Elle répond à vos clients pendant que vous travaillez.
        </p>
      </div>
      {children}
    </main>
  );
}
