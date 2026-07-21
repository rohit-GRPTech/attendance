import { icons, Box, type LucideProps } from 'lucide-react';

/** Renders a lucide icon by its kebab-case name from application definitions. */
export function DynamicIcon({ name, ...props }: { name?: string } & LucideProps) {
  const pascal = (name ?? '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const Icon = (icons as Record<string, typeof Box>)[pascal] ?? Box;
  return <Icon {...props} />;
}
