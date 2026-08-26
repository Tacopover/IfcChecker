# Vendored schemas

Third-party files, copied here verbatim so `bcf-xsd-conformance.ts` can validate generated BCF
files against the real schemas with no network access. Do not edit them — replace them from source.

| File | Source | Licence |
| --- | --- | --- |
| `markup.xsd` | `buildingSMART/BCF-XML@release_2_1`, `Schemas/markup.xsd` | CC BY-ND 4.0, © buildingSMART International Ltd. |
| `visinfo.xsd` | `buildingSMART/BCF-XML@release_2_1`, `Schemas/visinfo.xsd` | CC BY-ND 4.0, © buildingSMART International Ltd. |
| `version.xsd` | `buildingSMART/BCF-XML@release_2_1`, `Schemas/version.xsd` | CC BY-ND 4.0, © buildingSMART International Ltd. |

None of the three import a W3C meta-schema, unlike `ids.xsd` in `@ifc-qa/ids-validator/schema` — each
is self-contained, so no rewriting or preloading is needed to validate against them offline.
