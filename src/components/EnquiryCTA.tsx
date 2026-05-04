'use client';

import { useCallback } from 'react';
import {
  buildInstagramAppHref,
  buildInstagramWebHref,
  buildPrefilledMessage,
  buildWhatsAppHref,
  type EnquiryChannel,
  type EnquiryContext,
} from '@/lib/enquiry';

interface Props {
  whatsappNumber: string;
  instagramHandle?: string;
  ctx: EnquiryContext;
  channel?: EnquiryChannel;
  variant?: 'primary' | 'secondary' | 'batch-row';
  label?: string;
  className?: string;
}

export function EnquiryCTA({
  whatsappNumber,
  instagramHandle,
  ctx,
  channel = 'whatsapp',
  variant = 'primary',
  label,
  className,
}: Props) {
  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Fire analytics non-blockingly
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'enquiry_click', {
          page_path: window.location.pathname,
          channel,
          source: ctx.source,
          dance_style: ctx.style?.slug ?? null,
          branch: ctx.branch?.slug ?? null,
          batch_id: ctx.batch?.id ?? null,
        });
      }
      if (channel === 'instagram') {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(buildPrefilledMessage(ctx));
            showToast('Message copied — paste in Instagram DM');
          } else {
            showToast('Tap to message us on Instagram');
          }
        } catch {
          showToast('Tap to message us on Instagram');
        }
        // Try app, fall back to web after a short timeout
        if (instagramHandle) {
          const t = setTimeout(() => {
            window.location.href = buildInstagramWebHref(instagramHandle);
          }, 350);
          window.location.href = buildInstagramAppHref(instagramHandle);
          // If app opens, the timeout still fires but the page is suspended; harmless.
          // Cancel on visibility change
          const cancel = () => {
            clearTimeout(t);
            document.removeEventListener('visibilitychange', cancel);
          };
          document.addEventListener('visibilitychange', cancel);
        }
        e.preventDefault();
      }
    },
    [channel, ctx, instagramHandle],
  );

  const href =
    channel === 'whatsapp'
      ? buildWhatsAppHref(whatsappNumber, ctx)
      : instagramHandle
      ? buildInstagramWebHref(instagramHandle)
      : '#';

  const cls =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'secondary'
      ? 'btn-secondary'
      : 'inline-flex items-center gap-2 rounded-full bg-ember-500/15 px-3.5 py-1.5 text-sm font-medium text-ember-400 transition hover:bg-ember-500/25';

  const text =
    label ??
    (channel === 'whatsapp'
      ? variant === 'batch-row'
        ? 'Enquire on WhatsApp'
        : 'Chat on WhatsApp'
      : 'DM on Instagram');

  return (
    <a
      href={href}
      target={channel === 'whatsapp' ? '_blank' : undefined}
      rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      className={`${cls} ${className ?? ''}`.trim()}
    >
      {channel === 'whatsapp' ? <WhatsAppGlyph /> : <InstagramGlyph />}
      {text}
    </a>
  );
}

function showToast(text: string) {
  const id = 'furor-toast';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText =
      'position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:#150c10;color:#f6efe7;padding:10px 16px;border-radius:9999px;font:500 14px/1.2 system-ui;z-index:60;box-shadow:0 8px 24px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);opacity:0;transition:opacity 200ms;';
    document.body.appendChild(el);
  }
  el.textContent = text;
  requestAnimationFrame(() => {
    el!.style.opacity = '1';
  });
  clearTimeout((el as HTMLElement & { _t?: number })._t);
  (el as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
    el!.style.opacity = '0';
  }, 2200);
}

function WhatsAppGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.05 4.91A10 10 0 0 0 4.7 18.13L4 22l3.97-1.04A10 10 0 1 0 19.05 4.91Zm-7 15.13a8.06 8.06 0 0 1-4.1-1.13l-.3-.18-2.36.62.63-2.3-.19-.3A8.07 8.07 0 1 1 12.05 20Zm4.42-6.05c-.24-.12-1.43-.7-1.65-.78s-.38-.12-.55.12-.62.78-.76.94-.28.18-.52.06-1.03-.38-1.96-1.21a7.4 7.4 0 0 1-1.36-1.7c-.14-.24 0-.37.1-.49.1-.1.24-.27.36-.4.12-.13.16-.22.24-.37.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.42-.55-.43h-.47a.92.92 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07c0 1.22.89 2.4 1.02 2.57.13.16 1.76 2.69 4.27 3.77.6.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}
function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
