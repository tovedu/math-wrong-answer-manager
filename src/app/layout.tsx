import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Math Wrong Answer Manager",
    description: "Manage and analyze math wrong answers",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className="bg-gray-50 min-h-screen text-gray-900">
                <main className="container mx-auto py-8 px-4">
                    {children}
                </main>
            </body>
        </html>
    );
}
