# Desktop input and portrait interaction scope

Source checks are model-specific; this is not a claim that every game's complete interaction system was exported.

- Pinned AzurLane `abeikelongbi_3.model3.json` declares TouchHead, TouchBody and TouchSpecial plus matching motion files. These can drive source-based interactions when their drawable IDs remain valid in the MOC.
- Pinned Girls Cafe Gun `girl01/l2d00.u/l2d00.u.model3.json` contains two references to the same stand clip and no HitAreas. Deduplication leaves a standby clip; it cannot provide the original game's unexported body reactions.
- Other models are classified at runtime from their actual motion definitions and valid hit areas. Area aliases and anonymous motion groups share the same policy.
- Estimated regions use only supplied touch/reaction clips and are labeled as estimates; special interactions require explicit source regions. Source art, including backgrounds, is preserved.
- Multi-pet state replaces the former single-visible-host behavior and retains old identities, cache, positions, voices and configurations.

Validation includes source/estimated/missing interactions, drag cancellation, multiple simultaneous loads, stale completion after removal, persistence, actual Windows desktop hit testing, menu z-order, multiple real WebView composition hosts and real-browser motion playback. A short test-only Spine reaction on a real rig verifies event/completion behavior without claiming that clip belongs to the source game.

Sources: [AzurLane setting](https://github.com/Chaoray/AzurLane-Live2D-Viewer/blob/88cb6e56a0ad472fe7e546509f096545d2bbc5b9/live2d/abeikelongbi_3/abeikelongbi_3.model3.json); [Girls Cafe Gun setting](https://github.com/Eikanya/Live2d-model/blob/7e446cbd95ec352cdb0f73c079e4d075d7d528ac/少女咖啡枪%20girls%20cafe%20gun/girl01/l2d00.u/l2d00.u.model3.json).
