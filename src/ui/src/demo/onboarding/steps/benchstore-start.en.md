This action strip decides what happens next.

- `Start`: the task is already installed. DeepScientist reads the setup packet and carries the benchmark goal, local path, paper, and runtime constraints into the Start Research form
- `GET`: the task is not installed yet, so it downloads, verifies, and prepares local resources first
- Progress state: download or preparation status appears in the same action area
- `Ready`: the local state is sufficient for the launch flow

The practical rule is simple:

- if ready, use `Start`
- if missing, use `GET`
- if the install state looks wrong, reacquire it or inspect the local path in the detail page

The tutorial will close BenchStore next, then continue with the Start Research intake and full launch form.
