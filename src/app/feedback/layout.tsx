export default function FeedbackLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div suppressHydrationWarning>{children}</div>;
}
