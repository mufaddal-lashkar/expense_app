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
    username: z
        .string()
        .min(3, "At least 3 characters")
        .max(30, "Max 30 characters")
        .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, underscores, hyphens only"),
    password: z.string().min(8, "At least 8 characters"),
});

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
    const router = useRouter();
    const { signup, isLoading } = useAuthStore();
    const [serverError, setServerError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        setServerError(null);
        try {
            await signup(data.email, data.username, data.password);
            router.push("/login?registered=true");
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
            <h2 className="text-xl font-semibold mb-6">Create your account</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <Input
                    label="Email"
                    type="email"
                    placeholder="you@company.com"
                    error={errors.email?.message}
                    {...register("email")}
                />
                <Input
                    label="Username"
                    placeholder="johnsmith"
                    error={errors.username?.message}
                    {...register("username")}
                />
                <Input
                    label="Password"
                    type="password"
                    placeholder="Min. 8 characters"
                    error={errors.password?.message}
                    {...register("password")}
                />

                {serverError && (
                    <p className="text-sm text-danger bg-[#2a1a1a] border border-[#4a2a2a] rounded-lg px-3 py-2">
                        {serverError}
                    </p>
                )}

                <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
                    Create account
                </Button>
            </form>

            <p className="text-sm text-text-muted text-center mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-accent hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}