import React from 'react';

type IconProps = { size?: number };

function Svg({ size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const MenuIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const SaveIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4" /><path d="M8 20v-6h8v6" /></Svg>
);
export const EditorIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></Svg>
);
export const LibraryIcon = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></Svg>
);
export const SheetIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 3h9l3 3v15H6z" /><path d="M9 11h6M9 15h6" /></Svg>
);
export const MoonIcon = (p: IconProps) => <Svg {...p}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></Svg>;
export const SunIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></Svg>
);
export const SignOutIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10 4H5v16h5" /><path d="M15 8l4 4-4 4M19 12H9" /></Svg>
);
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M14 6l-6 6 6 6" /></Svg>;
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M10 6l6 6-6 6" /></Svg>;
