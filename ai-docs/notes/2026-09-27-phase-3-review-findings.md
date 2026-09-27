---
title: "Phase 3 review findings on v2 (read-only subagent, 2026-09-27)"
kind: note
status: resolved
date: 2026-09-27
verified: 2026-09-27
stale_after: 2026-10-27
tags: [review, v2, phase-3, compatibility, performance]
aliases: [review, findings, larger link, attribute, backticks, auth window]
summary: "read before fixing the review: 3 bugs (the lost 1.1.16 larger-link rule splits URLs; any '=' before a link skips it; quadratic backtick-run bookkeeping), 1 risk (auth window unlisted), 3 nits (template standalone lines, unlisted small differences, types for null markdown and the old no-callback order) and the test gaps that let them through"
---

# Phase 3 review findings on v2

## Summary

A read-only review subagent (package-modernize prompts/review-subagent.md) compared the published 1.1.16, run offline with `request` stubbed, against the v2 build. It fuzzed both, and fuzzed the template renderer against hogan.js 3.0.2. No real sites were contacted. It reviewed the working tree of 17b3578 (the scanner with right-to-left label tables). All fixed or recorded on 2026-09-27 (commits 5851240 to 7146f05); the summary is on pull request #12.

## Bugs

1. **The 1.1.16 "smaller part of a larger URL" rule is gone** (`src/find-links.ts`, the loop in `findLinks`). 1.1.16 skipped an occurrence followed by any non-space character except `)`. 2.x replaces the truncated link and splits the URL, which no E-item covers. About 90 of 373 fuzz differences came from this.
   - Examples:
     - `See https://lists.example.org/archive?from=` + an email address + `&page=2 now` becomes a link that ends after the address, with `&page=2` left outside it
     - `http://example.com_v2/docs` becomes `[T](http://example.com)_v2/docs`
     - `Server http://example.com:8/x` becomes `[T](http://example.com):8/x`
     - `http://example.com:123456/x` becomes `[T](http://example.com:12345)6/x`
     - Same after `}`, `|`, `-`, `^`, `%`, `&`, or a letter or digit after the host.
   - Fix: skip the link when `markdown[rawEnd]` (the character after the raw match) is not whitespace and not one of E4's trailing characters, a closing bracket or `"`. Check that the golden test stays green, and add golden-style functional cases for these examples.
2. **Any `=` before a link counts as an HTML attribute** (`/=[\t ]*["']?$/` in `isInLinkContext`). 1.1.16 replaced `Mirror = https://example.com/file`, `a=http://x.com/a b=http://y.org/b` and `1 == http://…`. Its only attribute skip came from a following `"`.
   - Fix: require an attribute shape inside a tag, for example `/<[a-z][^<>]*\s[\w:-]+=[\t ]*["']?$/i`, or document it as an exception. The first is recommended.
3. **Quadratic bookkeeping of backtick runs** (`codeSpans`: `byLength.set(length, [...(byLength.get(length) ?? []), runIndex])` copies the array for every run).
   - One link followed by `` '`a '.repeat(N) `` takes 0.6 s at N = 20 000, 3.0 s at 40 000 and 11.4 s at 80 000.
   - Fix: push into the existing array. Add a performance case with one link and about 200 000 backtick runs: every crafted input so far had no link, so `codeRanges` never ran.

## Risk

4. **`AUTH_WINDOW` (256 characters) is an unlisted deviation.** For `https://example.com/` + 300 characters + `?e=` + an email address + `&x=1`, 1.1.16 requested the URL cut after the address and left the text; 2.x requests and replaces the full URL. That is better behaviour, but it should become a numbered exception (E18) in the plan and CHANGELOG.

## Nits

5. **Template standalone lines** (`src/template.ts`, `standalone`): hogan strips a line whose only content is several section or comment tags and blanks; 2.x strips only a line with one tag.
   - `{{^nope}}{{/nope}}\r\n{{&source}}`: hogan gives `e.com`, 2.x keeps the line break before e.com.
   - `{{! a }}  {{! b }}  \n{{title}}` keeps the `    \n` in 2.x.
   - `{{#url}}{{/url}} ` keeps the trailing space in 2.x.
   - Fix: strip the line when every tag on it is `#`, `^`, `/` or `!` and the rest is blanks. Add these to the hogan oracle's template list and re-record it in the scratch project.
6. **Unlisted small differences** to document or accept:
   - `](http://x.com/a) http://x.com/a` at the very start of the text: 1.1.16 replaced it because of its `currentUrlStart > 2` off-by-one; 2.x leaves it.
   - `http://example.com/"q` and `http://example.com/x"`: 1.1.16 made an image-check request and 2.x makes none; the output is the same.
   - `{{constructor}}` and `{{__proto__}}` render `''` where hogan printed `[object Object]`.
7. **Types** (`dist/index.d.*`):
   - `markdown: string` rejects `null` and `undefined`, which the runtime and 1.1.16 accept.
   - `replacePlainLinks(md, undefined, template)`, the old order without a callback, matches only the union overload, so `await` gives `string | void`.
   - Fix: `markdown: string | null | undefined` in the Promise and callback overloads, and an overload `(markdown, options: undefined | null, template?: string | null): Promise<string>`. Add both to test/consumers/types/assertions.ts.

## Test gaps

8. What let the bugs through, and what to add:
   - The scanner differential in test/unit/find-links.test.js re-implements 2.x's own trimming and http-only rules, not 1.1.16's validator. Add an offline differential against 1.1.16's own `lib/` logic, with the E-rules applied (the reviewer's scratch scripts `old.cjs`, `new.mjs`, `fuzz.mjs` in the session scratchpad show the method; they are not kept).
   - The generator's PIECES leave out `= & _ | { } ^`, one-digit ports and hosts followed by letters. Add them.

## Checked, nothing found

- **Scanner:** it matches url-regex 4.1.1 on the priorities (last `@` first, most domain labels, longest top-level domain, localhost and IPv4 order, code-unit classes), and the label tables are linear.
- **Pipeline:** replacement positions with repeated links are right; the callback runs exactly once; an abort gives back the unchanged text.
- **Source names:** tldts agrees with parse-domain 0.2.1 apart from Public Suffix List updates.
- **CLI:** stdin, `-i -`, exit codes and `--timeout` work.
- **Security:** only http and https are requested, credentials are refused, no Node or DOM globals are used, and the template renderer's allow-list keeps the prototype out of reach.
- **Exports:** the CJS and ESM exports are correct.

Related: builds on [../plans/2026-09-27-modernization-and-v2-release.md](../plans/2026-09-27-modernization-and-v2-release.md); see also [2026-09-27-phase-0-survey-baseline-and-capture.md](2026-09-27-phase-0-survey-baseline-and-capture.md).
