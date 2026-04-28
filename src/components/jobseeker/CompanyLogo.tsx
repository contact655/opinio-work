import Image from "next/image";

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  logoLetter?: string | null;
  logoGradient?: string | null;
  size?: number;
  borderRadius?: number;
}

const DEFAULT_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

export function CompanyLogo({
  name,
  logoUrl,
  logoLetter,
  logoGradient,
  size = 48,
  borderRadius = 10,
}: CompanyLogoProps) {
  const letter = logoLetter ?? name.charAt(0).toUpperCase();
  const gradient = logoGradient ?? DEFAULT_GRADIENT;
  const fontSize = Math.round(size * 0.38);

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius,
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (logoUrl) {
    return (
      <div style={containerStyle}>
        <Image
          src={logoUrl}
          alt={`${name} ロゴ`}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...containerStyle,
        background: gradient,
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.02em",
      }}
      aria-label={`${name} ロゴ`}
    >
      {letter}
    </div>
  );
}
