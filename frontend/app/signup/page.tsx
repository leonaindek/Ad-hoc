import Link from "next/link";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-1 p-8 animate-slide-up">
        <h1 className="mb-1 text-2xl font-bold">Create account</h1>
        <p className="mb-6 text-sm text-muted">
          Sign up to get started
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <form action={signup} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              placeholder="••••••••"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Sign up
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
