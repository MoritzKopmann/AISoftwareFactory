import { useEffect, useRef, useState } from 'react';
import { copyCommand } from './copy-command.js';

const copiedFeedbackMilliseconds = 2000;

type CommandBlockProps = {
  readonly command: string;
};

export function CommandBlock({ command }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const selectCommandText = () => {
    if (codeRef.current === null) return;
    const range = document.createRange();
    range.selectNodeContents(codeRef.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const handleCopy = async () => {
    await copyCommand(command, {
      writeText: navigator.clipboard?.writeText.bind(navigator.clipboard),
      selectText: selectCommandText,
    });
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), copiedFeedbackMilliseconds);
  };

  return (
    <div className="cmd">
      <code ref={codeRef}>{command}</code>
      <button className="btn copy" type="button" onClick={() => void handleCopy()}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="vh" role="status">
        {copied ? 'Copied to the clipboard' : ''}
      </span>
    </div>
  );
}
