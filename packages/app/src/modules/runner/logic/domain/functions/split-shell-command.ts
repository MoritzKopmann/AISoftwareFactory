const commandSeparators: ReadonlySet<string> = new Set([';', '&', '|', '\n', '(', ')', '`']);
const wrapperPrograms: ReadonlySet<string> = new Set([
  'env',
  'command',
  'sudo',
  'exec',
  'nohup',
  'time',
  'nice',
  'ionice',
  'setsid',
  'timeout',
  'xargs',
  'then',
  'do',
  'else',
  '{',
  '!',
]);
const wrapperFlagsWithValue: ReadonlySet<string> = new Set([
  '-u',
  '-g',
  '-n',
  '-s',
  '-k',
  '-C',
  '-S',
]);
const shellPrograms: ReadonlySet<string> = new Set(['bash', 'sh', 'zsh', 'dash']);
const environmentAssignment = /^[A-Za-z_][A-Za-z0-9_]*=/;
const redirectionOperator = /^\d*[<>]+/;
const redirectionOperatorAlone = /^\d*[<>]+$/;
const substitutions: ReadonlyArray<RegExp> = [/\$\(([^()]*)\)/g, /`([^`]*)`/g];

export function splitShellCommand(command: string): ReadonlyArray<ReadonlyArray<string>> {
  return tokenize(command).flatMap(expandCommand);
}

function expandCommand(words: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> {
  const program = stripLeadingNoise(withoutRedirections(words));
  const nestedCommands = [
    ...nestedShellScript(program).flatMap(splitShellCommand),
    ...words.flatMap(substitutedCommands),
  ];
  return [program, ...nestedCommands];
}

function withoutRedirections(words: ReadonlyArray<string>): ReadonlyArray<string> {
  const kept: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    if (!redirectionOperator.test(word)) {
      kept.push(word);
    } else if (redirectionOperatorAlone.test(word)) {
      index += 1;
    }
  }
  return kept;
}

function stripLeadingNoise(words: ReadonlyArray<string>): ReadonlyArray<string> {
  let index = 0;
  while (index < words.length) {
    const word = words[index] ?? '';
    if (environmentAssignment.test(word)) {
      index += 1;
    } else if (wrapperPrograms.has(word)) {
      index += 1;
      while ((words[index] ?? '').startsWith('-')) {
        index += wrapperFlagsWithValue.has(words[index] ?? '') ? 2 : 1;
      }
      if (word === 'timeout' && /^\d/.test(words[index] ?? '')) {
        index += 1;
      }
    } else {
      break;
    }
  }
  const [program, ...rest] = words.slice(index);
  return program === undefined ? [] : [program.slice(program.lastIndexOf('/') + 1), ...rest];
}

function nestedShellScript(program: ReadonlyArray<string>): ReadonlyArray<string> {
  const [name, ...rest] = program;
  if (name === 'eval') {
    return [rest.join(' ')];
  }
  if (name === undefined || !shellPrograms.has(name)) {
    return [];
  }
  const flagIndex = rest.findIndex((word) => /^-[a-z]*c$/.test(word));
  const script = flagIndex === -1 ? undefined : rest[flagIndex + 1];
  return script === undefined ? [] : [script];
}

function substitutedCommands(word: string): ReadonlyArray<ReadonlyArray<string>> {
  return substitutions.flatMap((pattern) =>
    [...word.matchAll(pattern)].flatMap((match) => splitShellCommand(match[1] ?? '')),
  );
}

function tokenize(command: string): ReadonlyArray<ReadonlyArray<string>> {
  const commands: string[][] = [];
  let words: string[] = [];
  let word = '';
  let hasWord = false;
  let quote: '"' | "'" | undefined;

  const endWord = (): void => {
    if (hasWord) {
      words.push(word);
    }
    word = '';
    hasWord = false;
  };
  const endCommand = (): void => {
    endWord();
    if (words.length > 0) {
      commands.push(words);
    }
    words = [];
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index] ?? '';
    if (quote === "'") {
      if (character === "'") {
        quote = undefined;
      } else {
        word += character;
      }
    } else if (character === '\\' && command[index + 1] === '\n') {
      index += 1;
    } else if (character === '\\' && index + 1 < command.length) {
      index += 1;
      word += command[index] ?? '';
      hasWord = true;
    } else if (quote === '"') {
      if (character === '"') {
        quote = undefined;
      } else {
        word += character;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
      hasWord = true;
    } else if (character === '&' && /[<>]$/.test(word)) {
      word += character;
    } else if (commandSeparators.has(character)) {
      endCommand();
    } else if (character === ' ' || character === '\t') {
      endWord();
    } else {
      word += character;
      hasWord = true;
    }
  }
  endCommand();
  return commands;
}
