"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-soil-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 text-bone-100"
        >
          <span className="inline-block h-2.5 w-2.5 rotate-45 border border-brass-400 bg-brass-400/20" />
          <span className="font-serif text-[15px] font-semibold uppercase tracking-[0.08em]">
            Digital <span className="text-bone-400">/</span> Archaeologist
          </span>
        </Link>

        <ul className="hidden items-center gap-8 font-mono text-xs uppercase tracking-[0.12em] md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`group relative py-1 transition-colors ${
                    active ? "text-brass-400" : "text-bone-400 hover:text-bone-100"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-px bg-brass-400 transition-all duration-300 ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden md:block">
          <Link
            href="/upload"
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
          >
            Enter Workspace
            <ArrowUpRight
              size={13}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="-m-2 p-2 text-bone-200 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <ul className="flex flex-col gap-1 border-t border-white/10 px-6 py-3 font-mono text-xs uppercase tracking-[0.12em] md:hidden">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded px-2 py-2 transition-colors ${
                    active
                      ? "bg-soil-800 text-brass-400"
                      : "text-bone-400 hover:bg-soil-900 hover:text-bone-100"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li className="pt-1">
            <Link
              href="/upload"
              onClick={() => setOpen(false)}
              className="block rounded-full border border-white/15 px-4 py-2 text-center text-bone-200"
            >
              Enter Workspace
            </Link>
          </li>
        </ul>
      )}
    </header>
  );
}
