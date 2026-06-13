// Auth pages get their own layout — no global header or footer
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
