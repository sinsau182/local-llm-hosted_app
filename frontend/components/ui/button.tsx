import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl bg-ink px-4 py-2 text-sand transition hover:opacity-90 ${props.className ?? ""}`.trim()}
    />
  );
}
