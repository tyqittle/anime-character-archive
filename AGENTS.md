# Project maintenance rules

Read [the architecture rules](docs/ARCHITECTURE_RULES.md) before changing implementation. They define module boundaries, data and identity contracts, lifecycle, publication, compatibility and validation requirements. Keep the rules and architecture overview aligned when changing those contracts.

This is a GitHub Pages archive with separate browser, content-processing and Windows-desktop boundaries.

- Register animation catalogs in `data/animation-catalogs.json`. Browser loading, queue selection and CI publishing must read that registry.
- New games using an existing engine are data additions. Do not add game-name conditionals to generic loading, cropping, cache or publishing code.
- Preview processing uses `preview_pipeline.py`, `preview_repository.py`, `preview_frame_pipeline.py` and `preview_policy.py`. Existing named workflows are manual compatibility entries. Do not copy a workflow for a new game.
- Public shared services have explicit inputs/outputs and no DOM access. Legacy classic-script globals are a migration boundary, not a pattern for new services.
- Windows YAML schedules build steps. PowerShell implementation belongs in `native-desktop/build/`; application behavior belongs in typed source files.
- Keep old URLs, model IDs and browser storage keys compatible. Never replace missing frames with another model.
- Test behavior and source-change races. Text/source assertions are supplementary integration checks.
- Run `npm test`, `npm run check`, and `npm run test:python`. Renderer or gesture changes also require the real browser regressions. Native behavior changes require Windows tests.
- Automated content publishers must have an explicit site-publication edge in `deploy-content.yml`; a bot push alone does not publish Pages. Keep deployment source verification and its tests when changing Pages configuration.
- Do not edit generated audit JSON to turn failures into successes.

- Keep generated dependencies and temporary outputs out of Git. Run `npm run audit:repo` before cleanup; its unreferenced media are candidates requiring reference and compatibility checks. Retire duplicate implementations instead of keeping full backup pages. See [repository hygiene](docs/REPOSITORY_HYGIENE.md).
