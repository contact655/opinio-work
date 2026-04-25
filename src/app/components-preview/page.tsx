import { Avatar } from "@/components/common/Avatar";
import { StatusPill } from "@/components/common/StatusPill";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";

export default function ComponentsPreview() {
  return (
    <div>
      <Header />
      <main style={{ padding: "48px 48px 0", maxWidth: 900 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 32 }}>Components Preview</h2>

        {/* Avatar */}
        <section style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 16 }}>Avatar</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <Avatar name="田中 翔太" size="sm" gradient="royal" />
            <Avatar name="佐藤 花子" size="md" gradient="green" />
            <Avatar name="鈴木 一郎" size="lg" gradient="pink" />
            <Avatar name="山田 太郎" size="xl" gradient="purple" />
            <Avatar name="LayerX" size="md" gradient="orange" />
            <Avatar name="SmartHR" size="md" gradient="cyan" />
          </div>
        </section>

        {/* StatusPill md */}
        <section style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 16 }}>StatusPill — md (pill)</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill variant="pending" />
            <StatusPill variant="confirming" />
            <StatusPill variant="scheduling" />
            <StatusPill variant="scheduled" />
            <StatusPill variant="completed" />
            <StatusPill variant="declined" />
            <StatusPill variant="published" />
            <StatusPill variant="draft" />
            <StatusPill variant="reviewing" />
          </div>
        </section>

        {/* StatusPill sm */}
        <section style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 16 }}>StatusPill — sm (mini-tag)</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <StatusPill variant="pending" size="sm" />
            <StatusPill variant="confirming" size="sm" />
            <StatusPill variant="scheduling" size="sm" />
            <StatusPill variant="published" size="sm" />
            <StatusPill variant="declined" size="sm" />
          </div>
        </section>
      </main>
      <div style={{ height: 48 }} />
      <Footer />
    </div>
  );
}
