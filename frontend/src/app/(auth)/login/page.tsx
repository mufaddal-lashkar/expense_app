"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore";
import { ApiClientError } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const schema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
    const router = useRouter();
    const { login, isLoading } = useAuthStore();
    const [serverError, setServerError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        setServerError(null);
        try {
            const { hasOrg } = await login(data.email, data.password);
            
            if (hasOrg) {
                router.push("/dashboard");
            } else {
                router.push("/onboarding");
            }
        } catch (err) {
            if (err instanceof ApiClientError) {
                if (err.details) {
                    err.details.forEach(({ field, message }) => {
                        setError(field as keyof FormData, { message });
                    });
                } else {
                    setServerError(err.message);
                }
            }
        }
    };

    return (
        <div className="bg-surface border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-6">Welcome back</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <Input
                    label="Email"
                    type="email"
                    placeholder="you@company.com"
                    error={errors.email?.message}
                    {...register("email")}
                />
                <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    error={errors.password?.message}
                    {...register("password")}
                />

                {serverError && (
                    <p className="text-sm text-danger bg-[#2a1a1a] border border-[#4a2a2a] rounded-lg px-3 py-2">
                        {serverError}
                    </p>
                )}

                <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
                    Sign in
                </Button>
            </form>

            <p className="text-sm text-text-muted text-center mt-6">
                No account?{" "}
                <Link href="/signup" className="text-accent hover:underline">
                    Create one
                </Link>
            </p>
        </div>
    );
}