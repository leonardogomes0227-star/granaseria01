import { useEffect } from 'react';

/** Descrição da página pro Google e pra prévia de link (a versão estática vem do prerender no build). */
export function useMetaDescription(text: string) {
  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    const previous = tag.content;
    tag.content = text;
    return () => {
      tag!.content = previous;
    };
  }, [text]);
}
