import type { BoxProps } from '@mui/material';
import { Box } from '@mui/material';
import Image from 'next/image';

type BrandLogoVariant = 'wordmark' | 'icon';

type BrandLogoProps = Omit<BoxProps, 'children' | 'width'> & {
  variant?: BrandLogoVariant;
  width?: number | string;
  priority?: boolean;
  alt?: string;
};

const brandLogoAssets: Record<
  BrandLogoVariant,
  {
    src: string;
    width: number;
    height: number;
    alt: string;
  }
> = {
  wordmark: {
    src: '/logo-wordmark.png',
    width: 2000,
    height: 666,
    alt: 'PERSONAL ERP 로고'
  },
  icon: {
    src: '/logo-icon.png',
    width: 454,
    height: 460,
    alt: 'PERSONAL ERP 심볼 로고'
  }
};

export function BrandLogo({
  variant = 'wordmark',
  width,
  priority = false,
  alt,
  sx,
  ...boxProps
}: BrandLogoProps) {
  const asset = brandLogoAssets[variant];

  return (
    <Box
      sx={{
        width: width ?? (variant === 'wordmark' ? 168 : 44),
        maxWidth: '100%',
        flexShrink: 0,
        lineHeight: 0,
        ...sx
      }}
      {...boxProps}
    >
      <Image
        src={asset.src}
        alt={alt ?? asset.alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto'
        }}
      />
    </Box>
  );
}
