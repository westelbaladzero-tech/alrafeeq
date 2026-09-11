"use client";

export default function AuthInput({
  icon,
  type,
  placeholder,
  value,
  onChange,
  highlighted = false,
  required = false,
  maxLength,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  highlighted?: boolean;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="relative">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87a19a]">{icon}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className={
          "w-full rounded-2xl pr-11 pl-4 py-3.5 outline-none transition border text-[15px] " +
          (highlighted
            ? "bg-[#eef6ff] border-[#d8e8fb] focus:ring-2 focus:ring-[#d7ebff]"
            : "bg-[#f7f5ef] border-[#f0ebe2] focus:ring-2 focus:ring-[#dff2e8]")
        }
      />
    </div>
  );
}
