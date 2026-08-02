import NextLink, { type LinkProps } from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type StaticLinkProps = LinkProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof LinkProps>;

/** Static exports navigate cleanly without App Router's unavailable RSC prefetches. */
export default function StaticLink(props: StaticLinkProps) {
  return <NextLink {...props} prefetch={false} />;
}
