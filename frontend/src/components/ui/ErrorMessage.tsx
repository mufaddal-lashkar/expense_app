import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

type ErrorMessageProps = {
    message: string;
    onRetry?: () => void;
};

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2a1a1a] flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-danger" />
            </div>
            <div>
                <p className="text-text font-medium">Something went wrong</p>
                <p className="text-sm text-text-muted mt-1">{message}</p>
            </div>
            {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    <RefreshCw className="w-4 h-4" /> Try again
                </Button>
            )}
        </div>
    );
}