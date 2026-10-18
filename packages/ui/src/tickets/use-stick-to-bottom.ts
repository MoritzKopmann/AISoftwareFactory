import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { isScrolledToBottom } from './is-scrolled-to-bottom.js';

function scrollToBottom(element: HTMLElement) {
  element.scrollTop = element.scrollHeight;
}

/**
 * Keeps a scroll box at its bottom while the reader has not scrolled away. Content growth
 * (new children, or a child that grows) follows only while pinned; the reader's own scroll
 * events decide whether it is. A new `runKey` pins again.
 */
export function useStickToBottom<T extends HTMLElement>(
  runKey: string | undefined,
): RefObject<T | null> {
  const boxRef = useRef<T>(null);
  const pinned = useRef(true);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box === null) {
      return;
    }
    pinned.current = true;
    scrollToBottom(box);
  }, [runKey]);

  useEffect(() => {
    const box = boxRef.current;
    if (box === null) {
      return;
    }
    const follow = () => {
      if (pinned.current) {
        scrollToBottom(box);
      }
    };
    const sizes = new ResizeObserver(follow);
    const observeChildren = () => {
      sizes.disconnect();
      for (const child of box.children) {
        sizes.observe(child);
      }
      follow();
    };
    const onScroll = () => {
      pinned.current = isScrolledToBottom(box);
    };
    const children = new MutationObserver(observeChildren);
    children.observe(box, { childList: true });
    box.addEventListener('scroll', onScroll);
    observeChildren();
    return () => {
      box.removeEventListener('scroll', onScroll);
      children.disconnect();
      sizes.disconnect();
    };
  }, []);

  return boxRef;
}
