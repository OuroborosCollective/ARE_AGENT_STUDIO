import { useEffect, useState } from 'react';

/**
 * Responsive device detection hook.
 *
 * Observes the real viewport and pointer capabilities and classifies the
 * device into a form factor so the studio can adapt its layout for phones,
 * tablets (e.g. Samsung Galaxy Tab A9), and desktops/Macs. It updates live on
 * resize and orientation change so the same UI reflows correctly on every
 * customer device without a reload.
 *
 * Breakpoints:
 *   - phone:  < 640px  (small smartphones, portrait)
 *   - tablet: 640–1023px (large phones, tablets in portrait, Tab A9 portrait)
 *   - desktop: >= 1024px (tablets in landscape, laptops, desktops)
 *
 * `isCompact` is true for anything below the desktop nav breakpoint, i.e. the
 * views that need the mobile mode selector and a single-column stack.
 */
export interface DeviceProfile {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  formFactor: 'phone' | 'tablet' | 'desktop';
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isCompact: boolean;
  isSmallPhone: boolean;
  isTouch: boolean;
}

function classify(width: number, height: number): DeviceProfile {
  const orientation: 'portrait' | 'landscape' = width >= height ? 'landscape' : 'portrait';
  let formFactor: DeviceProfile['formFactor'] = 'desktop';
  if (width < 640) formFactor = 'phone';
  else if (width < 1024) formFactor = 'tablet';
  return {
    width,
    height,
    orientation,
    formFactor,
    isPhone: formFactor === 'phone',
    isTablet: formFactor === 'tablet',
    isDesktop: formFactor === 'desktop',
    isCompact: formFactor !== 'desktop',
    isSmallPhone: width < 380,
    isTouch: typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false),
  };
}

export function useDeviceDetect(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(() =>
    classify(typeof window !== 'undefined' ? window.innerWidth : 1280, typeof window !== 'undefined' ? window.innerHeight : 800),
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setProfile(classify(window.innerWidth, window.innerHeight)));
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return profile;
}
