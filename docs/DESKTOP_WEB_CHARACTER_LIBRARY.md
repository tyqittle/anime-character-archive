# Desktop website character library

Website imports are registered in the existing Characters area under 网页角色;
本地素材 retains the original native library and settings.

- Persist every successfully selected catalog identity as (Game, Id), with name,
  visibility, voice and selected action, in universal-characters-v1.json.
- Import the previous universal-desktop-v1.json on first use. Once the new file
  exists it is authoritative, including an empty library after removal.
- Every visible identity owns an independent composition host and cancellable load.
  Showing a new identity retains other visible pets; showing an existing identity
  reuses its host. All visible registrations are restored after restart.
- Hide preserves the entry; remove only removes its registration and active host.
  Neither operation deletes downloaded resources or the shared WebView2 profile.
- Writes use a temporary file and atomic replacement. Failed writes retain the
  previous in-memory list. Invalid documents are preserved and reported.
- The program can recover the last role saved by old versions; older website
  selections were never recorded by those versions and must be added again.

Application behavior is typed C# under native-desktop/web/. Pinned upstream
patching adds two checked attachment points, with no game-specific UI branches.
Windows regressions cover persistence, exact identity, migration/removal,
failed writes and Characters-panel show/hide/remove without native resources,
alongside existing composition, alpha, input and multi-engine playback tests.

Window commands live in an auto-sized shared toolbar outside both character settings
areas. Library import actions wrap in their own row. Windows layout regressions check
minimum/default sizes, enlarged labels and hit testing with both library tabs active.
The original 58-pixel selected-character title no longer contains application commands.

The source input HWND owns the alpha/interaction region; the visual browser HWND
is disabled for native input. Popup menus open after right-button capture releases
and remain above composition windows. Mouse-through is individually configurable
in the client and persisted per model. Exported hit regions restrict input for
scenery-heavy Cubism models without changing their rendered pixels.
