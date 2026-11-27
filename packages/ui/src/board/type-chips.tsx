import type { TypeChip } from './describe-type-chips.js';

export function TypeChips({ chips }: { readonly chips: ReadonlyArray<TypeChip> }) {
  return (
    <>
      {chips.map((chip) => (
        <span key={chip.type} className={`chip ${chip.type}`}>
          {chip.label}
        </span>
      ))}
    </>
  );
}
