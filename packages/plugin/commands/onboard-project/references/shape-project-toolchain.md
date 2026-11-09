# Shape: project-toolchain

Structure only. Fill from the sources.

1. **First** in the body, a fenced `yaml aisf-toolchain` block with exactly these keys:

   ```yaml aisf-toolchain
   format: <command>
   analyze: <command>
   test: <command>
   test_file: <command with {file}>
   manifests: [<dependency manifests and lockfiles>]
   registry: <package registry>
   platforms: [<target platforms>]
   ```

2. Prose: how to run the commands (runtime version, working directory, which command rewrites files).
3. Prose: how to read `analyze` output (its steps, what a failure looks like, what counts as a failure).
4. The dependency bar: what a new dependency must meet. A new dependency is a question for the human.
